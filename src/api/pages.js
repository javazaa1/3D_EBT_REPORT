// Pages & versions registry.
//   GET    /api/pages                    → { pages, versions, canUpload }
//   POST   /api/versions                 JSON {key, vid, title, is3d, note, author, page?}  (after files are PUT)
//   POST   /api/versions/notify          JSON {items:[{key,vid}], note, author} → one Teams card per upload
//   DELETE /api/versions/:key/:vid       web-uploaded versions only
//   GET    /api/teams-test               send a test card to Teams
//   PUT    /api/files/<p|lib|src>/…      raw body → R2 (web upload)
//
// Versions built from uploads/ in git arrive through public/p/manifest.json and are registered in D1
// the first time the site sees them, so version numbers are stable (v1, v2, … in upload order).
import { json, KEY_RE, VID_RE, uploadAuth, canUpload } from '../lib.js';
import { notifyTeams, wants, pageInfo, fmtTH } from '../teams.js';

const ADD_VERSION = `INSERT OR IGNORE INTO versions (key, vid, no, title, note, is3d, source, author, created_at)
  SELECT ?1, ?2, COALESCE(MAX(no), 0) + 1, ?3, ?4, ?5, ?6, ?7, ?8 FROM versions WHERE key = ?1`;
const ADD_PAGE = `INSERT OR IGNORE INTO pages (key, site, unit, descr, label, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`;

// names from an uploaded file's own menu refresh an existing page; empty values keep the old ones
const UPDATE_NAMES = `UPDATE pages SET site = COALESCE(NULLIF(?, ''), site), unit = COALESCE(NULLIF(?, ''), unit),
  descr = COALESCE(NULLIF(?, ''), descr), label = COALESCE(NULLIF(?, ''), label), sort = COALESCE(?, sort) WHERE key = ?`;
function nameArgs(p, key) {
  const t = (v, n) => String(v ?? '').trim().slice(0, n);
  const sort = p.sort === null || p.sort === undefined || p.sort === '' || !Number.isFinite(Number(p.sort)) ? null : Number(p.sort);
  return [t(p.site, 80), t(p.unit, 120), t(p.desc, 200), t(p.label, 60), sort, key];
}
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
    env.DB.prepare('SELECT key, site, unit, descr, label, sort FROM pages'),
    env.DB.prepare('SELECT key, vid, source FROM versions'),
  ]);
  const rowOf = Object.fromEntries(pg.results.map(r => [r.key, r]));
  const hasWeb = new Set(vs.results.filter(r => r.source === 'web').map(r => r.key));
  const havePage = new Set(pg.results.map(r => r.key));
  const haveVer = new Set(vs.results.map(r => r.key + '@' + r.vid));
  const stmts = [];
  for (const [key, m] of Object.entries(man.pages || {})) {
    if (!havePage.has(key) && KEY_RE.test(key))
      stmts.push(env.DB.prepare(ADD_PAGE).bind(key, m.site ?? null, m.unit ?? key, m.desc ?? '', m.label ?? 'Page', m.sort ?? 1000, now));
  }
  // names set in git (uploads/pages.json or a shell file's menu) follow the repo — unless the page
  // also has web uploads, whose names then win
  for (const [key, m] of Object.entries(man.pages || {})) {
    const r = rowOf[key];
    if (!r || !m.explicit || hasWeb.has(key)) continue;
    const want = { site: m.site ?? r.site, unit: m.unit ?? r.unit, descr: m.desc ?? r.descr, label: m.label ?? r.label, sort: m.sort ?? r.sort };
    if (want.site !== r.site || want.unit !== r.unit || want.descr !== r.descr || want.label !== r.label || want.sort !== r.sort) {
      stmts.push(env.DB.prepare('UPDATE pages SET site = ?, unit = ?, descr = ?, label = ?, sort = ? WHERE key = ?')
        .bind(want.site, want.unit, want.descr, want.label, want.sort, key));
    }
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
  const exists = await env.DB.prepare('SELECT no FROM versions WHERE key = ? AND vid = ?').bind(key, vid).first();
  if (exists) {
    if (b.page) await env.DB.prepare(UPDATE_NAMES).bind(...nameArgs(b.page, key)).run();
    return json({ error: `ไฟล์นี้ตรงกับ v${exists.no} ที่มีอยู่แล้ว`, code: 'duplicate', no: exists.no }, 409);
  }
  // (checked after the duplicate test: versions that came from git have no files in R2)
  if (!(await env.IMAGES.head(`p/${key}/${vid}/index.html`))) return json({ error: 'ยังไม่ได้อัพโหลดไฟล์ของเวอร์ชันนี้' }, 400);
  const now = new Date().toISOString();
  const author = s(request.headers.get('cf-access-authenticated-user-email') || b.author, 80) || null;
  const stmts = [];
  if (b.page) {
    const p = b.page;
    stmts.push(env.DB.prepare(DROP_EMPTY_PAGE).bind(key));   // a page left empty earlier gets the new details
    stmts.push(env.DB.prepare(ADD_PAGE).bind(key, s(p.site, 80) || 'อื่นๆ', s(p.unit, 120) || key, s(p.desc, 200), s(p.label, 60) || 'Page', Number(p.sort) || 1000, now));
  }
  if (b.page) stmts.push(env.DB.prepare(UPDATE_NAMES).bind(...nameArgs(b.page, key)));   // file's menu names refresh an existing page
  stmts.push(env.DB.prepare(ADD_VERSION).bind(key, vid, s(b.title, 200), s(b.note, 300), b.is3d ? 1 : 0, 'web', author, now));
  await env.DB.batch(stmts);
  const v = await env.DB.prepare('SELECT key, vid, no, title, note, is3d, source, author, created_at FROM versions WHERE key = ? AND vid = ?').bind(key, vid).first();
  return json(v, 201);
}

