import mongoose from "mongoose";
import { config } from "../config/index.js";

export async function connectDatabase(): Promise<void> {
  if (!config.mongoUri) {
    throw new Error("MONGODB_URI is not set in environment variables");
  }

  try {
    await mongoose.connect(config.mongoUri);
    console.log("[DATABASE] Connected successfully to MongoDB Atlas");
  } catch (error) {
    console.error("[DATABASE] Connection error:", error);
    throw error;
  }
}
