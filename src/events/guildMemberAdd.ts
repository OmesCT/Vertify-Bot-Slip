import { GuildMember } from "discord.js";
import { sendWelcomeMessage } from "../handlers/welcomeManager.js";

export async function handleGuildMemberAdd(member: GuildMember): Promise<void> {
  // Ignore bots joining
  if (member.user.bot) return;

  console.log(`[GUILD_MEMBER_ADD] New member joined: ${member.user.tag} (${member.id}) in ${member.guild.name}`);
  await sendWelcomeMessage(member);
}
