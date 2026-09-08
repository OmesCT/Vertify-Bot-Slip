import { EmbedBuilder } from "discord.js";
import { IOrder } from "../models/Order.js";

export function createOrderEmbed(order: IOrder): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("รายการคำสั่งซื้อใหม่")
    .setDescription(`คำสั่งซื้อถูกสร้างขึ้นเรียบร้อยแล้ว กรุณาชำระเงินตามยอดด้านล่าง`)
    .addFields(
      { name: "Order ID", value: `\`${order.orderId}\``, inline: true },
      { name: "ลูกค้า", value: `<@${order.customerId}>`, inline: true },
      { name: "สถานะ", value: "รอการชำระเงิน (Pending)", inline: true },
      { name: "รายการสินค้า", value: order.items },
      {
        name: "ยอดที่ต้องชำระ",
        value: `**${order.amount.toLocaleString("th-TH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} บาท**`,
      }
    )
    .setFooter({ text: "เมื่อโอนเงินแล้ว กรุณาอัพโหลดรูปภาพสลิปในช่องนี้เพื่อยืนยัน" })
    .setTimestamp();
}

export function createOrderMergedEmbed(order: IOrder, addedItems: string, addedAmount: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("อัปเดตรวมยอดคำสั่งซื้อ (Order Merged)")
    .setDescription(`คำสั่งซื้อ \`${order.orderId}\` มีการรวมรายการสินค้าและยอดเงินเพิ่มเติม`)
    .addFields(
      { name: "Order ID", value: `\`${order.orderId}\``, inline: true },
      { name: "ลูกค้า", value: `<@${order.customerId}>`, inline: true },
      { name: "รายการที่เพิ่มเข้ามา", value: `+ ${addedItems} (+${addedAmount.toFixed(2)} บาท)` },
      { name: "รวมรายการสินค้าทั้งหมด", value: order.items },
      {
        name: "ยอดรวมที่ต้องชำระทั้งหมด",
        value: `**${order.amount.toLocaleString("th-TH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} บาท**`,
      }
    )
    .setFooter({ text: "กรุณาโอนตามยอดรวมด้านบน แล้วอัพโหลดรูปภาพสลิปในช่องนี้" })
    .setTimestamp();
}

export function createSlipSuccessEmbed(order: IOrder, slipData: any): EmbedBuilder {
  const fields = [
    { name: "Order ID", value: `\`${order.orderId}\``, inline: true },
    { name: "ลูกค้า", value: `<@${order.customerId}>`, inline: true },
    {
      name: "ยอดเงินที่โอน",
      value: `**${slipData.amount?.toFixed(2) || order.amount.toFixed(2)} บาท**`,
      inline: true,
    },
    { name: "ธนาคาร / ช่องทาง", value: slipData.bankName || "ธนาคารไทย", inline: true },
    { name: "วันที่ / เวลาโอน", value: `${slipData.date || "-"} ${slipData.time || ""}`.trim() || "-", inline: true },
    { name: "รหัสอ้างอิงสลิป", value: `\`${slipData.transRef || "-"}\``, inline: true },
    { name: "ผู้โอนเงิน", value: slipData.senderName || "-", inline: true },
    { name: "ผู้รับเงิน", value: slipData.receiverName || "-", inline: true },
  ];

  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("ยืนยันการชำระเงินสำเร็จ")
    .setDescription(`ตรวจสอบสลิปถูกต้อง ยอดเงินตรงกับคำสั่งซื้อเรียบร้อยแล้ว`)
    .addFields(fields)
    .setFooter({ text: "ระบบตรวจสอบสลิปอัตโนมัติ (OCR & QR Code Verification)" })
    .setTimestamp();
}

export function createPaymentLogEmbed(
  order: IOrder,
  slipData: any,
  slipImageUrl: string,
  ticketChannelId: string
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x00b894)
    .setTitle("บันทึกการชำระเงิน (Payment Log)")
    .setDescription(`มีการชำระเงินสำเร็จในห้อง Ticket <#${ticketChannelId}>`)
    .addFields(
      { name: "Order ID", value: `\`${order.orderId}\``, inline: true },
      { name: "ลูกค้า", value: `<@${order.customerId}> (\`${order.customerId}\`)`, inline: true },
      {
        name: "ยอดเงินที่โอน",
        value: `**${slipData.amount?.toFixed(2) || order.amount.toFixed(2)} บาท**`,
        inline: true,
      },
      { name: "ธนาคาร / ช่องทางโอน", value: slipData.bankName || "ธนาคารไทย", inline: true },
      {
        name: "วันที่ / เวลาที่โอน",
        value: `${slipData.date || "-"} ${slipData.time || ""}`.trim() || "-",
        inline: true,
      },
      { name: "รหัสอ้างอิงสลิป (Ref/Hash)", value: `\`${slipData.transRef || "-"}\``, inline: true },
      { name: "ชื่อผู้โอน (จากสลิป)", value: slipData.senderName || "-", inline: true },
      { name: "ชื่อผู้รับ (บัญชีร้าน)", value: slipData.receiverName || "-", inline: true },
      { name: "รายการสินค้าใน Order", value: order.items || "-", inline: false }
    )
    .setImage(slipImageUrl)
    .setFooter({ text: `Ticket ID: ${ticketChannelId}` })
    .setTimestamp();

  return embed;
}

export function createSlipErrorEmbed(title: string, reason: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle(title)
    .setDescription(reason)
    .setFooter({ text: "กรุณาติดต่อแอดมินหรือตรวจสอบความถูกต้องของสลิป" })
    .setTimestamp();
}
