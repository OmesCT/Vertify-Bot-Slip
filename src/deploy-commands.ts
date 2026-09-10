import { REST, Routes } from "discord.js";
import { config, validateConfig } from "./config/index.js";
import { data as orderCommandData } from "./commands/order.js";
import { getWelcomeCommandData } from "./commands/welcome.js";

validateConfig();

const commands = [orderCommandData.toJSON(), getWelcomeCommandData().toJSON()];

const rest = new REST({ version: "10" }).setToken(config.discordToken);

async function deploy() {
  try {
    console.log(`[DEPLOY] Registering ${commands.length} application (/) commands...`);

    if (config.guildId) {
      // Guild-specific registration (instant updates for testing)
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands }
      );
      console.log(`[DEPLOY] Successfully registered commands for Guild ID: ${config.guildId}`);
    } else {
      // Global registration
      await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands }
      );
      console.log(`[DEPLOY] Successfully registered global commands.`);
    }
  } catch (error) {
    console.error("[DEPLOY] Error registering commands:", error);
  }
}

deploy();
