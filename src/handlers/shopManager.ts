import {
  Guild,
  ChannelType,
  TextChannel,
  CategoryChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { ShopStatus } from "../models/ShopStatus.js";

const CATEGORY_NAME = "log-zone";

export function getShopStatusChannelName(isOpen: boolean): string {
  return isOpen ? "🟢-ꜱᴛᴀᴛᴜꜱ" : "🔴-ꜱᴛᴀᴛᴜꜱ";
}

export function createShopDisplayEmbed(isOpen: boolean): EmbedBuilder {
  const color = isOpen ? 0x2ecc71 : 0xe74c3c;
  const statusTitle = isOpen ? "🟢 GTO SHOP — เปิดให้บริการ (ONLINE)" : "🔴 GTO SHOP — ปิดให้บริการชั่วคราว (OFFLINE)";
  const desc = isOpen
    ? "ยินดีต้อนรับสู่ **GTO SHOP** ขณะนี้ร้านเปิดให้บริการตามปกติ สามารถเปิด Ticket เพื่อติดต่อหรือสั่งซื้อสินค้าได้ตลอดเวลาครับ"
    : "ขณะนี้ร้าน **GTO SHOP** ปิดให้บริการชั่วคราว แอดมินกำลังพักผ่อนหรือติดภารกิจ สามารถเปิด Ticket ทิ้งไว้ได้ครับ";

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(statusTitle)
    .setDescription(`${desc}\n\n**อัปเดตล่าสุด**: <t:${Math.floor(Date.now() / 1000)}:R>`)
    .setFooter({ text: "GTO SHOP Official Status" })
    .setTimestamp();
}

export function createShopControlEmbed(isOpen: boolean, updatedBy?: string): EmbedBuilder {
  const color = isOpen ? 0x2ecc71 : 0xe74c3c;
  return new EmbedBuilder()
    .setColor(color)
    .setTitle("แผงควบคุมสถานะร้านค้า (Shop Control Panel)")
    .setDescription(
      `ห้องนี้สำหรับแอดมินใช้ควบคุมการเปิด/ปิดร้าน\n\n**สถานะปัจจุบัน**: ${
        isOpen ? "🟢 เปิดร้าน (OPEN)" : "🔴 ปิดร้าน (CLOSED)"
      }`
    )
    .addFields(
      {
        name: "อัปเดตล่าสุด",
        value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
        inline: true,
      },
      {
        name: "ผู้เปลี่ยนสถานะล่าสุด",
        value: updatedBy ? `<@${updatedBy}>` : "ระบบอัตโนมัติ",
        inline: true,
      }
    )
    .setFooter({ text: "กดปุ่มด้านล่างเพื่อสลับสถานะเปิด/ปิดร้านได้ทันที" })
    .setTimestamp();
}

export function createShopControlButtons(): ActionRowBuilder<ButtonBuilder> {
  const openBtn = new ButtonBuilder()
    .setCustomId("shop_toggle_open")
    .setLabel("เปิดร้าน (Open)")
    .setStyle(ButtonStyle.Success);

  const closeBtn = new ButtonBuilder()
    .setCustomId("shop_toggle_close")
    .setLabel("ปิดร้าน (Close)")
    .setStyle(ButtonStyle.Danger);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(openBtn, closeBtn);
}

/**
 * Setup both:
 * 1. Status Channel at the very top (No category, position 0, view only)
 * 2. Control Channel inside 'log-zone' category with action buttons
 */
export async function setupShopStatusChannel(guild: Guild): Promise<void> {
  try {
    let statusDoc = await ShopStatus.findOne({ guildId: guild.id });
    if (!statusDoc) {
      statusDoc = new ShopStatus({ guildId: guild.id, isOpen: true });
      await statusDoc.save();
    }

    const channels = await guild.channels.fetch();

    // 1. Setup Status Display Channel at the VERY TOP
    const targetStatusName = getShopStatusChannelName(statusDoc.isOpen);
    let statusChannel = channels.find(
      (c) =>
        c &&
        c.type === ChannelType.GuildText &&
        (c.id === statusDoc?.statusChannelId ||
          c.name.includes("gto-shop-status") ||
          c.name.includes("ꜱᴛᴀᴛᴜꜱ") ||
          c.name.toLowerCase().includes("status"))
    ) as TextChannel | undefined;

    if (!statusChannel) {
      statusChannel = await guild.channels.create({
        name: targetStatusName,
        type: ChannelType.GuildText,
        position: 0,
        topic: "GTO SHOP Status (Auto Updated)",
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
            deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions],
          },
        ],
      });
      console.log(`[SHOP] Created top status channel in guild ${guild.name}`);
    } else {
      if (statusChannel.parentId !== null) {
        await statusChannel.setParent(null).catch(() => {});
      }
      await statusChannel.setPosition(0).catch(() => {});
      if (statusChannel.name !== targetStatusName) {
        statusChannel.setName(targetStatusName).catch((e) => {
          console.warn("[SHOP] Rate limit notice for channel rename on setup:", e.message);
        });
      }
    }

    statusDoc.statusChannelId = statusChannel.id;

    // Send or update embed in Top Status Channel
    let statusMsgFound = false;
    if (statusDoc.statusMessageId) {
      try {
        const msg = await statusChannel.messages.fetch(statusDoc.statusMessageId);
        if (msg) {
          await msg.edit({
            embeds: [createShopDisplayEmbed(statusDoc.isOpen)],
            components: [],
          });
          statusMsgFound = true;
        }
      } catch {
        statusMsgFound = false;
      }
    }

    if (!statusMsgFound) {
      const newMsg = await statusChannel.send({
        embeds: [createShopDisplayEmbed(statusDoc.isOpen)],
      });
      statusDoc.statusMessageId = newMsg.id;
    }

    // 2. Setup Control Channel in 'log-zone' category with buttons
    let logZoneCategory = channels.find(
      (c) => c && c.type === ChannelType.GuildCategory && c.name.toLowerCase() === CATEGORY_NAME
    ) as CategoryChannel | undefined;

    if (!logZoneCategory) {
      logZoneCategory = await guild.channels.create({
        name: CATEGORY_NAME,
        type: ChannelType.GuildCategory,
      });
    }

    let controlChannel = channels.find(
      (c) =>
        c &&
        c.type === ChannelType.GuildText &&
        (c.id === statusDoc?.controlChannelId || c.name === "shop-control-panel")
    ) as TextChannel | undefined;

    if (!controlChannel) {
      controlChannel = await guild.channels.create({
        name: "shop-control-panel",
        type: ChannelType.GuildText,
        parent: logZoneCategory.id,
        topic: "แผงควบคุมเปิด-ปิดร้านสำหรับแอดมิน",
      });
      await controlChannel.lockPermissions().catch(() => {});
      console.log(`[SHOP] Created shop-control-panel in log-zone for guild ${guild.name}`);
    } else {
      if (controlChannel.parentId !== logZoneCategory.id) {
        await controlChannel.setParent(logZoneCategory.id, { lockPermissions: true }).catch(() => {});
      }
    }

    statusDoc.controlChannelId = controlChannel.id;

    // Send or update Control Panel message with buttons
    let controlMsgFound = false;
    if (statusDoc.controlMessageId) {
      try {
        const msg = await controlChannel.messages.fetch(statusDoc.controlMessageId);
        if (msg) {
          await msg.edit({
            embeds: [createShopControlEmbed(statusDoc.isOpen, statusDoc.updatedBy)],
            components: [createShopControlButtons()],
          });
          controlMsgFound = true;
        }
      } catch {
        controlMsgFound = false;
      }
    }

    if (!controlMsgFound) {
      const newMsg = await controlChannel.send({
        embeds: [createShopControlEmbed(statusDoc.isOpen, statusDoc.updatedBy)],
        components: [createShopControlButtons()],
      });
      statusDoc.controlMessageId = newMsg.id;
    }

    await statusDoc.save();
  } catch (err) {
    console.error("[SHOP] Error in setupShopStatusChannel:", err);
  }
}

