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

client.once("ready", () => handleReady(client));
client.on("interactionCreate", (interaction) => handleInteractionCreate(interaction));
client.on("messageCreate", (message) => handleMessageCreate(message));

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
