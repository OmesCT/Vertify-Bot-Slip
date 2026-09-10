import { test, expect } from "@playwright/test";
import path from "path";

const GUILD_ID = "1546539675051892836";
const LOG_PAYMENT_CHANNEL_ID = "1546797445248188486";

test.describe("Discord Slip Verification & Payment Log", () => {
  test("verify payment log channel displays verified slips", async ({ page }) => {
    // 1. Navigate to log-payment channel
    const channelUrl = `https://discord.com/channels/${GUILD_ID}/${LOG_PAYMENT_CHANNEL_ID}`;
    console.log(`[TEST] Navigating to log-payment: ${channelUrl}`);
    await page.goto(channelUrl);

    // 2. Wait for messages
    await page.waitForSelector('main[class*="chatContent"], [data-list-id="chat-messages"]', {
      timeout: 30000,
    });

    // 3. Verify slip log embed
    const logEmbed = page.locator('article:has-text("บันทึกการชำระเงิน")');
    await expect(logEmbed.first()).toBeVisible({ timeout: 15000 });
    console.log("[TEST] Verified payment log embeds are displayed correctly!");
  });
});
