import mongoose, { Schema, Document } from "mongoose";

export interface IShopStatus extends Document {
  guildId: string;
  isOpen: boolean;
  statusChannelId?: string; // Channel at the top showing status
  controlChannelId?: string; // Channel in log-zone with buttons
  controlMessageId?: string;
  statusMessageId?: string;
  updatedBy?: string;
  updatedAt: Date;
}

const ShopStatusSchema: Schema = new Schema(
  {
    guildId: { type: String, required: true, unique: true },
    isOpen: { type: Boolean, default: true },
    statusChannelId: { type: String },
    controlChannelId: { type: String },
    controlMessageId: { type: String },
    statusMessageId: { type: String },
    updatedBy: { type: String },
  },
  {
    timestamps: true,
  }
);

export const ShopStatus = mongoose.model<IShopStatus>("ShopStatus", ShopStatusSchema);
