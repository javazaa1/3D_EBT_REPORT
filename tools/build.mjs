#!/usr/bin/env node
/* Build step (runs automatically before every deploy — see "build" in wrangler.jsonc).

   Converts every standalone HTML in uploads/ into separate files:
     uploads/<key>/<any name>.html   → a version of page <key>   (file name = version note)
     uploads/<any name>.html         → review shell: one version per page inside it,
                                       single page: key = file name
     uploads/pages.json              → optional sidebar info per key (site, unit, desc, label, sort)

   Output (git-ignored, regenerated each build):
     public/p/<key>/<vid>/…   public/lib/<hash>.*   public/src/<key>/<vid>.html   public/p/manifest.json */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertUpload, slug } from '../public/assets/js/unbundle.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UP = path.join(ROOT, 'uploads');
const PUB = path.join(ROOT, 'public');
const write = (p, b) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, b); };

for (const d of ['p', 'lib', 'src']) fs.rmSync(path.join(PUB, d), { recursive: true, force: true });

const meta = fs.existsSync(path.join(UP, 'pages.json')) ? JSON.parse(fs.readFileSync(path.join(UP, 'pages.json'), 'utf8')) : {};
const jobs = [];   // { file, folderKey }
if (fs.existsSync(UP)) {
  for (const ent of fs.readdirSync(UP, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (ent.isFile() && /\.html?$/i.test(ent.name)) jobs.push({ file: ent.name, folderKey: null });
    if (ent.isDirectory()) {
      for (const f of fs.readdirSync(path.join(UP, ent.name)).sort()) {
        if (/\.html?$/i.test(f)) jobs.push({ file: path.join(ent.name, f), folderKey: slug(ent.name) });
      }
    }
  }
}

const versions = [];
const seen = new Set();
let libCount = 0;
for (const job of jobs) {
  const html = fs.readFileSync(path.join(UP, job.file), 'utf8');
  const note = path.basename(job.file).replace(/\.html?$/i, '');
  const parts = await convertUpload(html);
  for (const { key: shellKey, page, meta: shellMeta } of parts) {
    const key = parts.length > 1 ? shellKey : (job.folderKey || shellKey || slug(note));
    if (!key) { console.warn(`  skip ${job.file}: cannot work out a page key`); continue; }
    if (seen.has(key + '@' + page.vid)) continue;
    seen.add(key + '@' + page.vid);
    const dir = path.join(PUB, 'p', key, page.vid);
    for (const f of page.files) write(path.join(dir, f.path), f.bytes);
    for (const l of page.libs) { const p = path.join(PUB, l.path); if (!fs.existsSync(p)) { write(p, l.bytes); libCount++; } }
    write(path.join(PUB, 'src', key, page.vid + '.html'), page.source);
    versions.push({ key, vid: page.vid, title: page.title, is3d: page.is3d, note, file: job.file, shellMeta });
    console.log(`  ${key.padEnd(14)} ${page.vid}  ${page.is3d ? (page.hooked ? '3D+pins' : '3D (no hook!)') : 'page   '}  ${job.file}`);
  }
}

const pages = {};
for (const v of versions) {
  pages[v.key] ??= Object.assign(
    { site: 'อื่นๆ', unit: v.title || v.key, desc: '', label: v.is3d ? '3D model' : 'Page', sort: 1000 },
    v.shellMeta || {},        // names from the shell file's own sidebar
    meta[v.key] || {},        // uploads/pages.json wins
  );
}
write(path.join(PUB, 'p', 'manifest.json'), JSON.stringify({ pages, versions: versions.map(({ shellMeta, ...v }) => v) }, null, 1));
console.log(`build: ${versions.length} version(s), ${Object.keys(pages).length} page(s), ${libCount} shared file(s)`);
