/* ───────── Web upload: drop a standalone HTML → split into files → new version ─────────
   Splitting happens here in the browser (same code as tools/build.mjs), then each file is
   PUT to R2 through the Worker and the version is registered in D1. */
import { convertUpload, slug } from './unbundle.js';
import { matchPage, send, registry } from './uploader.js';

const API = window.CommentAPI, V = window.Viewer;
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS_AUTHOR = 'bmsReview.author';
const dlg = $('#up'), itemsEl = $('#up-items'), err = $('#up-err'), go = $('#up-go'), prog = $('#up-prog');
let items = [];          // [{ page, key, target, meta:{site,unit,desc,label}, fileName }]
let busy = false;

function openDialog(targetKey) {
  items = []; itemsEl.innerHTML = ''; err.hidden = true; prog.hidden = true;
  $('#up-common').hidden = true; go.disabled = true; $('#up-drop').hidden = false;
  dlg.dataset.target = targetKey || '';
  try { $('#up-author').value = localStorage.getItem(LS_AUTHOR) || ''; } catch (e) { /* ignore */ }
  $('#up-note').value = '';
  dlg.showModal();
}
function close() { if (!busy) dlg.close(); }

$('#up-btn').addEventListener('click', () => openDialog(''));
$('#ver-up').addEventListener('click', () => openDialog(V.key));
$('#up-x').addEventListener('click', close);
$('#up-cancel').addEventListener('click', close);
dlg.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
$('#up-pick').addEventListener('click', () => $('#up-file').click());
$('#up-file').addEventListener('change', e => { if (e.target.files[0]) readFile(e.target.files[0]); e.target.value = ''; });
const drop = $('#up-drop');
['dragenter', 'dragover'].forEach(t => dlg.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => dlg.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
dlg.addEventListener('drop', e => { const f = [...e.dataTransfer.files].find(x => /\.html?$/i.test(x.name)); if (f) readFile(f); });

function guessTarget(page) { return matchPage(page, registry({ pages: V.registry.pages, versions: [].concat(...Object.values(V.registry.versions)) })); }

async function readFile(file) {
  err.hidden = true;
  $('#up-drop').querySelector('b').textContent = 'กำลังแยกไฟล์ ' + file.name + ' …';
  try {
    const html = await file.text();
    const parts = await convertUpload(html);
    const R = V.registry;
    const note = file.name.replace(/\.html?$/i, '');
    items = parts.map(({ key, page, meta: shellMeta }) => {
      const fixed = dlg.dataset.target && parts.length === 1 ? dlg.dataset.target : '';
      const target = fixed || (key && R.byKey[key] ? key : (!key ? guessTarget(page) : ''));
      const newKey = key || slug(page.title) || slug(note) || 'page';
      return {
        page, fileName: file.name, target,
        key: target || newKey,
        meta: Object.assign({ site: '', unit: page.title || newKey, desc: '', label: page.is3d ? '3D model' : 'Review sheet' },
          shellMeta ? Object.fromEntries(Object.entries(shellMeta).filter(([, v]) => v !== '' && v != null)) : {}),
      };
    });
    $('#up-note').value = note;
    $('#up-drop').hidden = true;
    $('#up-common').hidden = false;
    renderItems();
  } catch (e) {
    $('#up-drop').querySelector('b').textContent = 'ลากไฟล์ .html มาวางที่นี่';
    showErr('อ่านไฟล์ไม่สำเร็จ: ' + e.message);
  }
}

function renderItems() {
  const R = V.registry;
  const sites = [...new Set(R.pages.map(p => p.site).filter(Boolean))];
  const units = [...new Set(R.pages.map(p => p.unit).filter(Boolean))];
  itemsEl.innerHTML =
    '<datalist id="dl-site">' + sites.map(x => '<option value="' + esc(x) + '">').join('') + '</datalist>' +
    '<datalist id="dl-unit">' + units.map(x => '<option value="' + esc(x) + '">').join('') + '</datalist>' +
    '<datalist id="dl-label"><option value="3D model"><option value="Review sheet"></datalist>' +
    items.map((it, i) => {
      const dup = it.target && V.findVer(it.target, it.page.vid);
      const size = it.page.files.reduce((n, f) => n + f.bytes.length, 0) + it.page.libs.reduce((n, f) => n + f.bytes.length, 0);
      return '<div class="ui' + (dup ? ' dup' : '') + '" data-i="' + i + '">' +
        '<div class="ui-h"><span class="chip">' + (it.page.is3d ? '3D' : 'Page') + '</span><b>' + esc(it.page.title || it.fileName) + '</b>' +
        '<small>' + it.page.files.length + ' ไฟล์ + ' + it.page.libs.length + ' ไลบรารี · ' + (size / 1048576).toFixed(1) + ' MB' +
        (it.page.is3d ? (it.page.hooked ? ' · หมุด 3D ✓' : ' · ⚠ หมุดจะไม่ติดโมเดล') : '') + '</small></div>' +
        '<label>อัพเป็น<select data-f="target"><option value="">＋ หน้าใหม่</option>' +
        R.pages.map(p => '<option value="' + esc(p.key) + '"' + (p.key === it.target ? ' selected' : '') + '>เวอร์ชันใหม่ของ: ' +
          esc(p.unit + ' · ' + p.label) + ' (ตอนนี้ v' + (V.latest(p.key) || {}).no + ')</option>').join('') + '</select></label>' +
        (dup ? '<p class="warn">ไฟล์นี้ตรงกับ v' + dup.no + ' ที่มีอยู่แล้ว — จะข้าม</p>' : '') +
        (it.target ? '' :
          '<div class="f-grid">' +
          '<label>ไซต์<input data-f="site" list="dl-site" value="' + esc(it.meta.site) + '" placeholder="เช่น Silom Complex"></label>' +
          '<label>อุปกรณ์<input data-f="unit" list="dl-unit" value="' + esc(it.meta.unit) + '"></label>' +
          '<label>ประเภท<input data-f="label" list="dl-label" value="' + esc(it.meta.label) + '"></label>' +
          '<label>รหัสหน้า (URL)<input data-f="key" value="' + esc(it.key) + '" pattern="[a-z0-9][a-z0-9\\-]{0,39}"></label>' +
          '<label class="wide">คำอธิบาย<input data-f="desc" value="' + esc(it.meta.desc) + '" placeholder="เช่น Fill media, internal spray"></label>' +
          '</div>') +
        '</div>';
    }).join('');
  itemsEl.querySelectorAll('[data-f]').forEach(inp => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
    const it = items[+inp.closest('.ui').dataset.i], f = inp.dataset.f;
    if (f === 'target') { it.target = inp.value; it.key = inp.value || slug(it.meta.unit + '-' + (it.page.is3d ? '3d' : 'sheet')) || it.key; renderItems(); return; }
    if (f === 'key') it.key = slug(inp.value) || inp.value;
    else {
      it.meta[f] = inp.value;
      if (f === 'unit' || f === 'label') {           // keep the auto key in step until the user edits it
        const k = slug(it.meta.unit) + (/3d/i.test(it.meta.label) ? '-3d' : /sheet/i.test(it.meta.label) ? '-sheet' : '');
        const keyInp = inp.closest('.ui').querySelector('[data-f=key]');
        if (keyInp && !keyInp.dataset.touched) { it.key = k.slice(0, 40); keyInp.value = it.key; }
      }
    }
    validate();
  }));
  itemsEl.querySelectorAll('[data-f=key]').forEach(i => i.addEventListener('input', () => { i.dataset.touched = '1'; }));
  validate();
}

