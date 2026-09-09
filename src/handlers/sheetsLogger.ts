import axios from "axios";
import { config } from "../config/index.js";
import { IOrder } from "../models/Order.js";

export interface SheetPayload {
  action: "create" | "update";
  orderId: string;
  channelId: string;
  guildId: string;
  customerId: string;
  items: string;
  amount: number;
  status: string;
  slipRef: string;
  slipPayload: string;
  createdBy: string;
  paidAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Synchronize order information to Google Sheets via Webhook
 */
export async function syncOrderToSheet(
  order: IOrder,
  action: "create" | "update" = "create"
): Promise<void> {
  if (!config.googleSheetWebhookUrl) {
    return;
  }

  try {
    const payload: SheetPayload = {
      action,
      orderId: order.orderId,
      channelId: order.channelId,
      guildId: order.guildId,
      customerId: order.customerId,
      items: order.items,
      amount: order.amount,
      status: order.status,
      slipRef: order.slipRef || "",
      slipPayload: order.slipPayload
        ? typeof order.slipPayload === "string"
          ? order.slipPayload
          : JSON.stringify(order.slipPayload)
        : "",
      createdBy: order.createdBy,
      paidAt: order.paidAt ? new Date(order.paidAt).toLocaleString("th-TH") : "",
      createdAt: order.createdAt ? new Date(order.createdAt).toLocaleString("th-TH") : new Date().toLocaleString("th-TH"),
      updatedAt: order.updatedAt ? new Date(order.updatedAt).toLocaleString("th-TH") : new Date().toLocaleString("th-TH"),
    };

    await fetch(config.googleSheetWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    console.log(
      `[GOOGLE_SHEETS] Successfully synced order ${order.orderId} (${action}) to Google Sheets.`
    );
  } catch (error: any) {
    console.error(
      `[GOOGLE_SHEETS] Failed to sync order ${order.orderId} to Google Sheets:`,
      error?.message || error
    );
  }
}
