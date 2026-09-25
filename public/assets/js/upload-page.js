/* ───────── /upload — the simple upload page ─────────
   Drop file(s) → the page works out which page each belongs to → one button.
   Access: open /upload#k=<UPLOAD_KEY> once (the code is remembered in this browser). */
import { registry, prepare, send, newKey } from './uploader.js';

const API = window.CommentAPI;
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS_KEY = 'bmsReview.uploadKey', LS_AUTHOR = 'bmsReview.author';
const ls = { get: k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } } };

let R = null, items = [];

function show(id) { ['s-key', 's-drop', 's-read', 's-check', 's-send', 's-done'].forEach(s => { $('#' + s).hidden = s !== id; }); }

/* ── access code ── */
const m = /[#&]k=([^&]+)/.exec(location.hash);
if (m) { ls.set(LS_KEY, decodeURIComponent(m[1])); history.replaceState(null, '', location.pathname); }

async function checkKey() {
  const r = await fetch('/api/upload-auth', { headers: { 'x-upload-key': ls.get(LS_KEY) }, cache: 'no-store' });
  if (r.ok) return 'ok';
  const d = await r.json().catch(() => ({}));
  return d.code === 'no_upload_key' ? 'off' : 'bad';
}

$('#key-go').addEventListener('click', async () => {
  ls.set(LS_KEY, $('#key-in').value.trim());
  const st = await checkKey();
  if (st === 'ok') start(); else { $('#key-err').textContent = 'รหัสไม่ถูกต้อง'; $('#key-err').hidden = false; }
});
$('#key-in').addEventListener('keydown', e => { if (e.key === 'Enter') $('#key-go').click(); });

/* ── choose files ── */
const drop = $('#drop'), fileIn = $('#file');
drop.addEventListener('click', () => fileIn.click());
drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileIn.click(); });
fileIn.addEventListener('change', () => { read([...fileIn.files]); fileIn.value = ''; });
['dragenter', 'dragover'].forEach(t => document.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => document.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
document.addEventListener('drop', e => { if (!$('#s-drop').hidden) read([...e.dataTransfer.files]); });

async function read(files) {
  files = files.filter(f => /\.html?$/i.test(f.name));
  if (!files.length) { alert('เลือกไฟล์ .html เท่านั้น'); return; }
  show('s-read');
  try {
    R = registry(await API.pages());
    items = [];
    for (const f of files) items.push(...await prepare(f, R));
    $('#author').value = ls.get(LS_AUTHOR);
    $('#note').value = '';
    $('#err').hidden = true;
    render();
    show('s-check');
  } catch (e) {
    show('s-drop');
    alert('อ่านไฟล์ไม่ได้: ' + e.message);
  }
}

/* ── confirm screen ── */
function render() {
  const sites = [...new Set(R.pages.map(p => p.site).filter(Boolean))];
  $('#items').innerHTML = '<datalist id="dl-site">' + sites.map(s => '<option value="' + esc(s) + '">').join('') + '</datalist>' +
    items.map((it, i) => {
      if (it.dup) {
        return '<div class="item dup"><div class="ic">⏭</div><div class="tx"><div class="t">' + esc(R.title(it.target)) + '</div>' +
          '<div class="s">ไฟล์นี้อัพไปแล้ว (<span class="v">v' + it.dup.no + '</span>) — จะข้ามไป</div></div></div>';
      }
      if (it.target) {
        const next = (R.latest(it.target) || { no: 0 }).no + 1;
        return '<div class="item" data-i="' + i + '"><div class="ic">✅</div><div class="tx">' +
          '<div class="t">' + esc(R.title(it.target)) + '</div>' +
          '<div class="s">จะขึ้นเป็นเวอร์ชันใหม่ <span class="v">v' + next + '</span> · ' + esc(it.fileName) + '</div>' +
          '<button class="change" data-act="change">ไม่ใช่หน้านี้?</button>' +
          '<select data-f="target" hidden>' + pick(it) + '</select></div></div>';
      }
      return '<div class="item new" data-i="' + i + '"><div class="ic">🆕</div><div class="tx">' +
        '<div class="t">หน้าใหม่ · ' + (it.page.is3d ? '3D model' : 'Review sheet') + '</div>' +
        '<div class="s">' + esc(it.fileName) + '</div>' +
        '<div class="row"><label>ชื่ออุปกรณ์<input data-f="unit" value="' + esc(it.meta.unit) + '" required></label>' +
        '<label>ไซต์ / โครงการ<input data-f="site" list="dl-site" value="' + esc(it.meta.site) + '" placeholder="เช่น Rosewood Bangkok"></label></div>' +
        (R.pages.length ? '<button class="change" data-act="change">เป็นเวอร์ชันใหม่ของหน้าที่มีอยู่?</button><select data-f="target" hidden>' + pick(it) + '</select>' : '') +
        '</div></div>';
    }).join('');

  $('#items').querySelectorAll('[data-act=change]').forEach(b => b.addEventListener('click', () => {
    b.hidden = true; b.nextElementSibling.hidden = false; b.nextElementSibling.focus();
  }));
  $('#items').querySelectorAll('[data-f]').forEach(inp => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
    const it = items[+inp.closest('.item').dataset.i];
    if (inp.dataset.f === 'target') { it.target = inp.value; it.dup = inp.value ? R.findVer(inp.value, it.page.vid) : null; render(); }
    else it.meta[inp.dataset.f] = inp.value;
  }));
  const todo = items.filter(it => !it.dup).length;
  $('#go').disabled = !todo;
  $('#go').textContent = !todo ? 'ไม่มีไฟล์ใหม่' : todo > 1 ? 'อัพโหลด ' + todo + ' หน้า' : 'อัพโหลด';
}