function validate() {
  const todo = items.filter(it => !(it.target && V.findVer(it.target, it.page.vid)));
  const bad = todo.find(it => !it.target && (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(it.key) || V.registry.byKey[it.key] || !it.meta.unit.trim()));
  go.disabled = busy || !todo.length || !!bad;
  go.textContent = todo.length > 1 ? 'อัพโหลด ' + todo.length + ' หน้า' : 'อัพโหลด';
  if (bad && V.registry.byKey[bad.key]) showErr('รหัสหน้า "' + bad.key + '" มีอยู่แล้ว — เลือก "เวอร์ชันใหม่ของ…" หรือเปลี่ยนรหัส');
  else err.hidden = true;
}

function showErr(m) { err.textContent = m; err.hidden = false; }
function progress(done, total, label) {
  prog.hidden = false;
  prog.querySelector('i').style.width = Math.round(done / Math.max(1, total) * 100) + '%';
  prog.querySelector('span').textContent = label + ' ' + done + '/' + total;
}

go.addEventListener('click', async () => {
  const todo = items.filter(it => !(it.target && V.findVer(it.target, it.page.vid)));
  if (!todo.length || busy) return;
  busy = true; go.disabled = true; err.hidden = true;
  const author = $('#up-author').value.trim(), note = $('#up-note').value.trim();
  try { localStorage.setItem(LS_AUTHOR, author); } catch (e) { /* ignore */ }
  try {
    const done = await send(todo.map(it => Object.assign({}, it, { dup: null })), {
      note, author, onProgress: (f, label) => progress(Math.round(f * 100), 100, 'อัพโหลด ' + label),
    });
    const last = done[done.length - 1];
    busy = false;
    dlg.close();
    await V.reload();
    if (last) { V.open(last.key, last.vid); toast('อัพโหลดแล้ว · ' + V.pageTitle(last.key) + ' v' + V.versionNo(last.key, last.vid)); }
  } catch (e) {
    busy = false; validate();
    showErr(e.data && e.data.code === 'no_upload_key'
      ? 'ยังเปิดอัพโหลดผ่านเว็บไม่ได้: ตั้ง Secret ชื่อ UPLOAD_KEY ใน Worker → Settings → Variables and Secrets ก่อน'
      : 'อัพโหลดไม่สำเร็จ: ' + e.message);
  }
});

function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
