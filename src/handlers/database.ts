import mongoose from "mongoose";
import dns from "dns";
import { config } from "../config/index.js";

// Fix for Node.js on Windows failing to resolve MongoDB SRV records via local ISP DNS
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Ignore if not permitted
}

export async function connectDatabase(): Promise<void> {
  if (!config.mongoUri) {
    throw new Error("MONGODB_URI is not set in environment variables");
  }

  let attempts = 5;
  while (attempts > 0) {
    try {
      await mongoose.connect(config.mongoUri);
      console.log("[DATABASE] Connected successfully to MongoDB Atlas");
      return;
    } catch (error) {
      attempts--;
      console.error(`[DATABASE] Connection error (retries left: ${attempts}):`, error);
      if (attempts === 0) throw error;
      await new Promise((res) => setTimeout(res, 2000));
    }
  }
}
