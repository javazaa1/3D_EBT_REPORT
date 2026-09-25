// GET    /api/comments[?page=]     → { comments }
// POST   /api/comments             multipart: page, vid?, author, body, part?, review_date?, parent_id?, anchor?, view?, images[]
// PATCH  /api/comments/:id         JSON { status?, body? }
// DELETE /api/comments/:id         comment + replies + their images
import {
  json, PAGE_RE, VID_RE, IMAGE_TYPES, MAX_FILES, MAX_FILE_BYTES,
  parseJSON, toComment, todayTH, cleanAnchor, cleanView,
} from '../lib.js';

export async function list({ request, env }) {
  const page = new URL(request.url).searchParams.get('page');
  const stmt = page
    ? env.DB.prepare('SELECT * FROM comments WHERE page = ? ORDER BY created_at').bind(page)
    : env.DB.prepare('SELECT * FROM comments ORDER BY created_at');
  const { results } = await stmt.all();
  return json({ comments: results.map(toComment) });
}

export async function create({ request, env }) {
  if (!(request.headers.get('content-type') || '').includes('multipart/form-data'))
    return json({ error: 'Send multipart/form-data' }, 415);
  const f = await request.formData();
  const str = (k, max) => String(f.get(k) ?? '').trim().slice(0, max);

  const page = str('page', 40);
  if (!PAGE_RE.test(page)) return json({ error: 'Invalid page' }, 400);
  const body = str('body', 5000);
  if (!body) return json({ error: 'ข้อความว่าง' }, 400);
  const vid = VID_RE.test(str('vid', 8)) ? str('vid', 8) : null;

  // Behind Cloudflare Access the signed-in e-mail is trusted over the typed name.
  const author = (request.headers.get('cf-access-authenticated-user-email') || str('author', 80)).slice(0, 80) || 'ไม่ระบุชื่อ';
  const part = str('part', 200) || null;
  const d = str('review_date', 10);
  const review_date = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayTH();

  const parent_id = str('parent_id', 64) || null;
  if (parent_id) {
    const p = await env.DB.prepare('SELECT id, page FROM comments WHERE id = ? AND parent_id IS NULL').bind(parent_id).first();
    if (!p || p.page !== page) return json({ error: 'Parent comment not found' }, 400);
  }
  const anchor = parent_id ? null : cleanAnchor(parseJSON(f.get('anchor')));
  const view = parent_id ? null : cleanView(parseJSON(f.get('view')));

  const files = f.getAll('images').filter(x => x && typeof x === 'object' && x.size > 0);
  if (files.length > MAX_FILES) return json({ error: `แนบได้สูงสุด ${MAX_FILES} รูป` }, 400);
  for (const file of files) {
    if (!IMAGE_TYPES[file.type]) return json({ error: `ไฟล์ ${file.name} ไม่ใช่รูป (jpg/png/webp/gif)` }, 400);
    if (file.size > MAX_FILE_BYTES) return json({ error: `ไฟล์ ${file.name} ใหญ่เกิน 8 MB` }, 413);
  }

  const id = crypto.randomUUID();
  const images = [];
  for (const file of files) {
    const key = `${page}/${id}/${images.length + 1}.${IMAGE_TYPES[file.type]}`;
    await env.IMAGES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    images.push(key);
  }

  let no = null;
  if (!parent_id) {
    const r = await env.DB.prepare('SELECT COALESCE(MAX(no), 0) + 1 AS n FROM comments WHERE page = ? AND parent_id IS NULL').bind(page).first();
    no = r.n;
  }
  const row = {
    id, page, vid, parent_id, no, author, part, body, review_date,
    anchor: anchor ? JSON.stringify(anchor) : null,
    view: view ? JSON.stringify(view) : null,
    images: JSON.stringify(images), status: 'open', created_at: new Date().toISOString(), updated_at: null,
  };
  await env.DB.prepare(
    `INSERT INTO comments (id, page, vid, parent_id, no, author, part, body, review_date, anchor, view, images, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(row.id, row.page, row.vid, row.parent_id, row.no, row.author, row.part, row.body, row.review_date,
         row.anchor, row.view, row.images, row.status, row.created_at).run();
  return json(toComment(row), 201);
}

export async function update({ params, request, env }) {
  const p = await request.json().catch(() => ({}));
  const sets = [], vals = [];
  if (p.status !== undefined) {
    if (!['open', 'done'].includes(p.status)) return json({ error: 'status must be open or done' }, 400);
    sets.push('status = ?'); vals.push(p.status);
  }
  if (p.body !== undefined) {
    const b = String(p.body).trim().slice(0, 5000);
    if (!b) return json({ error: 'ข้อความว่าง' }, 400);
    sets.push('body = ?'); vals.push(b);
  }
  if (p.anchor !== undefined) {           // "ย้ายหมุด": new pin position (and 3D camera view)
    const a = cleanAnchor(p.anchor);
    if (!a) return json({ error: 'ตำแหน่งหมุดไม่ถูกต้อง' }, 400);
    sets.push('anchor = ?'); vals.push(JSON.stringify(a));
    if (p.vid !== undefined && VID_RE.test(String(p.vid))) { sets.push('vid = ?'); vals.push(String(p.vid)); }
    if (p.view !== undefined) { const v = cleanView(p.view); sets.push('view = ?'); vals.push(v ? JSON.stringify(v) : null); }
  }
  if (!sets.length) return json({ error: 'Nothing to update' }, 400);
  sets.push('updated_at = ?'); vals.push(new Date().toISOString());
  const r = await env.DB.prepare(`UPDATE comments SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, params.id).run();
  if (!r.meta.changes) return json({ error: 'Not found' }, 404);
  return json(toComment(await env.DB.prepare('SELECT * FROM comments WHERE id = ?').bind(params.id).first()));
}

export async function remove({ params, env }) {
  const { results } = await env.DB.prepare('SELECT images FROM comments WHERE id = ? OR parent_id = ?').bind(params.id, params.id).all();
  if (!results.length) return json({ error: 'Not found' }, 404);
  const keys = results.flatMap(r => JSON.parse(r.images || '[]'));
  if (keys.length) await env.IMAGES.delete(keys);
  await env.DB.prepare('DELETE FROM comments WHERE id = ? OR parent_id = ?').bind(params.id, params.id).run();
  return json({ ok: true, deleted: results.length });
}
