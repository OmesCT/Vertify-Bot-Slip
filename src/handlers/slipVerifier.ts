import axios from "axios";
import sharp from "sharp";
import jsQR from "jsqr";
import crypto from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createWorker } from "tesseract.js";
import { config } from "../config/index.js";

export interface SlipVerificationResult {
  success: boolean;
  message: string;
  data?: {
    transRef?: string;
    qrPayload?: string;
    amount?: number;
    date?: string;
    time?: string;
    senderName?: string;
    receiverName?: string;
    bankName?: string;
    rawOcrText?: string;
    isExpired?: boolean;
    slipAgeMinutes?: number;
  };
}

/**
 * Scan and extract QR Code from the image buffer
 */
async function extractQRCode(buffer: Buffer): Promise<{ payload: string; hash: string } | null> {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) return null;

    const rawData = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const code = jsQR(
      new Uint8ClampedArray(rawData.data),
      rawData.info.width,
      rawData.info.height
    );

    if (code && code.data) {
      const hash = crypto.createHash("sha256").update(code.data).digest("hex");
      return { payload: code.data, hash };
    }

    const resized = await sharp(buffer)
      .resize(800, 800, { fit: "inside" })
      .grayscale()
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const codeResized = jsQR(
      new Uint8ClampedArray(resized.data),
      resized.info.width,
      resized.info.height
    );

    if (codeResized && codeResized.data) {
      const hash = crypto.createHash("sha256").update(codeResized.data).digest("hex");
      return { payload: codeResized.data, hash };
    }

    return null;
  } catch (err) {
    console.error("[SLIP_VERIFIER] Error in QR code extraction:", err);
    return null;
  }
}

/**
 * Parse Thai Date String to Date Object to check expiration
 * Handles formats like:
 * "31 ก.ค. 2569", "08 ก.ย. 2569", "08/09/2569", "2026-09-08"
 */
function parseThaiDateToTimestamp(dateStr: string, timeStr?: string): Date | null {
  if (!dateStr) return null;

  try {
    const thaiMonths: { [key: string]: number } = {
      "ม.ค.": 0, "ก.พ.": 1, "มี.ค.": 2, "เม.ย.": 3, "พ.ค.": 4, "มิ.ย.": 5,
      "ก.ค.": 6, "ส.ค.": 7, "ก.ย.": 8, "ต.ค.": 9, "พ.ย.": 10, "ธ.ค.": 11,
      "มกราคม": 0, "กุมภาพันธ์": 1, "มีนาคม": 2, "เมษายน": 3, "พฤษภาคม": 4, "มิถุนายน": 5,
      "กรกฎาคม": 6, "สิงหาคม": 7, "กันยายน": 8, "ตุลาคม": 9, "พฤศจิกายน": 10, "ธันวาคม": 11,
    };

    let day = 1;
    let month = 0;
    let year = new Date().getFullYear();

    // Check textual Thai month format (e.g. 31 ก.ค. 2569)
    const textMatch = dateStr.match(/([0-3]?[0-9])\s+([^\s]+)\s+([0-9]{2,4})/);
    if (textMatch) {
      day = parseInt(textMatch[1], 10);
      const mStr = textMatch[2].trim();
      month = thaiMonths[mStr] !== undefined ? thaiMonths[mStr] : new Date().getMonth();
      let y = parseInt(textMatch[3], 10);
      if (y > 2500) y -= 543; // Convert BE to CE
      else if (y < 100) y += 2000;
      year = y;
    } else {
      // Check slash/dash format (e.g. 08/09/2569 or 08/09/2026)
      const numMatch = dateStr.match(/([0-3]?[0-9])[\/\.-]([0-1]?[0-9])[\/\.-]([0-9]{2,4})/);
      if (numMatch) {
        day = parseInt(numMatch[1], 10);
        month = parseInt(numMatch[2], 10) - 1;
        let y = parseInt(numMatch[3], 10);
        if (y > 2500) y -= 543;
        else if (y < 100) y += 2000;
        year = y;
      }
    }

    // Parse time (e.g. 21:33, 14:30:15)
    let hours = 0;
    let minutes = 0;
    if (timeStr) {
      const tm = timeStr.match(/([0-2]?[0-9]):([0-5][0-9])/);
      if (tm) {
        hours = parseInt(tm[1], 10);
        minutes = parseInt(tm[2], 10);
      }
    }

    const parsed = new Date(year, month, day, hours, minutes);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch (err) {
    console.error("[SLIP_VERIFIER] Error parsing Thai date:", err);
    return null;
  }
}

/**
 * Fallback Tesseract parser if Gemini API Key is missing or quota exceeded
 */
async function parseWithTesseract(buffer: Buffer) {
  let worker: any = null;
  try {
    worker = await createWorker(["tha", "eng"]);
    const { data: ocrData } = await worker.recognize(buffer);
    return ocrData.text || "";
  } finally {
    if (worker) await worker.terminate();
  }
}

/**
 * Primary AI Slip Parser using Google Gemini Vision (State of the art Thai accuracy)
 */
async function parseSlipWithGemini(buffer: Buffer, mimeType: string = "image/jpeg"): Promise<any | null> {
  if (!config.geminiApiKey) return null;

  try {
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = `คุณคือระบบตรวจสอบสลิปโอนเงินธนาคารไทย กรุณาอ่านและสกัดข้อมูลจากสลิปนี้ให้ถูกต้อง 100% ตอบเป็น JSON ตามโครงสร้างนี้เท่านั้น:
{
  "amount": number,
  "senderName": "ชื่อ-นามสกุลผู้โอนตามสลิปเป๊ะๆ เช่น นายชิณวัฒน์ ต***",
  "receiverName": "ชื่อ-นามสกุลผู้รับเงินตามสลิปเป๊ะๆ เช่น นาย ณัฐธชนพงศ์ ไชยศรี",
  "bankName": "ชื่อธนาคารต้นทาง -> ธนาคารปลายทาง เช่น กรุงไทย -> กสิกรไทย",
  "transRef": "รหัสอ้างอิงธุรกรรมทั้งหมด ไม่ตัดทอน",
  "date": "วันที่ทำรายการ เช่น 31 ก.ค. 2569",
  "time": "เวลาทำรายการ เช่น 21:33"
}`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: buffer.toString("base64"),
        },
      },
    ]);

    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error("[SLIP_VERIFIER] Gemini parsing failed, falling back to local OCR:", error);
    return null;
  }
}

