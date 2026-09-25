# BMS 3D — Design Review (Cloudflare Pages)

แยกไฟล์ `index.html` เดิม (ไฟล์เดียว 4.9 MB ที่ฝัง base64 ทุกหน้า) เป็น HTML / CSS / JS แยกกัน
และเพิ่มระบบ **คอมเมนต์แบบปักหมุด** ที่แนบรูป ใส่ข้อความ และลงวันที่ได้
เก็บข้อมูลใน **Cloudflare D1** (ข้อความ) + **R2** (รูป)

## โครงสร้างไฟล์

```
bms-3d-review/
├─ public/                      ← เว็บ static (Cloudflare Pages เสิร์ฟโฟลเดอร์นี้)
│  ├─ index.html                ← หน้าหลัก: เมนูซ้าย + viewer + แผงคอมเมนต์
│  ├─ assets/css/app.css
│  ├─ assets/js/app.js          ← สลับหน้า / โหลด iframe / deep link (#ct5-3d/c=<id>)
│  ├─ assets/js/api.js          ← ติดต่อ /api (มีโหมดทดลองเก็บใน browser ถ้าไม่มี backend)
│  ├─ assets/js/comments.js     ← ปักหมุด, ฟอร์ม, รายการคอมเมนต์, ภาพมุมมอง 3D
│  ├─ vendor/                   ← three.min.js, OrbitControls.js, doc-page.js (ใช้ร่วมกันทุกหน้า)
│  ├─ fonts/                    ← woff2 ที่เคยฝังในไฟล์
│  ├─ pages/
│  │  ├─ ct5-sheet/  index.html · style.css · img/*.png
│  │  ├─ ct5-3d/     index.html · style.css · fonts.css · main.js
│  │  ├─ ch-sheet/   …
│  │  ├─ ch-3d/      …
│  │  ├─ fcu-3d/     …
│  │  └─ oau-3d/     …
│  └─ _headers                  ← cache: vendor/fonts เก็บนาน, pages 5 นาที
├─ functions/api/               ← Cloudflare Pages Functions (backend)
│  ├─ _middleware.js            ← ตรวจ REVIEW_KEY (ถ้าตั้ง), จัดการ error
│  ├─ comments/index.js         ← GET รายการ / POST คอมเมนต์ใหม่ (multipart + รูป)
│  ├─ comments/[id].js          ← PATCH สถานะ (open/done) / DELETE
│  └─ img/[[path]].js           ← ส่งรูปจาก R2
├─ lib/review.js                ← helper ที่ functions ใช้ร่วมกัน
├─ schema.sql                   ← ตาราง D1
└─ wrangler.toml
```

**เพิ่มหน้าใหม่:** สร้างโฟลเดอร์ `public/pages/<key>/index.html` แล้วเพิ่มปุ่ม
`<button class="sb" data-k="<key>">` ในเมนูซ้ายของ `public/index.html` — เท่านี้ระบบคอมเมนต์ใช้ได้เลย
ถ้าเป็นหน้า 3D ให้เพิ่มบรรทัดนี้ใน `main.js` หลังสร้าง OrbitControls (หน้าเดิมทั้ง 4 ใส่ไว้แล้ว):

```js
window.__review = { THREE, scene, camera, renderer, controls };
```

บรรทัดนี้ทำให้หมุดติดกับจุดบนโมเดลจริง (หมุนแล้วหมุดตามไป), บันทึกมุมกล้อง, และถ่ายภาพมุมมองแนบคอมเมนต์ได้

## ระบบคอมเมนต์ทำอะไรได้

