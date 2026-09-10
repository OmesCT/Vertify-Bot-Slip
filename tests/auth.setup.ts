import { test as setup, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const authDir = path.join(__dirname, "../.auth");
const authFile = path.join(authDir, "user.json");

setup("authenticate discord user", async ({ page }) => {
  setup.setTimeout(120000);

  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // If auth file exists, verify if session is still valid
  if (fs.existsSync(authFile)) {
    try {
      await page.goto("https://discord.com/channels/@me");
      await page.waitForURL(/.*discord\.com\/channels\/.*/, { timeout: 8000 });
      console.log("[AUTH] Session already authenticated and valid!");
      return;
    } catch {
      console.log("[AUTH] Existing session expired or invalid. Re-authenticating...");
    }
  }

  console.log("\n=======================================================");
  console.log("[AUTH] กรุณาสแกน QR Code หรือ Login Discord ในหน้าต่าง Browser");
  console.log("=======================================================\n");

  await page.goto("https://discord.com/login");

  // Wait until user logs in and gets redirected to channels
  await page.waitForURL(/.*discord\.com\/channels\/.*/, { timeout: 100000 });
  await page.waitForTimeout(3000);

  // Save authenticated state
  await page.context().storageState({ path: authFile });
  console.log("[AUTH] Authentication successful! Saved session to .auth/user.json");
});
