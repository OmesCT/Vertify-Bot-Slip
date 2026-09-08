import { Client } from "discord.js";

export function handleReady(client: Client): void {
  console.log(`[BOT] Logged in as ${client.user?.tag}! Bot is ready.`);
}
