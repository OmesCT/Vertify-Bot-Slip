import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  ButtonInteraction,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
} from "discord.js";
import { config } from "../config/index.js";
import {
  getOrCreateWelcomeConfig,
  getDefaultTemplate,
  buildWelcomeEmbed,
  sendWelcomeMessage,
} from "../handlers/welcomeManager.js";
import { IWelcomeTemplate } from "../models/WelcomeConfig.js";

export function getWelcomeCommandData() {
  return new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("จัดการระบบข้อความต้อนรับสมาชิกใหม่ (Welcome Message System)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("แสดงรายการเทมเพลตข้อความต้อนรับทั้งหมด และเลือกเปลี่ยนเทมเพลตที่ใช้งาน")
    )
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("สร้างเทมเพลตข้อความต้อนรับใหม่ผ่านหน้าต่างฟอร์ม (Modal)")
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("แก้ไขเทมเพลตข้อความต้อนรับผ่านหน้าต่างฟอร์ม (Modal)")
        .addStringOption((opt) =>
          opt
            .setName("template")
            .setDescription("ชื่อเทมเพลตที่ต้องการแก้ไข (เว้นว่างไว้จะแก้ไขเทมเพลตที่ใช้อยู่)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("ตั้งค่าห้องส่งข้อความต้อนรับ หรือเปิด/ปิดระบบ")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("ห้องข้อความสำหรับส่ง Welcome Message")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt
            .setName("enabled")
            .setDescription("เปิดหรือปิดระบบ Welcome Message")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("test")
        .setDescription("ทดสอบส่งข้อความต้อนรับจำลองไปยังห้อง Welcome")
        .addStringOption((opt) =>
          opt
            .setName("template")
            .setDescription("ชื่อเทมเพลตที่ต้องการทดสอบ (เว้นว่างจะใช้เทมเพลตปัจจุบัน)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("ลบเทมเพลตข้อความต้อนรับ")
        .addStringOption((opt) =>
          opt
            .setName("template")
            .setDescription("ชื่อเทมเพลตที่ต้องการลบ")
            .setRequired(true)
        )
    );
}

function checkAdminPermission(interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction): boolean {
  const member = interaction.member as GuildMember;
  return !!(
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    (config.adminRoleId && member?.roles?.cache?.has(config.adminRoleId))
  );
}

export async function handleWelcomeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์เท่านั้น", ephemeral: true });
    return;
  }

  if (!checkAdminPermission(interaction)) {
    await interaction.reply({ content: "คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้ (เฉพาะแอดมินหรือผู้ดูแล)", ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const welcomeConfig = await getOrCreateWelcomeConfig(interaction.guild.id);

  if (subcommand === "list") {
    await handleListSubcommand(interaction, welcomeConfig);
  } else if (subcommand === "setup") {
    await handleSetupSubcommand(interaction, welcomeConfig);
  } else if (subcommand === "create") {
    await handleCreateSubcommand(interaction);
  } else if (subcommand === "edit") {
    await handleEditSubcommand(interaction, welcomeConfig);
  } else if (subcommand === "test") {
    await handleTestSubcommand(interaction, welcomeConfig);
  } else if (subcommand === "delete") {
    await handleDeleteSubcommand(interaction, welcomeConfig);
  }
}

async function handleListSubcommand(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  welcomeConfig: any
): Promise<void> {
  const templates = welcomeConfig.templates as IWelcomeTemplate[];
  const activeName = welcomeConfig.activeTemplateName;
  const channelMention = `<#${welcomeConfig.channelId}>`;

  const embed = new EmbedBuilder()
    .setTitle("รายการเทมเพลตข้อความต้อนรับ (Welcome Templates)")
    .setColor(0x5865f2)
    .setDescription(
      `ห้องที่ส่งข้อความ: ${channelMention}\nสถานะระบบ: **${welcomeConfig.isEnabled ? "เปิดใช้งาน (ENABLED)" : "ปิดใช้งาน (DISABLED)"}**\nเทมเพลตที่ใช้งานปัจจุบัน: **${activeName}**\n\nสามารถเลือกเปลี่ยนเทมเพลตที่ต้องการใช้งานได้จากเมนูด้านล่าง:`
    )
    .setFooter({ text: "ใช้ /welcome create เพื่อเพิ่มเทมเพลตใหม่ หรือ /welcome edit เพื่อแก้ไข" })
    .setTimestamp();

  templates.forEach((tpl, idx) => {
    const isActive = tpl.name === activeName;
    const descPreview = tpl.description.length > 80 ? tpl.description.slice(0, 80) + "..." : tpl.description;
    embed.addFields({
      name: `${idx + 1}. [${isActive ? "ACTIVE" : "SAVED"}] ${tpl.name}`,
      value: `**หัวข้อ**: ${tpl.title}\n**ตัวอย่าง**: ${descPreview}\n**Thumbnail**: ${tpl.thumbnailType}\n**รูปภาพ**: ${tpl.imageUrl ? "มีรูปภาพ" : "ไม่มี"}`,
      inline: false,
    });
  });

  const selectOptions = templates.map((tpl) => ({
    label: tpl.name + (tpl.name === activeName ? " (กำลังใช้งาน)" : ""),
    description: tpl.title.slice(0, 50),
    value: tpl.name,
    default: tpl.name === activeName,
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("welcome_select_active")
    .setPlaceholder("เลือกเทมเพลตเพื่อตั้งเป็นค่าเริ่มต้น...")
    .addOptions(selectOptions);

  const testBtn = new ButtonBuilder()
    .setCustomId("welcome_btn_test")
    .setLabel("ทดสอบส่งข้อความพรีวิว (Test Send)")
    .setStyle(ButtonStyle.Primary);

  const rows = [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu),
    new ActionRowBuilder<ButtonBuilder>().addComponents(testBtn),
  ];

  if (interaction.isStringSelectMenu()) {
    await interaction.update({ embeds: [embed], components: rows });
  } else {
    await interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
  }
}

async function handleSetupSubcommand(
  interaction: ChatInputCommandInteraction,
  welcomeConfig: any
): Promise<void> {
  const channel = interaction.options.getChannel("channel");
  const enabled = interaction.options.getBoolean("enabled");

  let updated = false;
  if (channel) {
    welcomeConfig.channelId = channel.id;
    updated = true;
  }
  if (enabled !== null) {
    welcomeConfig.isEnabled = enabled;
    updated = true;
  }

  if (updated) {
    await welcomeConfig.save();
    await interaction.reply({
      content: `บันทึกการตั้งค่าเรียบร้อยแล้ว\n- ห้องแจ้งเตือน: <#${welcomeConfig.channelId}>\n- สถานะ: **${welcomeConfig.isEnabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}**`,
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: `การตั้งค่าปัจจุบัน:\n- ห้องแจ้งเตือน: <#${welcomeConfig.channelId}>\n- สถานะ: **${welcomeConfig.isEnabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}**`,
      ephemeral: true,
    });
  }
}

async function handleCreateSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId("welcome_modal_create")
    .setTitle("สร้างเทมเพลต Welcome ใหม่");

  const nameInput = new TextInputBuilder()
    .setCustomId("tpl_name")
    .setLabel("ชื่อเทมเพลต (ภาษาอังกฤษ ตัวเลข หรือขีด เช่น cat-v2)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(30);

  const titleInput = new TextInputBuilder()
    .setCustomId("tpl_title")
    .setLabel("หัวข้อข้อความต้อนรับ (Embed Title)")
    .setStyle(TextInputStyle.Short)
    .setValue("ยินดีต้อนรับสู่ร้านครับ 🔥")
    .setRequired(true)
    .setMaxLength(100);

  const descInput = new TextInputBuilder()
    .setCustomId("tpl_description")
    .setLabel("เนื้อหา ({user}, {server}, {memberCount})")
    .setStyle(TextInputStyle.Paragraph)
    .setValue("💥สวัสดีคุณ {user} ขอบคุณที่สนใจร้านค้านะครับ\nสามารถกดรับ Role ได้ที่ห้อง <#1546539675781693512>\nและดู Credit ได้ที่ห้อง <#1546539676368633903>\nได้เลยนะครับ❤️")
    .setRequired(true)
    .setMaxLength(1000);

  const imageInput = new TextInputBuilder()
    .setCustomId("tpl_image")
    .setLabel("URL ภาพด้านล่าง (ใส่ 'cat' เพื่อใช้รูปแมว)")
    .setStyle(TextInputStyle.Short)
    .setValue("cat")
    .setRequired(false);

  const thumbnailInput = new TextInputBuilder()
    .setCustomId("tpl_thumbnail")
    .setLabel("Thumbnail ขวาบน (user_avatar หรือ URL รูป)")
    .setStyle(TextInputStyle.Short)
    .setValue("user_avatar")
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(thumbnailInput)
  );

  await interaction.showModal(modal);
}

async function handleEditSubcommand(
  interaction: ChatInputCommandInteraction,
  welcomeConfig: any
): Promise<void> {
  const targetName = interaction.options.getString("template") || welcomeConfig.activeTemplateName;
  const template = welcomeConfig.templates.find((t: IWelcomeTemplate) => t.name === targetName);

  if (!template) {
    await interaction.reply({
      content: `ไม่พบเทมเพลตชื่อ **${targetName}** (พิมพ์ /welcome list เพื่อดูรายชื่อทั้งหมด)`,
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`welcome_modal_edit_${template.name}`)
    .setTitle(`แก้ไขเทมเพลต: ${template.name}`);

  const titleInput = new TextInputBuilder()
    .setCustomId("tpl_title")
    .setLabel("หัวข้อข้อความต้อนรับ (Embed Title)")
    .setStyle(TextInputStyle.Short)
    .setValue(template.title)
    .setRequired(true)
    .setMaxLength(100);

  const descInput = new TextInputBuilder()
    .setCustomId("tpl_description")
    .setLabel("เนื้อหา ({user}, {server}, {memberCount})")
    .setStyle(TextInputStyle.Paragraph)
    .setValue(template.description)
    .setRequired(true)
    .setMaxLength(1000);

  const imageInput = new TextInputBuilder()
    .setCustomId("tpl_image")
    .setLabel("URL ภาพด้านล่าง (ใส่ 'cat' เพื่อใช้รูปแมว)")
    .setStyle(TextInputStyle.Short)
    .setValue(template.imageUrl === "attachment://welcome-cat.png" ? "cat" : template.imageUrl || "")
    .setRequired(false);

  const thumbnailInput = new TextInputBuilder()
    .setCustomId("tpl_thumbnail")
    .setLabel("Thumbnail ขวาบน (user_avatar หรือ URL รูป)")
    .setStyle(TextInputStyle.Short)
    .setValue(
      template.thumbnailType === "custom" && template.customThumbnailUrl
        ? template.customThumbnailUrl
        : template.thumbnailType
    )
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(thumbnailInput)
  );

  await interaction.showModal(modal);
}

async function handleTestSubcommand(
  interaction: ChatInputCommandInteraction,
  welcomeConfig: any
): Promise<void> {
  const targetName = interaction.options.getString("template") || welcomeConfig.activeTemplateName;
  const template = welcomeConfig.templates.find((t: IWelcomeTemplate) => t.name === targetName) || welcomeConfig.templates[0] || getDefaultTemplate();

  const channel = interaction.guild!.channels.cache.get(welcomeConfig.channelId) as TextChannel | undefined;
  if (!channel) {
    await interaction.reply({
      content: `ไม่พบห้องสำหรับส่ง Welcome (<#${welcomeConfig.channelId}>)`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const member = interaction.member as GuildMember;
  const { embed, files } = buildWelcomeEmbed(template, member);

  await channel.send({
    content: `<@${member.id}> (ทดสอบระบบ Welcome Message)`,
    embeds: [embed],
    files,
  });

  await interaction.editReply({
    content: `ส่งข้อความต้อนรับทดสอบ (เทมเพลต: **${template.name}**) ไปยังห้อง <#${channel.id}> เรียบร้อยแล้ว`,
  });
}

async function handleDeleteSubcommand(
  interaction: ChatInputCommandInteraction,
  welcomeConfig: any
): Promise<void> {
  const targetName = interaction.options.getString("template", true);

  if (welcomeConfig.templates.length <= 1) {
    await interaction.reply({
      content: "ไม่สามารถลบได้ เนื่องจากต้องมีเทมเพลตอย่างน้อย 1 รายการในระบบ",
      ephemeral: true,
    });
    return;
  }

  const idx = welcomeConfig.templates.findIndex((t: IWelcomeTemplate) => t.name === targetName);
  if (idx === -1) {
    await interaction.reply({
      content: `ไม่พบเทมเพลตชื่อ **${targetName}**`,
      ephemeral: true,
    });
    return;
  }

  welcomeConfig.templates.splice(idx, 1);
  if (welcomeConfig.activeTemplateName === targetName) {
    welcomeConfig.activeTemplateName = welcomeConfig.templates[0].name;
  }

  await welcomeConfig.save();
  await interaction.reply({
    content: `ลบเทมเพลต **${targetName}** เรียบร้อยแล้ว (เทมเพลตที่ใช้งานปัจจุบัน: **${welcomeConfig.activeTemplateName}**)`,
    ephemeral: true,
  });
}

export async function handleWelcomeModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.guild) return;

  const welcomeConfig = await getOrCreateWelcomeConfig(interaction.guild.id);

  if (interaction.customId === "welcome_modal_create") {
    const rawName = interaction.fields.getTextInputValue("tpl_name").trim().toLowerCase().replace(/\s+/g, "-");
    const title = interaction.fields.getTextInputValue("tpl_title").trim();
    const description = interaction.fields.getTextInputValue("tpl_description").trim();
    const rawImage = interaction.fields.getTextInputValue("tpl_image").trim();
    const rawThumb = interaction.fields.getTextInputValue("tpl_thumbnail").trim();

    if (welcomeConfig.templates.some((t: IWelcomeTemplate) => t.name === rawName)) {
      await interaction.reply({
        content: `เทมเพลตชื่อ **${rawName}** มีอยู่แล้วในระบบ กรุณาใช้ชื่ออื่น`,
        ephemeral: true,
      });
      return;
    }

    const imageUrl = rawImage === "cat" ? "attachment://welcome-cat.png" : rawImage;
    let thumbnailType: "user_avatar" | "custom" | "none" = "user_avatar";
    let customThumbnailUrl = "";

    if (rawThumb.startsWith("http")) {
      thumbnailType = "custom";
      customThumbnailUrl = rawThumb;
    } else if (rawThumb === "none") {
      thumbnailType = "none";
    }

    welcomeConfig.templates.push({
      name: rawName,
      title,
      description,
      imageUrl,
      thumbnailType,
      customThumbnailUrl,
      color: "#5865F2",
    });

    await welcomeConfig.save();
    await interaction.reply({
      content: `สร้างเทมเพลต **${rawName}** สำเร็จแล้ว\nคุณสามารถใช้ \`/welcome list\` เพื่อเลือกเปิดใช้งานเทมเพลตนี้ได้`,
      ephemeral: true,
    });
  } else if (interaction.customId.startsWith("welcome_modal_edit_")) {
    const targetName = interaction.customId.replace("welcome_modal_edit_", "");
    const template = welcomeConfig.templates.find((t: IWelcomeTemplate) => t.name === targetName);

    if (!template) {
      await interaction.reply({ content: `ไม่พบเทมเพลต **${targetName}**`, ephemeral: true });
      return;
    }

    template.title = interaction.fields.getTextInputValue("tpl_title").trim();
    template.description = interaction.fields.getTextInputValue("tpl_description").trim();
    const rawImage = interaction.fields.getTextInputValue("tpl_image").trim();
    const rawThumb = interaction.fields.getTextInputValue("tpl_thumbnail").trim();

    template.imageUrl = rawImage === "cat" ? "attachment://welcome-cat.png" : rawImage;
    if (rawThumb.startsWith("http")) {
      template.thumbnailType = "custom";
      template.customThumbnailUrl = rawThumb;
    } else if (rawThumb === "none") {
      template.thumbnailType = "none";
      template.customThumbnailUrl = "";
    } else {
      template.thumbnailType = "user_avatar";
      template.customThumbnailUrl = "";
    }

    await welcomeConfig.save();
    await interaction.reply({
      content: `อัปเดตเทมเพลต **${targetName}** เรียบร้อยแล้ว`,
      ephemeral: true,
    });
  }
}

export async function handleWelcomeSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.guild || interaction.customId !== "welcome_select_active") return;

  const selectedName = interaction.values[0];
  const welcomeConfig = await getOrCreateWelcomeConfig(interaction.guild.id);

  if (welcomeConfig.templates.some((t: IWelcomeTemplate) => t.name === selectedName)) {
    welcomeConfig.activeTemplateName = selectedName;
    await welcomeConfig.save();
    await handleListSubcommand(interaction, welcomeConfig);
  } else {
    await interaction.reply({ content: "ไม่พบเทมเพลตที่เลือก", ephemeral: true });
  }
}

export async function handleWelcomeButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild || interaction.customId !== "welcome_btn_test") return;

  const welcomeConfig = await getOrCreateWelcomeConfig(interaction.guild.id);
  const activeTemplate =
    welcomeConfig.templates.find((t: IWelcomeTemplate) => t.name === welcomeConfig.activeTemplateName) ||
    welcomeConfig.templates[0] ||
    getDefaultTemplate();

  const channel = interaction.guild.channels.cache.get(welcomeConfig.channelId) as TextChannel | undefined;
  if (!channel) {
    await interaction.reply({
      content: `ไม่พบห้อง Welcome (<#${welcomeConfig.channelId}>)`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const member = interaction.member as GuildMember;
  const { embed, files } = buildWelcomeEmbed(activeTemplate, member);

  await channel.send({
    content: `<@${member.id}> (ทดสอบระบบ Welcome Message)`,
    embeds: [embed],
    files,
  });

  await interaction.editReply({
    content: `ส่งข้อความทดสอบ (เทมเพลต: **${activeTemplate.name}**) ไปยังห้อง <#${channel.id}> เรียบร้อยแล้ว`,
  });
}