| ฟีเจอร์ | รายละเอียด |
|---|---|
| 📍 ปักหมุด | กดปุ่มแล้วคลิกจุดที่ต้องการ — บนโมเดล 3D หมุดจะติดกับชิ้นส่วนนั้น (raycast) หมุน/ซูมแล้วหมุดตามไป, ถ้าถูกบังจะจางลง / บน review sheet หมุดอยู่กับตำแหน่งในเอกสาร |
| ส่วน / อุปกรณ์ | กรอกเอง หรือระบบเติมให้จาก caption รูป (เช่น "3. Cutaway — internal water path") และจำชื่อที่เคยใช้ในหน้านั้นไว้เลือก |
| รูป | แนบได้สูงสุด 6 รูป (เลือกไฟล์ / ลากวาง / Ctrl+V) รูปใหญ่ถูกย่อเหลือ ~2000px ก่อนอัพโหลด |
| ภาพมุมมอง 3D | ตอนปักหมุดบน 3D จะถ่ายภาพหน้าจอพร้อมหมุดแนบให้อัตโนมัติ (ติ๊กออกได้) |
| วันที่ | เลือกวันที่ได้ (ค่าเริ่มต้นวันนี้) + บันทึกเวลาส่งจริงไว้ด้วย (ชี้ที่วันที่เพื่อดู) |
| 🎯 ไปที่มุมมอง | คลิกคอมเมนต์ → เปิดหน้านั้น หมุนกล้องกลับไปมุมที่คนคอมเมนต์เห็น |
| สถานะ | ✓ แก้แล้ว / ↺ เปิดใหม่ · กรองได้ เปิดอยู่ / แก้แล้ว / ทั้งหมด · หน้านี้ / ทุกหน้า |
| ตอบกลับ | ตอบเป็น thread ใต้คอมเมนต์ แนบรูปได้ |
| 🔗 ลิงก์ | คัดลอกลิงก์ไปคอมเมนต์นั้นโดยตรง ส่งใน LINE ได้ |
| ตัวเลขบนเมนู | ปุ่มแต่ละหน้าแสดงจำนวนคอมเมนต์ที่ยังเปิดอยู่ |
| อัพเดทอัตโนมัติ | ดึงคอมเมนต์ใหม่ทุก 30 วินาที |

## Deploy ขึ้น Cloudflare (ครั้งแรก)

ต้องมี Node.js 18+ และบัญชี Cloudflare

```bash
npm install
npx wrangler login

# 1) สร้างฐานข้อมูล D1 แล้วเอา database_id ที่ได้ไปใส่ใน wrangler.toml
npx wrangler d1 create bms-review

# 2) สร้างตาราง
npm run db:init            # = wrangler d1 execute bms-review --remote --file=schema.sql

# 3) สร้าง bucket R2 สำหรับรูป (ต้องเปิดใช้ R2 ใน dashboard ก่อน — มี free tier 10 GB)
npx wrangler r2 bucket create bms-review-images

# 4) deploy
npm run deploy             # = wrangler pages deploy
```

ถ้าใช้ Pages ที่ผูกกับ GitHub อยู่แล้ว: push โค้ดนี้ขึ้น repo แล้วใน dashboard ไปที่
**Settings → Bindings** เพิ่ม D1 ชื่อ binding `DB` และ R2 ชื่อ binding `IMAGES`
(Build output directory = `public`, ไม่ต้องมี build command)

### ทดสอบในเครื่อง

```bash
npm run db:init:local
npm run dev                # http://localhost:8788  (จำลอง D1 + R2 ในเครื่อง)
```

ถ้าเปิดด้วย static server ธรรมดา (ไม่มี /api) แผงคอมเมนต์จะขึ้น **"โหมดทดลอง"** —
คอมเมนต์เก็บใน browser เครื่องนั้นเท่านั้น ไว้ลอง UI

## จำกัดคนที่คอมเมนต์ได้ (แนะนำ)

ตอนนี้ใครมีลิงก์ก็คอมเมนต์ / ลบได้ เลือกอย่างใดอย่างหนึ่ง:

1. **Cloudflare Access (แนะนำ)** — Zero Trust → Access → Applications → ใส่โดเมน Pages
   ให้ login ด้วย email (ฟรี 50 คน) ระบบจะใช้ email ที่ login เป็นชื่อผู้คอมเมนต์อัตโนมัติ
2. **รหัสร่วม** — `npx wrangler pages secret put REVIEW_KEY`
   คนที่จะคอมเมนต์ต้องใส่รหัสครั้งแรก (browser จำไว้) ส่วนการดูอ่านได้ทุกคน

## ข้อมูลที่บันทึก (ตาราง `comments`)

`page` หน้าไหน · `no` เลขหมุด · `author` · `part` ส่วน/อุปกรณ์ · `body` ข้อความ ·
`review_date` วันที่ · `anchor` ตำแหน่งหมุด (JSON) · `view` มุมกล้อง 3D (JSON) ·
`images` key ของรูปใน R2 · `status` open/done · `parent_id` ถ้าเป็นคำตอบกลับ · `created_at`

Export ทั้งหมดเป็น CSV/JSON:

```bash
npx wrangler d1 execute bms-review --remote --json --command "SELECT * FROM comments ORDER BY page, no"
```
