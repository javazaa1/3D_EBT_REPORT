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
├─ functions/api/               ← backend (/api)
│  ├─ _middleware.js            ← ตรวจ REVIEW_KEY (ถ้าตั้ง), จัดการ error
│  ├─ comments/index.js         ← GET รายการ / POST คอมเมนต์ใหม่ (multipart + รูป)
│  ├─ comments/[id].js          ← PATCH สถานะ (open/done) / DELETE
│  └─ img/[[path]].js           ← ส่งรูปจาก R2
├─ lib/review.js                ← helper ที่ functions ใช้ร่วมกัน
├─ src/worker.js               ← entry ของ Worker: ส่ง /api/* ไปที่ functions/, ที่เหลือเสิร์ฟจาก public/
├─ wrangler.jsonc               ← config ของ Worker (assets + D1 + R2)
└─ schema.sql                   ← โครงสร้างตาราง D1 (สร้างอัตโนมัติ)
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

## Deploy ผ่าน GitHub → Cloudflare Worker

ใช้เมนู Workers & Pages → Create → **Import a repository** (Cloudflare จะรัน `npx wrangler deploy` ให้)

1. push โฟลเดอร์นี้ขึ้น GitHub ให้ `wrangler.jsonc`, `package.json`, `public/`, `src/` อยู่ **ชั้นบนสุดของ repo**
   (ถ้าอยู่ในโฟลเดอร์ย่อย ให้ตั้ง Settings → Build → Root directory เป็นชื่อโฟลเดอร์นั้น)
2. Import repository แล้วตั้งค่า
   - Build command: *(เว้นว่าง)*
   - Deploy command: `npx wrangler deploy`
3. ชื่อ Worker ใน dashboard ต้องตรงกับ `"name"` ใน `wrangler.jsonc` (ตอนนี้คือ `bms-3d-review`) — ถ้าไม่ตรง แก้ในไฟล์แล้ว push

D1 (`bms-review`) และ R2 (`bms-review-images`) **ถูกสร้างอัตโนมัติตอน deploy ครั้งแรก**
(ถ้าสร้างชื่อเดียวกันไว้แล้วจะเชื่อมกับของเดิม) และตาราง D1 ถูกสร้างตอนเรียก API ครั้งแรก
ต้องเปิดใช้ R2 ในบัญชีก่อน (R2 Object Storage → เปิดใช้ครั้งแรก)

หลังจากนี้ push ขึ้น `main` = deploy ใหม่อัตโนมัติ

> ไฟล์ `functions/` ใช้ได้ทั้งสองแบบ: Worker เรียกผ่าน `src/worker.js`,
> ส่วนถ้าเลือกสร้างเป็น **Pages** (Build output directory = `public`) Pages จะใช้ `functions/` โดยตรง
> แล้วตั้ง Bindings `DB` / `IMAGES` เองใน Settings → Bindings

### ทดสอบในเครื่อง (ไม่บังคับ)

```bash
npm install
npm run dev      # http://localhost:8787 — จำลอง D1 + R2 ในเครื่อง
```

ถ้าเปิดด้วย static server ธรรมดา (ไม่มี /api) แผงคอมเมนต์จะขึ้น **"โหมดทดลอง"** —
คอมเมนต์เก็บใน browser เครื่องนั้นเท่านั้น ไว้ลอง UI

## จำกัดคนที่คอมเมนต์ได้ (แนะนำ)

ตอนนี้ใครมีลิงก์ก็คอมเมนต์ / ลบได้ เลือกอย่างใดอย่างหนึ่ง:

1. **Cloudflare Access (แนะนำ)** — Zero Trust → Access → Applications → ใส่โดเมน Pages
   ให้ login ด้วย email (ฟรี 50 คน) ระบบจะใช้ email ที่ login เป็นชื่อผู้คอมเมนต์อัตโนมัติ
2. **รหัสร่วม** — Worker → Settings → Variables and Secrets → เพิ่ม **Secret** ชื่อ `REVIEW_KEY`
   คนที่จะคอมเมนต์ต้องใส่รหัสครั้งแรก (browser จำไว้) ส่วนการดูอ่านได้ทุกคน

## ข้อมูลที่บันทึก (ตาราง `comments`)

`page` หน้าไหน · `no` เลขหมุด · `author` · `part` ส่วน/อุปกรณ์ · `body` ข้อความ ·
`review_date` วันที่ · `anchor` ตำแหน่งหมุด (JSON) · `view` มุมกล้อง 3D (JSON) ·
`images` key ของรูปใน R2 · `status` open/done · `parent_id` ถ้าเป็นคำตอบกลับ · `created_at`

ดู / export ข้อมูล: D1 → `bms-review` → Console → `SELECT * FROM comments ORDER BY page, no`
