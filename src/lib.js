// Shared helpers for the /api Pages Functions.
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export const PAGE_RE = /^[a-z0-9-]{1,40}$/;
export const ANCHOR_TYPES = new Set(['world', 'canvas', 'doc', 'screen']);
export const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
export const MAX_FILES = 6;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;

export function parseJSON(s, fallback = null) {
  if (s == null || s === '') return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}

export function toComment(r) {
  return { ...r, anchor: parseJSON(r.anchor), view: parseJSON(r.view), images: parseJSON(r.images, []) };
}

/** YYYY-MM-DD in Bangkok time */
export function todayTH() {
  return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
}

const num = n => typeof n === 'number' && Number.isFinite(n);

export function cleanAnchor(a) {
  if (!a || typeof a !== 'object' || !ANCHOR_TYPES.has(a.type)) return null;
  if (a.type === 'world') return Array.isArray(a.p) && a.p.length === 3 && a.p.every(num) ? { type: 'world', p: a.p } : null;
  return num(a.x) && num(a.y) ? { type: a.type, x: a.x, y: a.y } : null;
}

export function cleanView(v) {
  const ok = x => Array.isArray(x) && x.length === 3 && x.every(num);
  return v && ok(v.p) && ok(v.t) ? { p: v.p, t: v.t } : null;
}

export const KEY_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const VID_RE = /^[0-9a-f]{8}$/;

/** Tables are created / migrated on first use, so no manual SQL step is needed. */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, page TEXT NOT NULL, parent_id TEXT, no INTEGER,
    author TEXT NOT NULL, part TEXT, body TEXT NOT NULL, review_date TEXT, anchor TEXT, view TEXT,
    images TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, updated_at TEXT, vid TEXT)`,
  'CREATE INDEX IF NOT EXISTS idx_comments_page ON comments(page, created_at)',
  'CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id)',
  `CREATE TABLE IF NOT EXISTS pages (key TEXT PRIMARY KEY, site TEXT, unit TEXT, descr TEXT, label TEXT,
    sort INTEGER NOT NULL DEFAULT 1000, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS versions (key TEXT NOT NULL, vid TEXT NOT NULL, no INTEGER NOT NULL, title TEXT, note TEXT,
    is3d INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL, author TEXT, created_at TEXT NOT NULL, PRIMARY KEY (key, vid))`,
];
const MIGRATIONS = ['ALTER TABLE comments ADD COLUMN vid TEXT'];   // for databases created before versions existed
let ready = null;
export function ensureSchema(env) {
  ready ??= (async () => {
    await env.DB.batch(SCHEMA.map(q => env.DB.prepare(q)));
    for (const q of MIGRATIONS) { try { await env.DB.prepare(q).run(); } catch { /* already applied */ } }
  })().catch(e => { ready = null; throw e; });
  return ready;
}

/** Uploading HTML/JS to the site is powerful, so it needs UPLOAD_KEY (or a Cloudflare Access login). */
export function uploadAuth(request, env) {
  if (request.headers.get('cf-access-authenticated-user-email')) return null;
  if (!env.UPLOAD_KEY) return json({ error: 'ยังไม่ได้ตั้ง UPLOAD_KEY ใน Worker → Settings → Variables and Secrets', code: 'no_upload_key' }, 403);
  if (request.headers.get('x-upload-key') !== env.UPLOAD_KEY) return json({ error: 'รหัสอัพโหลดไม่ถูกต้อง', code: 'upload_key' }, 401);
  return null;
}
export const canUpload = (request, env) => !!(env.UPLOAD_KEY || request.headers.get('cf-access-authenticated-user-email'));
