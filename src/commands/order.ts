import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalSubmitInteraction,
  ButtonInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
} from "discord.js";
import { config } from "../config/index.js";
import {
  createOrder,
  getOrdersByChannel,
  getLatestPendingOrderByChannel,
  cancelOrderByOrderId,
  mergePendingOrder,
} from "../handlers/orderManager.js";
import {
  createOrderEmbed,
  createOrderMergedEmbed,
  createSlipErrorEmbed,
} from "../utils/embed.js";

export const data = new SlashCommandBuilder()
  .setName("order")
  .setDescription("จัดการคำสั่งซื้อในห้อง Ticket")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("create")
      .setDescription("สร้างรายการคำสั่งซื้อใหม่ (สำหรับ Admin/Staff)")
      .addUserOption((option) =>
        option
          .setName("customer")
          .setDescription("เลือกลูกค้าที่เป็นเจ้าของออเดอร์")
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("list")
      .setDescription("ดูรายการคำสั่งซื้อทั้งหมดในช่อง Ticket นี้")
  );

export async function handleOrderCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "create") {
    // Check permission
    const member = interaction.member as GuildMember;
    const hasAdminPermission =
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
      (config.adminRoleId && member?.roles?.cache?.has(config.adminRoleId));

    if (!hasAdminPermission) {
      await interaction.reply({
        content: "คุณไม่มีสิทธิ์ในการใช้คำสั่งสร้าง Order (เฉพาะแอดมินหรือผู้ดูแล)",
        ephemeral: true,
      });
      return;
    }

    const customer = interaction.options.getUser("customer", true);

    // Check if there is already a pending order in this ticket
    const pendingOrder = await getLatestPendingOrderByChannel(interaction.channelId);

    if (pendingOrder) {
      const warnEmbed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle("พบรายการคำสั่งซื้อที่ยังค้างชำระ (Pending)")
        .setDescription(
          `ในห้องนี้มีออเดอร์ \`${pendingOrder.orderId}\` ของลูกค้า <@${pendingOrder.customerId}> ยอด **${pendingOrder.amount.toFixed(
            2
          )} บาท** ยังไม่ได้ชำระเงิน\n\nกรุณาเลือกรูปแบบที่ต้องการดำเนินการ:`
        )
        .addFields({ name: "รายการสินค้าเดิม", value: pendingOrder.items });

      const btnMerge = new ButtonBuilder()
        .setCustomId(`order_act_merge_${pendingOrder.orderId}_${customer.id}`)
        .setLabel("รวมยอดเงินกับออเดอร์เดิม (Merge)")
        .setStyle(ButtonStyle.Primary);

      const btnReplace = new ButtonBuilder()
        .setCustomId(`order_act_replace_${pendingOrder.orderId}_${customer.id}`)
        .setLabel("แทนที่ออเดอร์เดิม (Replace)")
        .setStyle(ButtonStyle.Danger);

      const btnCancel = new ButtonBuilder()
        .setCustomId("order_act_dismiss")
        .setLabel("ยกเลิก")
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        btnMerge,
        btnReplace,
        btnCancel
      );

      await interaction.reply({
        embeds: [warnEmbed],
        components: [row],
        ephemeral: true,
      });
      return;
    }

    // No pending order, show normal modal
    await showOrderModal(interaction, customer.id, "new");
  } else if (subcommand === "list") {
    await interaction.deferReply({ ephemeral: true });
    const orders = await getOrdersByChannel(interaction.channelId);

    if (orders.length === 0) {
      await interaction.editReply({
        content: "ไม่มีรายการคำสั่งซื้อในช่อง Ticket นี้",
      });
      return;
    }

    const orderListText = orders
      .map(
        (o) =>
          `• [${o.orderId}] ลูกค้า: <@${o.customerId}> | ยอด: ${o.amount} บาท | สถานะ: **${o.status}**`
      )
      .join("\n");

    await interaction.editReply({
      content: `รายการคำสั่งซื้อในห้องนี้:\n${orderListText}`,
    });
  }
}

