import { Message, TextChannel } from "discord.js";
import { config } from "../config/index.js";
import {
  getAllPendingOrdersByChannel,
  checkSlipRefUsed,
  markOrderAsPaid,
} from "../handlers/orderManager.js";
import { verifySlipFromUrl } from "../handlers/slipVerifier.js";
import {
  createSlipSuccessEmbed,
  createSlipErrorEmbed,
  createPaymentLogEmbed,
} from "../utils/embed.js";

const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

export async function handleMessageCreate(message: Message): Promise<void> {
  // Ignore bot messages
  if (message.author.bot) return;

  // Check if the channel is a ticket channel (typically named ticket-xxxx)
  const rawChannelName = "name" in message.channel ? message.channel.name : "";
  const channelName = (rawChannelName || "").toLowerCase();
  const isTicketChannel = channelName.startsWith("ticket-");

  // If there are no image attachments, ignore
  const imageAttachment = message.attachments.find((att) => {
    if (att.contentType && IMAGE_CONTENT_TYPES.includes(att.contentType.toLowerCase())) {
      return true;
    }
    const filename = (att.name || "").toLowerCase();
    return (
      filename.endsWith(".png") ||
      filename.endsWith(".jpg") ||
      filename.endsWith(".jpeg") ||
      filename.endsWith(".webp")
    );
  });

  if (!imageAttachment) return;

  // Find all pending orders in this channel
  const pendingOrders = await getAllPendingOrdersByChannel(message.channelId);
  if (pendingOrders.length === 0) {
    if (isTicketChannel) {
      console.log(`[MESSAGE] Image uploaded in ticket ${channelName} but no pending order found.`);
    }
    return;
  }

  // Send a loading / processing message
  const processingMsg = await message.reply({
    content: "กำลังตรวจสอบสลิปการโอนเงิน กรุณารอสักครู่...",
  });

  try {
    // Try matching against target amounts if available
    const targetAmount = pendingOrders[0].amount;
    const slipResult = await verifySlipFromUrl(imageAttachment.url, targetAmount);

    if (!slipResult.success || !slipResult.data) {
      await processingMsg.edit({
        content: null,
        embeds: [
          createSlipErrorEmbed(
            "ไม่สามารถยืนยันสลิปได้",
            slipResult.message || "ไม่พบข้อมูลการโอนเงินหรือรูปภาพสลิปไม่ชัดเจน"
          ),
        ],
      });
      return;
    }

    const { transRef, amount } = slipResult.data;

    // Check duplicate slip
    if (transRef) {
      const isUsed = await checkSlipRefUsed(transRef);
      if (isUsed) {
        await processingMsg.edit({
          content: null,
          embeds: [
            createSlipErrorEmbed(
              "สลิปนี้ถูกใช้งานไปแล้ว",
              `รหัสอ้างอิงสลิป \`${transRef}\` มีการยืนยันการชำระเงินในระบบแล้ว ไม่สามารถใช้ซ้ำได้`
            ),
          ],
        });
        return;
      }
    }

    const paidAmount = amount || 0;

    // Smart Match: Find the pending order that matches this slip's amount
    const matchedOrder = pendingOrders.find(
      (ord) => Math.abs(ord.amount - paidAmount) <= 0.01
    );

    if (!matchedOrder) {
      const expectedList = pendingOrders
        .map((o) => `• Order \`${o.orderId}\`: **${o.amount.toFixed(2)} บาท**`)
        .join("\n");

      await processingMsg.edit({
        content: null,
        embeds: [
          createSlipErrorEmbed(
            "ยอดเงินในสลิปไม่ตรงกับคำสั่งซื้อ",
            `ยอดเงินที่ตรวจพบในสลิป: **${paidAmount.toFixed(
              2
            )} บาท**\n\nรายการคำสั่งซื้อที่รอชำระในห้องนี้:\n${expectedList}\n\nกรุณาตรวจสอบหรือติดต่อแอดมิน`
          ),
        ],
      });
      return;
    }

    // Slip is valid! Mark order as paid
    const updatedOrder = await markOrderAsPaid(
      matchedOrder.orderId,
      transRef || `NOREF-${Date.now()}`,
      slipResult.data
    );

    // Prepare ping text for admin
    let adminPing = "";
    if (config.adminRoleId) {
      adminPing = `<@&${config.adminRoleId}> `;
    } else if (matchedOrder.createdBy) {
      adminPing = `<@${matchedOrder.createdBy}> `;
    }

    const currentOrder = updatedOrder || matchedOrder;
    const successEmbed = createSlipSuccessEmbed(currentOrder, slipResult.data);

    await processingMsg.edit({
      content: `${adminPing}ได้รับการชำระเงินเรียบร้อยแล้วสำหรับคำสั่งซื้อ \`${matchedOrder.orderId}\``,
      embeds: [successEmbed],
    });

    // Send Payment Log to dedicated log channel
    if (config.logChannelId && message.client) {
      try {
        const logChannel = await message.client.channels.fetch(config.logChannelId);
        if (logChannel && logChannel.isTextBased()) {
          const paymentLogEmbed = createPaymentLogEmbed(
            currentOrder,
            slipResult.data,
            imageAttachment.url,
            message.channelId
          );
          await (logChannel as TextChannel).send({
            content: `บันทึกรายการชำระเงินใหม่ | Order \`${currentOrder.orderId}\``,
            embeds: [paymentLogEmbed],
          });
          console.log(`[PAYMENT_LOG] Successfully sent payment log to channel ${config.logChannelId}`);
        }
      } catch (logErr) {
        console.error(`[PAYMENT_LOG] Failed to send payment log to channel ${config.logChannelId}:`, logErr);
      }
    }
  } catch (error) {
    console.error("[MESSAGE_CREATE] Error handling slip verification:", error);
    await processingMsg.edit({
      content: null,
      embeds: [
        createSlipErrorEmbed(
          "เกิดข้อผิดพลาดในการตรวจสอบ",
          "ระบบไม่สามารถประมวลผลสลิปได้ในขณะนี้ กรุณาให้แอดมินช่วยตรวจสอบด้วยตนเอง"
        ),
      ],
    });
  }
}
