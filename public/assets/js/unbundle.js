/* ───────── Unbundler: standalone HTML → separate files ─────────
   Runs in the browser (web upload) and in Node 20+ (tools/build.mjs), so both routes produce identical output.

   Input shapes:
     • review shell   : several <script type="text/plain" id="d-<key>"> base64 pages   → splitShell()
     • bundled page   : <script type="__bundler/manifest"> + __bundler/template        → convertPage()
     • plain HTML     : anything else (kept as index.html, inline <script> moved to page.js)

   Output of convertPage():
     { vid, title, is3d, hooked, files:[{path,bytes,type}], libs:[{path,bytes,type}] }
     files → /p/<key>/<vid>/<path>        (page's own HTML / CSS / JS / images)
     libs  → /<path> = /lib/<hash>.<ext>  (three.js, controls, fonts… shared & deduplicated)  */

const te = new TextEncoder();
const td = new TextDecoder();

export async function sha(data, n = 10) {
  const bytes = typeof data === 'string' ? te.encode(data) : data;
  const h = new Uint8Array(await crypto.subtle.digest('SHA-1', bytes));
  return Array.from(h, b => b.toString(16).padStart(2, '0')).join('').slice(0, n);
}

function b64(s) {
  const bin = atob(s.replace(/\s+/g, ''));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

async function gunzip(u) {
  const stream = new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const MIME_EXT = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg',
  'font/woff2': 'woff2', 'font/woff': 'woff', 'font/ttf': 'ttf', 'font/otf': 'otf',
  'model/gltf-binary': 'glb', 'model/gltf+json': 'gltf', 'application/json': 'json', 'text/css': 'css',
  'application/javascript': 'js', 'text/javascript': 'js', 'application/octet-stream': 'bin',
};
export const EXT_MIME = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  json: 'application/json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  svg: 'image/svg+xml', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf',
  glb: 'model/gltf-binary', gltf: 'model/gltf+json', bin: 'application/octet-stream',
};
const typeOf = p => EXT_MIME[(p.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';

/** Shell file with many pages → [{ key, html, meta }] ; otherwise null.
    meta (site / unit / desc / label) is read from the shell's own sidebar when it has one. */
export function splitShell(html) {
  const out = [];
  for (const m of html.matchAll(/<script type="text\/plain" id="d-([\w-]+)">([\s\S]*?)<\/script>/g)) {
    out.push({ key: m[1], html: td.decode(b64(m[2])), meta: null });
  }
  if (!out.length) return null;
  const text = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
  const meta = {};
  let sort = 10;
  // each sidebar group: <div class="grp"><button class="nb" …><span class="p">site</span><b>unit</b><small>desc</small></button>
  //                      <div class="sub"><button class="sb" data-k="key">label</button>…</div></div>
  for (const g of html.split(/<div class="grp">/).slice(1)) {
    const site = (g.match(/<span class="p">([\s\S]*?)<\/span>/) || [])[1];
    const unit = (g.match(/<b>([\s\S]*?)<\/b>/) || [])[1];
    const desc = (g.match(/<small>([\s\S]*?)<\/small>/) || [])[1];
    const subs = [...g.matchAll(/<button class="sb[^"]*" data-k="([\w-]+)">([\s\S]*?)<\/button>/g)];
    const nb = g.match(/<button class="nb" data-k="([\w-]+)"/);
    const keys = subs.length ? subs.map(x => [x[1], text(x[2])]) : (nb ? [[nb[1], '']] : []);
    for (const [k, label] of keys) {
      meta[k] = { site: site ? text(site) : '', unit: unit ? text(unit) : '', desc: desc ? text(desc) : '', label, sort: sort++ };
    }
  }
  out.forEach(o => { o.meta = meta[o.key] || null; });
  return out;
}

/** Adds `window.__review = {...}` after the OrbitControls line so comments can pin to 3D points. */
export function injectHook(code) {
  if (/window\.__review\b/.test(code)) return { code, hooked: true };
  const name = re => { const m = re.exec(code); return m && m[1]; };
  const V = '(?<![\\w.$])([A-Za-z_$][\\w$]*)\\s*=\\s*new\\s+';
  const scene = name(new RegExp(V + 'THREE\\.Scene\\('));
  const camera = name(new RegExp(V + 'THREE\\.(?:Perspective|Orthographic)Camera\\('));
  const renderer = name(new RegExp(V + 'THREE\\.WebGLRenderer\\('));
  const ctl = new RegExp(V + '(?:THREE\\.)?OrbitControls\\([^;\\n]*\\);?').exec(code);
  if (!scene || !camera || !renderer || !ctl) return { code, hooked: false };
  const at = ctl.index + ctl[0].length;
  const hook = '\n  /* review hook: lets the comment panel read the camera, pick 3D points and take snapshots */\n' +
    `  window.__review = { THREE: THREE, scene: ${scene}, camera: ${camera}, renderer: ${renderer}, controls: ${ctl[1]} };\n`;
  return { code: code.slice(0, at) + hook + code.slice(at), hooked: true };
}

function isLibraryJS(s, size) {
  const head = s.slice(0, 1500);
  if (/Three\.js Authors|three\.module|REVISION\s*=\s*['"]\d+/.test(head) && size > 200000) return true;
  if (/customElements\.define\(\s*['"]doc-page/.test(s)) return true;
  if (/OrbitControls|TrackballControls|GLTFLoader|DRACOLoader/.test(head) && !/new\s+THREE\.(Scene|WebGLRenderer)\(/.test(s)) return true;
  if (/@license|^\s*\/\*!/.test(head) && size > 20000) return true;
  return size > 300000;
}

export async function convertPage(html) {
  const vid = await sha(html, 8);
  const files = [];
  const libs = new Map();
  let hooked = false;
  const addLib = async (bytes, ext, type) => {
    const p = `lib/${await sha(bytes, 12)}.${ext}`;
    if (!libs.has(p)) libs.set(p, { path: p, bytes, type });
    return '/' + p;
  };

  const grab = t => {
    const m = html.match(new RegExp(`<script type="__bundler/${t}">\\s*([\\s\\S]*?)\\s*</script>`));
    return m ? JSON.parse(m[1]) : null;
  };
  const manifest = grab('manifest');
  const template = grab('template');
  let t;

  if (manifest && template != null) {
    t = template;
    const n = { img: 0, js: 0, asset: 0 };
    for (const [uuid, e] of Object.entries(manifest)) {
      let bytes = b64(e.data);
      if (e.compressed) bytes = await gunzip(bytes);
      const mime = String(e.mime || '').split(';')[0].trim();
      const ext = MIME_EXT[mime] || (mime.startsWith('font/') ? mime.slice(5) : 'bin');
      let rel;
      if (mime.startsWith('font/')) {
        rel = await addLib(bytes, ext, typeOf('x.' + ext));
      } else if (/javascript/.test(mime)) {
        const s = td.decode(bytes);
        if (isLibraryJS(s, bytes.length)) rel = await addLib(bytes, 'js', EXT_MIME.js);
        else {
          const h = injectHook(s); hooked = hooked || h.hooked;
          rel = n.js++ ? `main${n.js}.js` : 'main.js';
          files.push({ path: rel, bytes: te.encode(h.code), type: EXT_MIME.js });
        }
      } else if (mime.startsWith('image/')) {
        rel = `img/${String(++n.img).padStart(2, '0')}.${ext}`;
        files.push({ path: rel, bytes, type: mime });
      } else {
        rel = `assets/${String(++n.asset).padStart(2, '0')}.${ext}`;
        files.push({ path: rel, bytes, type: mime || EXT_MIME.bin });
      }
      t = t.split(uuid).join(rel);
    }
    t = t.replace(/\s+integrity="[^"]*"/gi, '').replace(/\s+crossorigin="[^"]*"/gi, '');
  } else {
    t = html;   // plain HTML page
  }

  // <style> → fonts.css / style.css
  const styles = [...t.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]);
  const fonts = styles.filter(s => s.includes('@font-face'));
  const rest = styles.filter(s => !s.includes('@font-face') && s.trim());
  let links = '';
  if (fonts.length) { files.push({ path: 'fonts.css', bytes: te.encode(fonts.join('').trim() + '\n'), type: EXT_MIME.css }); links += '<link rel="stylesheet" href="fonts.css">\n'; }
  if (rest.length) { files.push({ path: 'style.css', bytes: te.encode(rest.map(s => s.trim()).join('\n') + '\n'), type: EXT_MIME.css }); links += '<link rel="stylesheet" href="style.css">\n'; }
  t = t.replace(/<style[^>]*>[\s\S]*?<\/style>\s*/g, '');
  t = /<\/head>/i.test(t) ? t.replace(/<\/head>/i, links + '</head>') : links + t;

  // inline classic <script> (no src / type) → page.js, in place of the first one
  const inline = [];
  t = t.replace(/<script>([\s\S]*?)<\/script>/g, (m, code) => {
    if (!code.trim()) return '';
    inline.push(code.trim());
    return inline.length === 1 ? '<script src="page.js"></script>' : '';
  });
  if (inline.length) {
    const h = injectHook(inline.join('\n\n')); hooked = hooked || h.hooked;
    files.push({ path: 'page.js', bytes: te.encode(h.code + '\n'), type: EXT_MIME.js });
  }

  t = t.replace(/\n{3,}/g, '\n\n');
  files.unshift({ path: 'index.html', bytes: te.encode(t), type: EXT_MIME.html });

  const title = ((t.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/<\\u002F/g, '</').trim();
  const is3d = /THREE\.|three(\.min)?\.js/.test(t) || files.some(f => f.path.endsWith('.js') && /new\s+THREE\./.test(td.decode(f.bytes)));
  return { vid, title, is3d, hooked, files, libs: [...libs.values()], source: te.encode(html) };
}

/** Whole upload (shell or single page) → [{ key|null, page }] */
export async function convertUpload(html) {
  const shell = splitShell(html);
  if (shell) {
    const out = [];
    for (const s of shell) out.push({ key: s.key, meta: s.meta, page: await convertPage(s.html) });
    return out;
  }
  return [{ key: null, page: await convertPage(html) }];
}

export function slug(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
