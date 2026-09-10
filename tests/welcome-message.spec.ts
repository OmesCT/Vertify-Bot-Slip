import { test, expect } from "@playwright/test";

const GUILD_ID = "1546539675051892836";
const WELCOME_CHANNEL_ID = "1546765150676324432";

test.describe("Discord Welcome Message System", () => {
  test("verify welcome message embed is displayed in welcome channel", async ({ page }) => {
    // 1. Navigate to ᴡᴇʟᴄᴏᴍᴇ-ɪɴ channel
    const channelUrl = `https://discord.com/channels/${GUILD_ID}/${WELCOME_CHANNEL_ID}`;
    console.log(`[TEST] Navigating to welcome channel: ${channelUrl}`);
    await page.goto(channelUrl);

    // 2. Wait for messages to load
    await page.waitForSelector('main[class*="chatContent"], [data-list-id="chat-messages"]', {
      timeout: 30000,
    });
    console.log("[TEST] Welcome channel chat loaded.");

    // 3. Locate welcome embed
    const welcomeEmbed = page.locator('article:has-text("ยินดีต้อนรับสู่ร้านครับ")').last();
    await expect(welcomeEmbed).toBeVisible({ timeout: 15000 });
    console.log("[TEST] Welcome embed found!");

    // 4. Verify channel links and content inside description
    await expect(welcomeEmbed).toContainText("ขอบคุณที่สนใจร้านค้านะครับ");
    await expect(welcomeEmbed).toContainText("สามารถกดรับ Role");
    await expect(welcomeEmbed).toContainText("ดู Credit");
    console.log("[TEST] Welcome text and channel mentions verified!");

    // 5. Verify image attachment (cat banner) is displayed
    const embedImage = welcomeEmbed.locator("img").last();
    await expect(embedImage).toBeVisible({ timeout: 10000 });
    console.log("[TEST] Welcome cat banner image is displayed correctly!");
  });
});
