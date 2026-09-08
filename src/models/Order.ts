import mongoose, { Schema, Document } from "mongoose";

export interface IOrder extends Document {
  orderId: string;
  channelId: string;
  guildId: string;
  customerId: string;
  items: string;
  amount: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  slipRef?: string;
  slipPayload?: any;
  createdBy: string;
  createdAt: Date;
  paidAt?: Date;
}

const OrderSchema: Schema = new Schema(
  {
    orderId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true, index: true },
    guildId: { type: String, required: true },
    customerId: { type: String, required: true },
    items: { type: String, required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    slipRef: { type: String, sparse: true, index: true },
    slipPayload: { type: Schema.Types.Mixed },
    createdBy: { type: String, required: true },
    paidAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

export const Order = mongoose.model<IOrder>("Order", OrderSchema);
