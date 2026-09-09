import { Order, IOrder } from "../models/Order.js";
import { syncOrderToSheet } from "./sheetsLogger.js";

export async function createOrder(data: {
  channelId: string;
  guildId: string;
  customerId: string;
  items: string;
  amount: number;
  createdBy: string;
}): Promise<IOrder> {
  const shortId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const orderId = `ORD-${Date.now().toString().slice(-4)}-${shortId}`;

  const order = new Order({
    orderId,
    ...data,
  });

  const savedOrder = await order.save();
  syncOrderToSheet(savedOrder, "create").catch(() => {});
  return savedOrder;
}

export async function getLatestPendingOrderByChannel(channelId: string): Promise<IOrder | null> {
  return await Order.findOne({
    channelId,
    status: "pending",
  }).sort({ createdAt: -1 });
}

export async function getAllPendingOrdersByChannel(channelId: string): Promise<IOrder[]> {
  return await Order.find({
    channelId,
    status: "pending",
  }).sort({ createdAt: -1 });
}

export async function cancelOrderByOrderId(orderId: string): Promise<IOrder | null> {
  const updated = await Order.findOneAndUpdate(
    { orderId },
    { status: "cancelled" },
    { new: true }
  );
  if (updated) syncOrderToSheet(updated, "update").catch(() => {});
  return updated;
}

export async function mergePendingOrder(
  orderId: string,
  additionalItems: string,
  additionalAmount: number
): Promise<IOrder | null> {
  const existing = await Order.findOne({ orderId, status: "pending" });
  if (!existing) return null;

  existing.items = `${existing.items}\n+ ${additionalItems}`;
  existing.amount = Number((existing.amount + additionalAmount).toFixed(2));
  const saved = await existing.save();
  syncOrderToSheet(saved, "update").catch(() => {});
  return saved;
}

export async function getOrderByOrderId(orderId: string): Promise<IOrder | null> {
  return await Order.findOne({ orderId });
}

export async function checkSlipRefUsed(slipRef: string): Promise<boolean> {
  const existing = await Order.findOne({ slipRef, status: "paid" });
  return !!existing;
}

export async function markOrderAsPaid(
  orderId: string,
  slipRef: string,
  slipPayload: any
): Promise<IOrder | null> {
  const updated = await Order.findOneAndUpdate(
    { orderId },
    {
      status: "paid",
      slipRef,
      slipPayload,
      paidAt: new Date(),
    },
    { new: true }
  );
  if (updated) syncOrderToSheet(updated, "update").catch(() => {});
  return updated;
}

export async function getOrdersByChannel(channelId: string): Promise<IOrder[]> {
  return await Order.find({ channelId }).sort({ createdAt: -1 });
}
