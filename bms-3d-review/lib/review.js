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