/** POST /api/versions/notify { items:[{key,vid}], note?, author? } — one Teams card per upload batch */
export async function notifyUpload({ request, env, waitUntil }) {
  const denied = uploadAuth(request, env); if (denied) return denied;
  if (!wants(env, 'upload')) return json({ sent: false, reason: 'off' });
  const b = await request.json().catch(() => ({}));
  const list = (Array.isArray(b.items) ? b.items : []).filter(x => x && KEY_RE.test(String(x.key)) && VID_RE.test(String(x.vid))).slice(0, 60);
  if (!list.length) return json({ error: 'no items' }, 400);
  const items = [];
  for (const x of list) {
    const v = await env.DB.prepare('SELECT no, author, note FROM versions WHERE key = ? AND vid = ?').bind(x.key, x.vid).first();
    if (!v) continue;
    const i = await pageInfo(env, x.key, x.vid);
    items.push({ ...i, key: x.key, vid: x.vid, author: v.author, note: v.note });
  }
  if (!items.length) return json({ error: 'versions not found' }, 404);
  const origin = new URL(request.url).origin, first = items[0];
  const s = (v, n) => String(v ?? '').trim().slice(0, n);
  const info = {
    page: items.length === 1 ? first.page : items.length + ' หน้า',
    version: items.length === 1 ? first.version : null,
    items: items.length > 1 ? items : null,
    author: s(request.headers.get('cf-access-authenticated-user-email') || b.author || first.author, 80),
    body: s(b.note ?? first.note, 300),
    date: fmtTH(new Date().toISOString()),
    link: `${origin}/#${first.key}@${first.vid}`,
  };
  const r = notifyTeams(env, 'upload', info);
  if (waitUntil) { waitUntil(r); return json({ sent: 'queued' }, 202); }
  return json(await r);
}

/** GET /api/teams-test — sends a test card (needs the upload key) */
export async function teamsTest({ request, env }) {
  const denied = uploadAuth(request, env); if (denied) return denied;
  if (!env.TEAMS_WEBHOOK_URL) return json({ sent: false, error: 'ยังไม่ได้ตั้ง TEAMS_WEBHOOK_URL' }, 400);
  const origin = new URL(request.url).origin;
  const r = await notifyTeams(env, 'test', {
    page: 'JEC · BMS 3D Design Review', body: 'ถ้าเห็นข้อความนี้ใน Teams แปลว่าตั้งค่าเรียบร้อยแล้ว ✔',
    date: fmtTH(new Date().toISOString()), link: origin + '/',
  });
  return json({ ...r, notify: String(env.TEAMS_NOTIFY || 'comment,reply,upload') }, r.sent ? 200 : 502);
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
