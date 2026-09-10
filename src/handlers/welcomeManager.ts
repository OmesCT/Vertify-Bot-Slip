import {
  GuildMember,
  TextChannel,
  EmbedBuilder,
  AttachmentBuilder,
  Guild,
  ColorResolvable,
} from "discord.js";
import path from "path";
import fs from "fs";
import { WelcomeConfig, IWelcomeConfig, IWelcomeTemplate } from "../models/WelcomeConfig.js";

const DEFAULT_CHANNEL_ID = "1546765150676324432"; // ᴡᴇʟᴄᴏᴍᴇ-ɪɴ
const LOCAL_CAT_IMAGE = path.join(process.cwd(), "assets", "welcome-cat.png");

export function getDefaultTemplate(): IWelcomeTemplate {
  return {
    name: "default",
    title: "ยินดีต้อนรับสู่ร้านครับ 🔥",
    description:
      "💥สวัสดีคุณ {user} ขอบคุณที่สนใจร้านค้านะครับ\nสามารถกดรับ Role ได้ที่ห้อง <#1546539675781693512>\nและดู Credit ได้ที่ห้อง <#1546539676368633903>\nได้เลยนะครับ❤️",
    thumbnailType: "user_avatar",
    imageUrl: "attachment://welcome-cat.png",
    color: "#5865F2",
  };
}

export async function getOrCreateWelcomeConfig(guildId: string): Promise<IWelcomeConfig> {
  let config = await WelcomeConfig.findOne({ guildId });
  if (!config) {
    config = new WelcomeConfig({
      guildId,
      channelId: DEFAULT_CHANNEL_ID,
      isEnabled: true,
      activeTemplateName: "default",
      templates: [getDefaultTemplate()],
    });
    await config.save();
  } else if (!config.templates || config.templates.length === 0) {
    config.templates = [getDefaultTemplate()];
    config.activeTemplateName = "default";
    await config.save();
  }
  return config;
}

export function buildWelcomeEmbed(
  template: IWelcomeTemplate,
  member: GuildMember
): { embed: EmbedBuilder; files: AttachmentBuilder[] } {
  const files: AttachmentBuilder[] = [];

  // Replace dynamic placeholders
  const description = template.description
    .replace(/\{user\}/g, `<@${member.id}>`)
    .replace(/\{username\}/g, member.user.username)
    .replace(/\{server\}/g, member.guild.name)
    .replace(/\{memberCount\}/g, member.guild.memberCount.toString());

  const title = template.title
    .replace(/\{server\}/g, member.guild.name)
    .replace(/\{username\}/g, member.user.username);

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor((template.color as ColorResolvable) || 0x5865f2)
    .setTimestamp();

  // Thumbnail handling
  if (template.thumbnailType === "user_avatar") {
    embed.setThumbnail(member.user.displayAvatarURL({ size: 256 }));
  } else if (template.thumbnailType === "custom" && template.customThumbnailUrl) {
    embed.setThumbnail(template.customThumbnailUrl);
  }

  // Large bottom image handling
  if (template.imageUrl) {
    if (template.imageUrl === "attachment://welcome-cat.png" && fs.existsSync(LOCAL_CAT_IMAGE)) {
      files.push(new AttachmentBuilder(LOCAL_CAT_IMAGE, { name: "welcome-cat.png" }));
      embed.setImage("attachment://welcome-cat.png");
    } else if (template.imageUrl.startsWith("http")) {
      embed.setImage(template.imageUrl);
    }
  }

  return { embed, files };
}

export async function sendWelcomeMessage(member: GuildMember): Promise<boolean> {
  try {
    const config = await getOrCreateWelcomeConfig(member.guild.id);
    if (!config.isEnabled) return false;

    const channel = member.guild.channels.cache.get(config.channelId) as TextChannel | undefined;
    if (!channel) {
      console.warn(`[WELCOME] Target channel ${config.channelId} not found in guild ${member.guild.name}`);
      return false;
    }

    const template =
      config.templates.find((t) => t.name === config.activeTemplateName) ||
      config.templates[0] ||
      getDefaultTemplate();

    const { embed, files } = buildWelcomeEmbed(template, member);

    await channel.send({
      content: `<@${member.id}>`,
      embeds: [embed],
      files,
    });

    console.log(`[WELCOME] Sent welcome message for ${member.user.tag} in #${channel.name}`);
    return true;
  } catch (error) {
    console.error(`[WELCOME] Failed to send welcome message:`, error);
    return false;
  }
}
