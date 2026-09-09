import { Client, GatewayIntentBits, Partials } from "discord.js";
import { config, validateConfig } from "./config/index.js";
import { connectDatabase } from "./handlers/database.js";
import { handleReady } from "./events/ready.js";
import { handleInteractionCreate } from "./events/interactionCreate.js";
import { handleMessageCreate } from "./events/messageCreate.js";

validateConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

import { setupShopStatusChannel } from "./handlers/shopManager.js";
import { ShopStatus } from "./models/ShopStatus.js";

client.once("ready", () => handleReady(client));
client.on("interactionCreate", (interaction) => handleInteractionCreate(interaction));
client.on("messageCreate", (message) => handleMessageCreate(message));
client.on("channelDelete", async (channel) => {
  if ("guild" in channel && channel.guild) {
    try {
      const statusDoc = await ShopStatus.findOne({ guildId: channel.guild.id });
      if (statusDoc && (channel.id === statusDoc.statusChannelId || channel.id === statusDoc.controlChannelId)) {
        console.log(`[SHOP] Shop channel was deleted (${channel.id}). Automatically re-creating...`);
        await setupShopStatusChannel(channel.guild);
      }
    } catch (err) {
      console.error("[SHOP] Error in channelDelete listener:", err);
    }
  }
});

async function main() {
  try {
    await connectDatabase();
    await client.login(config.discordToken);
  } catch (error) {
    console.error("[MAIN] Initialization failed:", error);
    process.exit(1);
  }
}

main();
