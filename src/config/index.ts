import dotenv from "dotenv";
dotenv.config();

export const config = {
  discordToken: process.env.DISCORD_TOKEN || "",
  clientId: process.env.CLIENT_ID || "",
  guildId: process.env.GUILD_ID || "",
  mongoUri: process.env.MONGODB_URI || "",
  adminRoleId: process.env.ADMIN_ROLE_ID || "",
  receiverKeywords: process.env.RECEIVER_KEYWORDS || "ณัฐธชนพงศ์,ไชยศรี,GD SHOP,0707",
  logChannelId: process.env.LOG_CHANNEL_ID || "1546797445248188486",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  // Maximum age of slip in minutes (default: 1440 minutes = 24 hours)
  slipMaxAgeMinutes: parseInt(process.env.SLIP_MAX_AGE_MINUTES || "1440", 10),
};

export function validateConfig(): void {
  const missing: string[] = [];
  if (!config.discordToken) missing.push("DISCORD_TOKEN");
  if (!config.clientId) missing.push("CLIENT_ID");
  if (!config.mongoUri) missing.push("MONGODB_URI");

  if (missing.length > 0) {
    console.warn(`[WARNING] Missing environment variables: ${missing.join(", ")}`);
  }
}