async function showOrderModal(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  customerId: string,
  mode: "new" | "merge" | "replace",
  existingOrderId?: string
): Promise<void> {
  const modalCustomId = `order_modal_${mode}_${customerId}_${existingOrderId || "none"}`;
  let modalTitle = "สร้างคำสั่งซื้อใหม่";
  let itemsLabel = "รายการสินค้า / รายละเอียด";
  let amountLabel = "ยอดเงินที่ต้องชำระ (บาท)";

  if (mode === "merge") {
    modalTitle = "เพิ่มรายการสินค้าเพื่อรวมยอด";
    itemsLabel = "รายการสินค้าที่เพิ่มเข้ามา";
    amountLabel = "ยอดเงินที่ต้องการบวกเพิ่ม (บาท)";
  } else if (mode === "replace") {
    modalTitle = "สร้างออเดอร์ใหม่แทนที่เดิม";
  }

  const modal = new ModalBuilder().setCustomId(modalCustomId).setTitle(modalTitle);

  const itemsInput = new TextInputBuilder()
    .setCustomId("order_items")
    .setLabel(itemsLabel)
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("เช่น สินค้าชิ้นที่สอง, ค่าบริการเพิ่มเติม")
    .setRequired(true);

  const amountInput = new TextInputBuilder()
    .setCustomId("order_amount")
    .setLabel(amountLabel)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("เช่น 100 หรือ 150.00")
    .setRequired(true);

  const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(itemsInput);
  const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput);

  modal.addComponents(row1, row2);
  await interaction.showModal(modal);
}

export async function handleOrderButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.customId.startsWith("order_act_")) return;

  if (interaction.customId === "order_act_dismiss") {
    await interaction.update({
      content: "ยกเลิกการทำรายการเรียบร้อย",
      embeds: [],
      components: [],
    });
    return;
  }

  const parts = interaction.customId.split("_");
  const action = parts[2]; // merge or replace
  const existingOrderId = parts[3];
  const customerId = parts[4];

  if (action === "merge") {
    await showOrderModal(interaction, customerId, "merge", existingOrderId);
  } else if (action === "replace") {
    await showOrderModal(interaction, customerId, "replace", existingOrderId);
  }
}

export async function handleOrderModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.customId.startsWith("order_modal_")) return;

  const parts = interaction.customId.split("_");
  const mode = parts[2]; // new, merge, replace
  const customerId = parts[3];
  const existingOrderId = parts[4];

  const items = interaction.fields.getTextInputValue("order_items");
  const amountStr = interaction.fields.getTextInputValue("order_amount");

  const amount = parseFloat(amountStr.replace(/,/g, "").trim());
  if (isNaN(amount) || amount <= 0) {
    await interaction.reply({
      embeds: [
        createSlipErrorEmbed(
          "ยอดเงินไม่ถูกต้อง",
          "กรุณากรอกยอดเงินเป็นตัวเลขที่มากกว่า 0 เช่น 100 หรือ 250.50"
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    if (mode === "merge" && existingOrderId && existingOrderId !== "none") {
      const mergedOrder = await mergePendingOrder(existingOrderId, items, amount);
      if (!mergedOrder) {
        await interaction.editReply({
          content: "ไม่พบออเดอร์เดิมที่กำลังรอชำระเพื่อรวมยอด",
        });
        return;
      }

      const mergedEmbed = createOrderMergedEmbed(mergedOrder, items, amount);
      await interaction.editReply({
        content: `แจ้งเตือน: <@${customerId}> มีการอัปเดตรวมยอดคำสั่งซื้อ`,
        embeds: [mergedEmbed],
      });
      return;
    }

    if (mode === "replace" && existingOrderId && existingOrderId !== "none") {
      await cancelOrderByOrderId(existingOrderId);
      if (interaction.channel && "send" in interaction.channel) {
        await interaction.channel.send({
          content: `คำสั่งซื้อเดิม \`${existingOrderId}\` ถูกยกเลิกโดยแอดมิน เพื่อสร้างคำสั่งซื้อใหม่`,
        });
      }
    }

    // Create new order (mode === "new" or mode === "replace")
    const order = await createOrder({
      channelId: interaction.channelId || "",
      guildId: interaction.guildId || "",
      customerId,
      items,
      amount,
      createdBy: interaction.user.id,
    });

    const embed = createOrderEmbed(order);
    await interaction.editReply({
      content: `แจ้งเตือน: <@${customerId}> มีรายการคำสั่งซื้อใหม่`,
      embeds: [embed],
    });
  } catch (error) {
    console.error("[ORDER_MODAL] Error submitting order:", error);
    await interaction.editReply({
      content: "เกิดข้อผิดพลาดในการบันทึกคำสั่งซื้อลงฐานข้อมูล",
    });
  }
}
