import { test, expect } from "@playwright/test";

const GUILD_ID = "1546539675051892836";
const CONTROL_CHANNEL_ID = "1547068912275820564";

test.describe("Discord Shop Status Control Panel", () => {
  test("verify control panel buttons are visible and clickable", async ({ page }) => {
    // 1. Navigate to shop-control-panel channel in GTO SHOP
    const channelUrl = `https://discord.com/channels/${GUILD_ID}/${CONTROL_CHANNEL_ID}`;
    console.log(`[TEST] Navigating to: ${channelUrl}`);
    await page.goto(channelUrl);

    // 2. Wait for Discord chat interface to load
    await page.waitForSelector('main[class*="chatContent"], [data-list-id="chat-messages"]', {
      timeout: 30000,
    });
    console.log("[TEST] Chat messages loaded.");

    // 3. Check for the Shop Control Panel buttons
    const openButton = page.locator('button:has-text("เปิดร้าน"), button:has-text("Open")').last();
    const closeButton = page.locator('button:has-text("ปิดร้าน"), button:has-text("Close")').last();

    // Verify at least one button exists
    await expect(openButton.or(closeButton)).toBeVisible({ timeout: 15000 });
    console.log("[TEST] Shop control buttons found successfully!");

    // 4. Test clicking a button (e.g. click Open or Close)
    if (await openButton.isVisible()) {
      console.log("[TEST] Clicking 'เปิดร้าน (Open)' button...");
      await openButton.click();
    } else {
      console.log("[TEST] Clicking 'ปิดร้าน (Close)' button...");
      await closeButton.click();
    }

    // 5. Verify interaction response or updated embed appears
    await page.waitForTimeout(3000);
    const embedTitle = page.locator('div[class*="embedTitle"]:has-text("GTO SHOP"), div[class*="embedTitle"]:has-text("แผงควบคุม")');
    await expect(embedTitle.first()).toBeVisible({ timeout: 10000 });
    console.log("[TEST] Status embed updated and visible!");
  });
});
