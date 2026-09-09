/**
 * Google Apps Script for Discord Order & Slip Bot
 * วางโค้ดนี้ใน Google Sheets: Extensions (ส่วนขยาย) > Apps Script
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var contents = e.postData.contents;
    var data = JSON.parse(contents);

    var START_ROW = 6; // ข้อมูลเริ่มแถวที่ 6
    var lastRow = sheet.getLastRow();
    var targetRow = -1;

    // ค้นหาว่ามี orderId นี้ใน Column B (แถว 6 เป็นต้นไป) หรือยัง
    if (lastRow >= START_ROW) {
      var orderIds = sheet.getRange(START_ROW, 2, lastRow - START_ROW + 1, 1).getValues();
      for (var i = 0; i < orderIds.length; i++) {
        if (orderIds[i][0] && orderIds[i][0].toString() === data.orderId.toString()) {
          targetRow = START_ROW + i;
          break;
        }
      }
    }

    var rowValues = [
      data.orderId || "",
      data.channelId ? "'" + data.channelId : "",
      data.guildId ? "'" + data.guildId : "",
      data.customerId ? "'" + data.customerId : "",
      data.items || "",
      data.amount || 0,
      data.status || "pending",
      data.slipRef ? "'" + data.slipRef : "",
      data.slipPayload || "",
      data.createdBy ? "'" + data.createdBy : "",
      data.paidAt || "",
      data.createdAt || "",
      data.updatedAt || ""
    ];

    if (targetRow !== -1) {
      // อัปเดตแถวเดิมที่มีอยู่แล้ว (Columns B ถึง N = 13 คอลัมน์)
      sheet.getRange(targetRow, 2, 1, 13).setValues([rowValues]);
    } else {
      // เพิ่มแถวใหม่ต่อท้าย
      var insertRow = Math.max(lastRow + 1, START_ROW);
      sheet.getRange(insertRow, 2, 1, 13).setValues([rowValues]);
    }

    return ContentService.createTextOutput(
      JSON.stringify({ status: "success", orderId: data.orderId })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
