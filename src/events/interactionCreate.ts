import {
  Interaction,
  GuildMember,
  PermissionFlagsBits,
} from "discord.js";
import { config } from "../config/index.js";
import {
  handleOrderCommand,
  handleOrderModalSubmit,
  handleOrderButton,
} from "../commands/order.js";
import {
  handleWelcomeCommand,
  handleWelcomeModalSubmit,
  handleWelcomeSelectMenu,
  handleWelcomeButton,
} from "../commands/welcome.js";
import { toggleShopStatus } from "../handlers/shopManager.js";

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "order") {
      await handleOrderCommand(interaction);
    } else if (interaction.commandName === "welcome") {
      await handleWelcomeCommand(interaction);
    }
  } else if (interaction.isModalSubmit()) {
    if (
      interaction.customId.startsWith("order_modal_") ||
      interaction.customId.startsWith("order_create_modal_")
    ) {
      await handleOrderModalSubmit(interaction);
    } else if (interaction.customId.startsWith("welcome_modal_")) {
      await handleWelcomeModalSubmit(interaction);
    }
  } else if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "welcome_select_active") {
      await handleWelcomeSelectMenu(interaction);
    }
  } else if (interaction.isButton()) {
    if (interaction.customId === "welcome_btn_test") {
      await handleWelcomeButton(interaction);
    } else if (interaction.customId.startsWith("order_act_")) {
      await handleOrderButton(interaction);
    } else if (interaction.customId.startsWith("shop_toggle_")) {
      // Check admin permissions for shop toggle
      const member = interaction.member as GuildMember;
      const hasAdmin =
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
        interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
        (config.adminRoleId && member?.roles?.cache?.has(config.adminRoleId));

      if (!hasAdmin) {
        await interaction.reply({
          content: "คุณไม่มีสิทธิ์ในการเปลี่ยนสถานะร้านค้า (เฉพาะแอดมินหรือผู้ดูแล)",
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const isOpen = interaction.customId === "shop_toggle_open";
      if (!interaction.guild) {
        await interaction.editReply({ content: "ไม่สามารถทำรายการนอกเซิร์ฟเวอร์ได้" });
        return;
      }

      const result = await toggleShopStatus(interaction.guild, isOpen, interaction.user.id);
      await interaction.editReply({ content: result.message });
    }
  }
}