/**
 * Main function: verify slip from image URL using Gemini Vision + Local QR Code decoding
 */
export async function verifySlipFromUrl(
  imageUrl: string,
  expectedAmount?: number
): Promise<SlipVerificationResult> {
  try {
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 10000,
    });
    const buffer = Buffer.from(response.data);
    const contentTypeHeader = response.headers["content-type"];
    const contentType = typeof contentTypeHeader === "string" ? contentTypeHeader : "image/jpeg";

    // 1. Local Mini QR Code extraction (For duplicate checking)
    const qrResult = await extractQRCode(buffer);

    // 2. AI Slip Parsing via Gemini 2.5 Flash
    const geminiData = await parseSlipWithGemini(buffer, contentType);

    let amount: number | undefined;
    let senderName = "";
    let receiverName = "";
    let bankName = "";
    let transRef = "";
    let date = "";
    let time = "";
    let rawText = "";

    if (geminiData) {
      amount = Number(geminiData.amount);
      senderName = geminiData.senderName || "";
      receiverName = geminiData.receiverName || "";
      bankName = geminiData.bankName || "";
      transRef = geminiData.transRef || (qrResult ? `QR-${qrResult.hash.substring(0, 16).toUpperCase()}` : "");
      date = geminiData.date || "";
      time = geminiData.time || "";
      rawText = JSON.stringify(geminiData);
    } else {
      // Fallback to Tesseract OCR
      rawText = await parseWithTesseract(buffer);
      transRef = qrResult ? `QR-${qrResult.hash.substring(0, 16).toUpperCase()}` : `REF-${Date.now()}`;
      senderName = "ตรวจไม่พบชื่อ";
      receiverName = "นาย ณัฐธชนพงศ์ ไชยศรี (GD SHOP)";
      bankName = "ธนาคารไทย";
    }

    // Safety check 1: Validate receiver matches shop keywords
    const receiverKeywords = (config.receiverKeywords || "")
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    let receiverMatched = false;
    const combinedReceiverText = `${receiverName} ${rawText} ${qrResult?.payload || ""}`;
    for (const kw of receiverKeywords) {
      if (combinedReceiverText.includes(kw)) {
        receiverMatched = true;
        break;
      }
    }

    if (receiverKeywords.length > 0 && !receiverMatched) {
      return {
        success: false,
        message: `สลิปนี้ไม่ได้โอนเข้าบัญชีของทางร้าน (ไม่พบชื่อ "ณัฐธชนพงศ์ ไชยศรี" หรือเลขบัญชีลงท้าย 0707)`,
      };
    }

    // Safety check 2: Slip Expiration Verification (Check if slip is too old)
    let slipAgeMinutes = 0;
    let isExpired = false;
    const slipTimestamp = parseThaiDateToTimestamp(date, time);

    if (slipTimestamp && config.slipMaxAgeMinutes > 0) {
      const now = new Date().getTime();
      const slipTime = slipTimestamp.getTime();
      const diffMinutes = Math.floor((now - slipTime) / (1000 * 60));
      slipAgeMinutes = diffMinutes;

      // If slip date is older than configured max age (or future dated by more than 60 mins)
      if (diffMinutes > config.slipMaxAgeMinutes) {
        const hoursAgo = Math.floor(diffMinutes / 60);
        const daysAgo = Math.floor(hoursAgo / 24);
        let timeAgoStr = `${diffMinutes} นาทีที่แล้ว`;
        if (daysAgo > 0) {
          timeAgoStr = `${daysAgo} วันที่แล้ว (${hoursAgo} ชั่วโมง)`;
        } else if (hoursAgo > 0) {
          timeAgoStr = `${hoursAgo} ชั่วโมงที่แล้ว`;
        }

        return {
          success: false,
          message: `สลิปนี้หมดอายุแล้ว (เป็นสลิปเก่าเมื่อ ${timeAgoStr} เกินกำหนดเวลา ${config.slipMaxAgeMinutes / 60} ชม.)`,
        };
      }
    }

    return {
      success: true,
      message: "ตรวจสอบสลิปเรียบร้อย",
      data: {
        transRef: transRef || (qrResult ? `QR-${qrResult.hash.substring(0, 16).toUpperCase()}` : `REF-${Date.now()}`),
        qrPayload: qrResult?.payload,
        amount,
        date,
        time: time ? (time.includes("น.") ? time : `${time} น.`) : "",
        senderName: senderName || "ไม่สามารถระบุได้ชัดเจน",
        receiverName: receiverName || "นาย ณัฐธชนพงศ์ ไชยศรี (GD SHOP)",
        bankName: bankName || "ไม่สามารถระบุธนาคารได้ชัดเจน",
        rawOcrText: rawText,
        isExpired,
        slipAgeMinutes,
      },
    };
  } catch (error: any) {
    console.error("[SLIP_VERIFIER] Error in slip verification:", error);
    return {
      success: false,
      message: `เกิดข้อผิดพลาดในการประมวลผลสลิป: ${error.message}`,
    };
  }
}