function pick(it) {
  const is3d = it.page.is3d;
  return '<option value="">＋ สร้างเป็นหน้าใหม่</option>' + R.pages
    .filter(p => is3d ? !/sheet/i.test(p.label) : !/3d/i.test(p.label))
    .map(p => '<option value="' + esc(p.key) + '"' + (p.key === it.target ? ' selected' : '') + '>' + esc(R.title(p.key)) +
      ' (ตอนนี้ v' + (R.latest(p.key) || {}).no + ')</option>').join('');
}

$('#again').addEventListener('click', () => show('s-drop'));
$('#next').addEventListener('click', () => show('s-drop'));

$('#go').addEventListener('click', async () => {
  const bad = items.find(it => !it.dup && !it.target && !String(it.meta.unit).trim());
  if (bad) { $('#err').textContent = 'ใส่ชื่ออุปกรณ์ของหน้าใหม่ก่อน'; $('#err').hidden = false; return; }
  const author = $('#author').value.trim();
  ls.set(LS_AUTHOR, author);
  // new pages: make a readable, unique key from the name
  items.forEach(it => { if (!it.target && !it.dup) it.key = newKey(R, it.meta.unit, it.page.is3d); });
  show('s-send');
  try {
    const done = await send(items, {
      note: $('#note').value.trim(), author,
      onProgress: (f) => { $('#bar').style.width = Math.round(f * 100) + '%'; $('#bar-t').textContent = Math.round(f * 100) + '%'; },
    });
    R = registry(await API.pages());
    $('#done-list').innerHTML = done.map(d => {
      const v = R.findVer(d.key, d.vid);
      return '<div class="item"><div class="ic">📦</div><div class="tx"><div class="t">' + esc(R.title(d.key)) + '</div>' +
        '<div class="s"><span class="v">v' + (v ? v.no : '?') + '</span> · <a href="/#' + esc(d.key) + '@' + esc(d.vid) + '">เปิดดู →</a></div></div></div>';
    }).join('') + (items.some(it => it.dup) ? '<p class="hint">ไฟล์ที่เคยอัพแล้วถูกข้ามไป</p>' : '');
    show('s-done');
  } catch (e) {
    show('s-check');
    $('#err').textContent = 'อัพโหลดไม่สำเร็จ: ' + e.message + ' — ลองกดอีกครั้ง';
    $('#err').hidden = false;
  }
});

/* ── start ── */
async function start() {
  await API.init();
  if (API.mode !== 'remote') { document.querySelector('main').insertAdjacentHTML('beforeend', '<p class="msg err">หน้านี้ใช้ได้บนเว็บที่ deploy แล้วเท่านั้น</p>'); return; }
  const st = await checkKey();
  if (st === 'off') { show('s-key'); $('#key-go').disabled = true; $('#key-err').textContent = 'ผู้ดูแลยังไม่ได้เปิดการอัพโหลด (ตั้ง UPLOAD_KEY)'; $('#key-err').hidden = false; return; }
  if (st === 'bad') { show('s-key'); return; }
  show('s-drop');
}
start();
