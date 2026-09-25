// Pages & versions registry.
//   GET    /api/pages                    → { pages, versions, canUpload }
//   POST   /api/versions                 JSON {key, vid, title, is3d, note, author, page?}  (after files are PUT)
//   DELETE /api/versions/:key/:vid       web-uploaded versions only
//   PUT    /api/files/<p|lib|src>/…      raw body → R2 (web upload)
//
// Versions built from uploads/ in git arrive through public/p/manifest.json and are registered in D1
// the first time the site sees them, so version numbers are stable (v1, v2, … in upload order).
import { json, KEY_RE, VID_RE, uploadAuth, canUpload } from '../lib.js';

const ADD_VERSION = `INSERT OR IGNORE INTO versions (key, vid, no, title, note, is3d, source, author, created_at)
  SELECT ?1, ?2, COALESCE(MAX(no), 0) + 1, ?3, ?4, ?5, ?6, ?7, ?8 FROM versions WHERE key = ?1`;
const ADD_PAGE = `INSERT OR IGNORE INTO pages (key, site, unit, descr, label, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`;

const DROP_EMPTY_PAGE = 'DELETE FROM pages WHERE key = ?1 AND NOT EXISTS (SELECT 1 FROM versions WHERE key = ?1)';

async function readManifest(request, env) {
  try {
    const r = await env.ASSETS.fetch(new Request(new URL('/p/manifest.json', request.url)));
    return r.ok ? await r.json() : { pages: {}, versions: [] };
  } catch { return { pages: {}, versions: [] }; }
}

export async function listPages({ request, env }) {
  const man = await readManifest(request, env);
  const now = new Date().toISOString();
  const [pg, vs] = await env.DB.batch([
    env.DB.prepare('SELECT key FROM pages'),
    env.DB.prepare('SELECT key, vid FROM versions'),
  ]);
  const havePage = new Set(pg.results.map(r => r.key));
  const haveVer = new Set(vs.results.map(r => r.key + '@' + r.vid));
  const stmts = [];
  for (const [key, m] of Object.entries(man.pages || {})) {
    if (!havePage.has(key) && KEY_RE.test(key))
      stmts.push(env.DB.prepare(ADD_PAGE).bind(key, m.site ?? null, m.unit ?? key, m.desc ?? '', m.label ?? 'Page', m.sort ?? 1000, now));
  }
  for (const v of man.versions || []) {
    if (!haveVer.has(v.key + '@' + v.vid) && KEY_RE.test(v.key) && VID_RE.test(v.vid))
      stmts.push(env.DB.prepare(ADD_VERSION).bind(v.key, v.vid, v.title ?? '', v.note ?? '', v.is3d ? 1 : 0, 'git', null, now));
  }
  if (stmts.length) await env.DB.batch(stmts);

  const inGit = new Set((man.versions || []).map(v => v.key + '@' + v.vid));
  const [pages, versions] = await env.DB.batch([
    env.DB.prepare('SELECT key, site, unit, descr AS "desc", label, sort FROM pages ORDER BY sort, created_at, key'),
    env.DB.prepare('SELECT key, vid, no, title, note, is3d, source, author, created_at FROM versions ORDER BY key, no'),
  ]);
  return json({
    pages: pages.results,
    // a git version whose file was removed from uploads/ is no longer served, so hide it
    versions: versions.results.filter(v => v.source !== 'git' || inGit.has(v.key + '@' + v.vid)),
    canUpload: canUpload(request, env),
  });
}

const FILE_RE = /^(p\/[a-z0-9][a-z0-9-]{0,39}\/[0-9a-f]{8}\/(?:[\w-]+\/)*[\w.-]+|lib\/[0-9a-f]{12}\.[a-z0-9]{1,6}|src\/[a-z0-9][a-z0-9-]{0,39}\/[0-9a-f]{8}\.html)$/;
const MAX_UPLOAD = 25 * 1024 * 1024;

export async function putFile({ request, env, params }) {
  const denied = uploadAuth(request, env); if (denied) return denied;
  const key = params.path;
  if (!FILE_RE.test(key) || key.includes('..')) return json({ error: 'Invalid path ' + key }, 400);
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_UPLOAD) return json({ error: 'ไฟล์ใหญ่เกิน 25 MB' }, 413);
  if (key.startsWith('lib/') && await env.IMAGES.head(key)) return json({ ok: true, existed: true });
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_UPLOAD) return json({ error: 'ไฟล์ใหญ่เกิน 25 MB' }, 413);
  const type = (request.headers.get('content-type') || 'application/octet-stream').slice(0, 100);
  await env.IMAGES.put(key, body, { httpMetadata: { contentType: type } });
  return json({ ok: true });
}

