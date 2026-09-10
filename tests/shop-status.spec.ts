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
    const openButton = page.getByRole("button", { name: /เปิดร้าน/i }).last();
    const closeButton = page.getByRole("button", { name: /ปิดร้าน/i }).last();

    // Verify both buttons are visible
    await expect(openButton).toBeVisible({ timeout: 15000 });
    await expect(closeButton).toBeVisible({ timeout: 15000 });
    console.log("[TEST] Shop control buttons found successfully!");

    // 4. Test clicking a button (click Open)
    console.log("[TEST] Clicking 'เปิดร้าน (Open)' button...");
    await openButton.click();

    // 5. Verify interaction response or updated embed appears
    await page.waitForTimeout(2000);
    const embedArticle = page.locator('article:has-text("แผงควบคุม"), article:has-text("สถานะปัจจุบัน")');
    await expect(embedArticle.last()).toBeVisible({ timeout: 10000 });
    console.log("[TEST] Status embed updated and visible!");
  });
});
