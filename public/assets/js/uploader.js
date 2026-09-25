/* ───────── Upload logic shared by the /upload page and the upload dialog ─────────
   prepare(file, R) → items to show   ·   send(items, opts) → uploads files to R2 and registers versions */
import { convertUpload, slug } from './unbundle.js';

const API = () => window.CommentAPI;

/** Registry helper: { pages, byKey, versions:{key:[…sorted]}, latest(k), findVer(k,vid) } */
export function registry(d) {
  const R = { pages: d.pages || [], byKey: {}, versions: {}, canUpload: !!d.canUpload };
  R.pages.forEach(p => { R.byKey[p.key] = p; R.versions[p.key] = []; });
  (d.versions || []).forEach(v => (R.versions[v.key] = R.versions[v.key] || []).push(v));
  Object.values(R.versions).forEach(a => a.sort((x, y) => x.no - y.no));
  R.pages = R.pages.filter(p => R.versions[p.key].length);
  R.byKey = {}; R.pages.forEach(p => { R.byKey[p.key] = p; });
  R.latest = k => { const a = R.versions[k] || []; return a[a.length - 1] || null; };
  R.findVer = (k, vid) => (R.versions[k] || []).find(v => v.vid === vid) || null;
  R.title = k => { const p = R.byKey[k]; return p ? p.unit + ' · ' + p.label : k; };
  return R;
}

const words = s => new Set(String(s || '').toLowerCase()
  .replace(/\bv\d+\b|rev\.?\s*\d+|\d{4}-\d{2}-\d{2}/g, ' ')          // ignore version / date noise
  .split(/[^a-z0-9ก-๙]+/).filter(w => w.length > 1));

/** Which existing page does this file belong to? Title match first, then word overlap. */
export function matchPage(page, R) {
  let best = '', bestScore = 0;
  for (const p of R.pages) {
    const is3dPage = /3d/i.test(p.label), isSheet = /sheet|page/i.test(p.label);
    if ((page.is3d && isSheet) || (!page.is3d && is3dPage)) continue;     // never mix a sheet with a 3D page
    for (const v of R.versions[p.key] || []) {
      if (v.title && v.title === page.title) return p.key;
      const a = words(page.title), b = words(v.title + ' ' + p.unit);
      if (!a.size) continue;
      const hit = [...a].filter(w => b.has(w)).length;
      const score = hit / Math.min(a.size, b.size);
      if (score > bestScore) { bestScore = score; best = p.key; }
    }
  }
  return bestScore >= 0.6 ? best : '';
}

export function newKey(R, unit, is3d) {
  const base = (slug(unit) || 'page').slice(0, 34) + (is3d ? '-3d' : '-sheet');
  let k = base, i = 2;
  while (R.byKey[k]) k = base + '-' + i++;
  return k;
}

/** Read one HTML file → [{ page, fileName, target, dup, key, meta }] */
export async function prepare(file, R, fixedTarget) {
  const parts = await convertUpload(await file.text());
  return parts.map(({ key, page, meta: shellMeta }) => {
    const target = (fixedTarget && parts.length === 1 && fixedTarget) ||
      (key && R.byKey[key] ? key : (!key ? matchPage(page, R) : ''));
    const unit = (page.title || file.name.replace(/\.html?$/i, '')).replace(/\s*[—–-]\s*(3D|Design Review).*$/i, '').trim();
    return {
      page, fileName: file.name, target, shellKey: key || null,
      dup: target ? R.findVer(target, page.vid) : null,
      key: target || key || newKey(R, unit, page.is3d),
      meta: Object.assign({ site: '', unit, desc: '', label: page.is3d ? '3D model' : 'Review sheet' },
        shellMeta ? Object.fromEntries(Object.entries(shellMeta).filter(([, v]) => v !== '' && v != null)) : {}),
    };
  });
}

async function pool(tasks, n) {
  let i = 0;
  const run = async () => { while (i < tasks.length) await tasks[i++](); };
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, run));
}

/** Upload everything; onProgress(fraction, label). Returns [{ key, vid }]. */
export async function send(items, { note, author, onProgress }) {
  const todo = items.filter(it => !it.dup);
  const prog = onProgress || (() => {});
  await API().checkUpload();

  const libs = new Map();
  todo.forEach(it => it.page.libs.forEach(l => libs.set(l.path, l)));
  const pageFiles = todo.reduce((n, it) => n + it.page.files.length + 1, 0);
  const total = libs.size + pageFiles;
  let done = 0;
  const tick = label => prog(++done / Math.max(1, total), label);

  await pool([...libs.values()].map(l => async () => {
    if (!(await API().exists(l.path))) await API().putFile(l.path, l.bytes, l.type);
    tick('ไลบรารี');
  }), 4);

  const out = [];
  for (const it of todo) {
    const key = it.target || it.key, vid = it.page.vid, base = 'p/' + key + '/' + vid + '/';
    const files = it.page.files.map(f => ({ path: base + f.path, bytes: f.bytes, type: f.type }))
      .concat([{ path: 'src/' + key + '/' + vid + '.html', bytes: it.page.source, type: 'text/html; charset=utf-8' }]);
    const idx = files.findIndex(f => f.path.endsWith('/index.html'));
    // index.html goes last, so a half-finished upload never looks complete
    await pool(files.filter((_, i) => i !== idx).map(f => async () => { await API().putFile(f.path, f.bytes, f.type); tick(key); }), 4);
    await API().putFile(files[idx].path, files[idx].bytes, files[idx].type); tick(key);
    try {
      await API().addVersion({
        key, vid, title: it.page.title, is3d: it.page.is3d, note, author,
        page: it.target ? undefined : Object.assign({}, it.meta, { sort: 1000 }),
      });
    } catch (e) { if (!(e.data && e.data.code === 'duplicate')) throw e; }
    out.push({ key, vid });
  }
  return out;
}
