import { Client } from "discord.js";
import { setupShopStatusChannel } from "../handlers/shopManager.js";

export async function handleReady(client: Client): Promise<void> {
  console.log(`[BOT] Logged in as ${client.user?.tag}! Bot is ready.`);

  // Auto initialize Shop Status Channel for all guilds
  for (const guild of client.guilds.cache.values()) {
    try {
      await setupShopStatusChannel(guild);
    } catch (err) {
      console.error(`[READY] Error setting up shop status for guild ${guild.name}:`, err);
    }
  }
}
