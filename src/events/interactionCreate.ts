import { Interaction } from "discord.js";
import {
  handleOrderCommand,
  handleOrderModalSubmit,
  handleOrderButton,
} from "../commands/order.js";

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "order") {
      await handleOrderCommand(interaction);
    }
  } else if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("order_modal_") || interaction.customId.startsWith("order_create_modal_")) {
      await handleOrderModalSubmit(interaction);
    }
  } else if (interaction.isButton()) {
    if (interaction.customId.startsWith("order_act_")) {
      await handleOrderButton(interaction);
    }
  }
}