/** lets the upload dialog ask for the key once, before sending anything */
export async function checkUpload({ request, env }) {
  return uploadAuth(request, env) || json({ ok: true });
}

export async function addVersion({ request, env }) {
  const denied = uploadAuth(request, env); if (denied) return denied;
  const b = await request.json().catch(() => ({}));
  const s = (v, n) => String(v ?? '').trim().slice(0, n);
  const key = s(b.key, 40), vid = s(b.vid, 8);
  if (!KEY_RE.test(key) || !VID_RE.test(vid)) return json({ error: 'Invalid key/vid' }, 400);
  if (!(await env.IMAGES.head(`p/${key}/${vid}/index.html`))) return json({ error: 'ยังไม่ได้อัพโหลดไฟล์ของเวอร์ชันนี้' }, 400);
  const exists = await env.DB.prepare('SELECT no FROM versions WHERE key = ? AND vid = ?').bind(key, vid).first();
  if (exists) return json({ error: `ไฟล์นี้ตรงกับ v${exists.no} ที่มีอยู่แล้ว`, code: 'duplicate', no: exists.no }, 409);
  const now = new Date().toISOString();
  const author = s(request.headers.get('cf-access-authenticated-user-email') || b.author, 80) || null;
  const stmts = [];
  if (b.page) {
    const p = b.page;
    stmts.push(env.DB.prepare(DROP_EMPTY_PAGE).bind(key));   // a page left empty earlier gets the new details
    stmts.push(env.DB.prepare(ADD_PAGE).bind(key, s(p.site, 80) || 'อื่นๆ', s(p.unit, 120) || key, s(p.desc, 200), s(p.label, 40) || 'Page', Number(p.sort) || 1000, now));
  }
  stmts.push(env.DB.prepare(ADD_VERSION).bind(key, vid, s(b.title, 200), s(b.note, 300), b.is3d ? 1 : 0, 'web', author, now));
  await env.DB.batch(stmts);
  const v = await env.DB.prepare('SELECT key, vid, no, title, note, is3d, source, author, created_at FROM versions WHERE key = ? AND vid = ?').bind(key, vid).first();
  return json(v, 201);
}

export async function deleteVersion({ request, env, params }) {
  const denied = uploadAuth(request, env); if (denied) return denied;
  const { key, vid } = params;
  const v = await env.DB.prepare('SELECT source FROM versions WHERE key = ? AND vid = ?').bind(key, vid).first();
  if (!v) return json({ error: 'Not found' }, 404);
  if (v.source !== 'web') return json({ error: 'เวอร์ชันจาก Git ลบโดยลบไฟล์ใน uploads/ แล้ว push' }, 400);
  let cursor;
  do {
    const l = await env.IMAGES.list({ prefix: `p/${key}/${vid}/`, cursor });
    if (l.objects.length) await env.IMAGES.delete(l.objects.map(o => o.key));
    cursor = l.truncated ? l.cursor : undefined;
  } while (cursor);
  await env.IMAGES.delete(`src/${key}/${vid}.html`);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM versions WHERE key = ? AND vid = ?').bind(key, vid),
    env.DB.prepare(DROP_EMPTY_PAGE).bind(key),        // last version gone → page leaves the sidebar
  ]);
  const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM versions WHERE key = ?').bind(key).first();
  return json({ ok: true, pageRemoved: !left.n });
}

/** GET/HEAD /p/…, /lib/…, /src/… that are not in the static build → R2 (web-uploaded versions). */
export async function serveStored({ request, env }) {
  const url = new URL(request.url);
  let key = decodeURIComponent(url.pathname.slice(1));
  if (/^p\/[^/]+\/[^/]+$/.test(key)) return Response.redirect(url.origin + url.pathname + '/' + url.search, 301);
  if (key.endsWith('/')) key += 'index.html';
  if (key.includes('..')) return new Response('Bad path', { status: 400 });
  const obj = request.method === 'HEAD' ? await env.IMAGES.head(key) : await env.IMAGES.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  if (request.headers.get('if-none-match') === obj.httpEtag) return new Response(null, { status: 304 });
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('etag', obj.httpEtag);
  // every path contains a content hash, so it never changes
  h.set('cache-control', 'public, max-age=31536000, immutable');
  if (key.startsWith('src/')) h.set('content-disposition', `attachment; filename="${key.split('/')[1]}-${key.split('/')[2]}"`);
  return new Response(request.method === 'HEAD' ? null : obj.body, { headers: h });
}