/**
 * Toggle shop status (open/close) with instant non-blocking response
 */
export async function toggleShopStatus(
  guild: Guild,
  isOpen: boolean,
  userId: string
): Promise<{ success: boolean; message: string }> {
  try {
    let statusDoc = await ShopStatus.findOne({ guildId: guild.id });
    if (!statusDoc) {
      statusDoc = new ShopStatus({ guildId: guild.id, isOpen });
    }

    if (statusDoc.isOpen === isOpen) {
      return {
        success: false,
        message: `ร้านอยู่ในสถานะ **${isOpen ? "เปิด" : "ปิด"}** อยู่แล้ว`,
      };
    }

    statusDoc.isOpen = isOpen;
    statusDoc.updatedBy = userId;
    await statusDoc.save();

    // Async background update of Discord channels & embeds to prevent interaction timeout
    (async () => {
      // 1. Update Top Status Channel Name and Embed
      if (statusDoc.statusChannelId) {
        let statusCh = guild.channels.cache.get(statusDoc.statusChannelId) as TextChannel | undefined;
        if (!statusCh) {
          statusCh = (await guild.channels.fetch(statusDoc.statusChannelId).catch(() => null)) as TextChannel | undefined;
        }
        if (statusCh) {
          const newName = getShopStatusChannelName(isOpen);
          // Set channel name in background (Discord rate limits channel renames to 2 times per 10 mins)
          if (statusCh.name !== newName) {
            statusCh.setName(newName).catch((e) => {
              console.warn("[SHOP] Rate limit notice for channel rename:", e.message);
            });
          }

          if (statusDoc.statusMessageId) {
            statusCh.messages.fetch(statusDoc.statusMessageId)
              .then((msg) => msg.edit({ embeds: [createShopDisplayEmbed(isOpen)] }))
              .catch(() => {});
          }
        } else {
          await setupShopStatusChannel(guild);
        }
      } else {
        await setupShopStatusChannel(guild);
      }

      // 2. Update Control Channel Embed in log-zone
      if (statusDoc.controlChannelId && statusDoc.controlMessageId) {
        let controlCh = guild.channels.cache.get(statusDoc.controlChannelId) as TextChannel | undefined;
        if (!controlCh) {
          controlCh = (await guild.channels.fetch(statusDoc.controlChannelId).catch(() => null)) as TextChannel | undefined;
        }
        if (controlCh) {
          controlCh.messages.fetch(statusDoc.controlMessageId)
            .then((msg) =>
              msg.edit({
                embeds: [createShopControlEmbed(isOpen, userId)],
                components: [createShopControlButtons()],
              })
            )
            .catch(() => {});
        } else {
          await setupShopStatusChannel(guild);
        }
      }
    })().catch((bgErr) => console.error("[SHOP] Background update error:", bgErr));

    return {
      success: true,
      message: `เปลี่ยนสถานะร้านเป็น **${isOpen ? "🟢 เปิดร้าน" : "🔴 ปิดร้าน"}** เรียบร้อยแล้ว`,
    };
  } catch (err: any) {
    console.error("[SHOP] Error toggling shop status:", err);
    return { success: false, message: `เกิดข้อผิดพลาด: ${err.message}` };
  }
}
