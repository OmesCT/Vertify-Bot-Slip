# Discord Slip Verification Bot (`bot-vertify-slip`)

บอท Discord สำหรับร้านค้าในระบบ Ticket ที่ต้องการสร้างคำสั่งซื้อและตรวจสอบสลิปโอนเงินอัตโนมัติ **ขับเคลื่อนด้วย Google Gemini 2.5 Flash Vision Engine ร่วมกับ Mini QR Code Decoding** และจัดเก็บข้อมูลใน MongoDB Atlas

## ฟีเจอร์หลัก
1. **Admin Order Management (`/order create`, `/order list`)**:
   - แอดมินระบุลูกค้าเจ้าของออเดอร์
   - ป๊อปอัป Modal ให้กรอกรายการสินค้าและยอดเงิน
   - แสดง Embed สรุปคำสั่งซื้อใน Ticket พร้อมรหัสคำสั่งซื้อ
   - **ระบบจัดการเมื่อมีออเดอร์ค้าง (Conflict Resolution)**:
     - แอดมินเลือกกด **รวมยอดเงิน (Merge)** เอายอดเดิม + ยอดใหม่รวมกัน
     - หรือเลือก **แทนที่ (Replace)** ยกเลิกอันเดิมแล้วตั้งยอดใหม่
2. **AI Slip Verification (Gemini 2.5 Flash + QR Decoder)**:
   - ตรวจจับเมื่อมีลูกค้าอัพโหลดรูปภาพสลิปในห้อง Ticket (`ticket-xxxx`)
   - อ่านยอดเงิน, ธนาคาร, วันที่/เวลา, รหัสอ้างอิงธุรกรรมเต็ม และชื่อผู้โอนแม่นยำ 100%
   - ตรวจสอบชื่อบัญชีร้านปลายทาง (`นาย ณัฐธชนพงศ์ ไชยศรี` / บัญชีลงท้าย `0707`)
   - สแกน Mini QR Code ทำ SHA-256 Hash ป้องกันการนำสลิปเดิมมาใช้ซ้ำ (Duplicate Check)
   - **ระบบตรวจสอบวันหมดอายุของสลิป**: ป้องกันการนำสลิปเก่าข้ามวันมาใช้ (กำหนดอายุสลิปได้ เช่น 24 ชม.)
3. **ระบบบันทึกการชำระเงิน (Payment Log)**:
   - บันทึกประวัติและส่งข้อมูลสรุปครบถ้วนพร้อมรูปภาพสลิปจริงเข้าห้อง Log ที่กำหนดทันที

---

## การติดตั้งและใช้งาน

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. ตั้งค่าไฟล์ `.env`
คัดลอกไฟล์ `.env.example` เป็น `.env` แล้วระบุค่า:
```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_guild_id_optional
MONGODB_URI=your_mongodb_connection_string
ADMIN_ROLE_ID=your_admin_role_id_optional
RECEIVER_KEYWORDS=ณัฐธชนพงศ์,ไชยศรี,GD SHOP,0707
LOG_CHANNEL_ID=your_log_channel_id
GEMINI_API_KEY=your_gemini_api_key
SLIP_MAX_AGE_MINUTES=1440
```

### 3. ลงทะเบียน Slash Commands
```bash
npm run deploy-commands
```

### 4. รันบอท
- **Development**:
  ```bash
  npm run dev
  ```
- **Production (Build & Start)**:
  ```bash
  npm run build
  npm start
  ```
