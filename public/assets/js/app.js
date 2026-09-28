/* ───────── Viewer: pages, versions, iframe ─────────
   Sidebar + versions come from the registry (/api/pages, or p/manifest.json offline).
   A version is served at /p/<key>/<vid>/ (separate HTML / CSS / JS).
   URL hash:  #ct5-3d                → latest version
              #ct5-3d@aae6e8e5       → that version
              #ct5-3d@aae6e8e5/c=<id> → and focus one comment                       */
(function () {
  'use strict';
  const API = window.CommentAPI;
  const $ = s => document.querySelector(s);
  const fr = $('#fr'), ld = $('#ld'), navTabs = $('#nav-tabs'), navSub = $('#nav-sub'), sel = $('#ver');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LS_KEY = 'bmsReview.k';
  const NEW_DAYS = 3;

  const R = { pages: [], byKey: {}, versions: {}, canUpload: false };
  let cur = null, curVid = null, loaded = false, waiters = [];

  const fmtDate = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleDateString('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const latest = k => { const v = R.versions[k] || []; return v[v.length - 1] || null; };
  const findVer = (k, vid) => (R.versions[k] || []).find(v => v.vid === vid) || null;
  const pageTitle = k => { const p = R.byKey[k]; return p ? p.unit + ' · ' + p.label : k; };
  const isNew = v => v && v.created_at && (Date.now() - new Date(v.created_at)) < NEW_DAYS * 864e5 && v.no > 1;

  async function loadRegistry() {
    const d = await API.pages();
    R.pages = d.pages || [];
    R.byKey = {}; R.versions = {};
    R.pages.forEach(p => { R.byKey[p.key] = p; R.versions[p.key] = []; });
    (d.versions || []).forEach(v => { (R.versions[v.key] = R.versions[v.key] || []).push(v); });
    Object.values(R.versions).forEach(a => a.sort((x, y) => x.no - y.no));
    R.pages = R.pages.filter(p => (R.versions[p.key] || []).length);   // hide pages without any version
    R.byKey = {}; R.pages.forEach(p => { R.byKey[p.key] = p; });
    // upload buttons only for browsers that were given the upload key (via /upload#k=… or the key prompt);
    // the server still checks the key on every upload, the button is just not shown to everyone else
    let hasKey = false; try { hasKey = !!localStorage.getItem('bmsReview.uploadKey'); } catch (e) { /* ignore */ }
    R.canUpload = !!d.canUpload && hasKey;
  }

  /* ── sidebar: grouped by unit (equipment), one pill per page ── */
  /* ── orange tabs = equipment (unit); sub bar = its pages (REVIEW SHEET / 3D MODEL …) ── */
  function groups() {
    const list = [], byUnit = {};
    R.pages.forEach(p => {
      const u = String(p.unit || p.key).trim().toLowerCase();
      if (!byUnit[u]) { byUnit[u] = { unit: p.unit || p.key, desc: p.desc || '', pages: [], sort: p.sort ?? 1000 }; list.push(byUnit[u]); }
      const g = byUnit[u];
      g.pages.push(p);
      g.sort = Math.min(g.sort, p.sort ?? 1000);
      if (!g.desc && p.desc) g.desc = p.desc;
    });
    list.sort((a, b) => a.sort - b.sort);
    // sheet first, then 3D, then anything else
    const rank = p => /sheet/i.test(p.label) ? 0 : /3d/i.test(p.label) ? 1 : 2;
    list.forEach(g => g.pages.sort((a, b) => rank(a) - rank(b) || (a.sort ?? 0) - (b.sort ?? 0)));
    return list;
  }
  const groupOf = k => groups().find(g => g.pages.some(p => p.key === k));

  function renderNav() {
    const gs = groups();
    navTabs.innerHTML = gs.map(g => {
      const main = g.pages[0], fresh = g.pages.some(p => isNew(latest(p.key)));
      return '<button class="nv' + (fresh ? ' new' : '') + '" data-k="' + esc(main.key) + '" data-u="' + esc(g.unit) + '">' +
        '<b>' + esc(g.unit) + '</b>' + (g.desc ? '<span>' + esc(g.desc) + '</span>' : '') + '</button>';
    }).join('') || '<div class="empty">ยังไม่มีหน้า — อัพโหลดไฟล์ HTML หรือใส่ไฟล์ในโฟลเดอร์ uploads/</div>';
    navTabs.querySelectorAll('.nv').forEach(b => b.addEventListener('click', () => open(b.dataset.k)));
    renderSub();
    $('#up-btn').hidden = !R.canUpload;
    $('#ver-up').hidden = !R.canUpload;
  }
  function renderSub() {
    const g = groupOf(cur);
    navSub.innerHTML = g ? g.pages.map(p => {
      const lv = latest(p.key);
      return '<button class="sb" data-k="' + esc(p.key) + '" title="' +
        esc('v' + lv.no + ' · ' + fmtDate(lv.created_at) + (lv.note ? ' · ' + lv.note : '')) + '">' + esc(p.label) + '<em>v' + lv.no + '</em></button>';
    }).join('') : '';
    navSub.querySelectorAll('.sb').forEach(b => b.addEventListener('click', () => open(b.dataset.k)));
    markActive();
  }
  function markActive() {
    const g = groupOf(cur);
    navTabs.querySelectorAll('.nv').forEach(b => b.classList.toggle('on', !!g && b.dataset.u === g.unit));
    navSub.querySelectorAll('.sb').forEach(b => b.classList.toggle('on', b.dataset.k === cur));
  }

  /* ── version bar ── */
  function renderBar() {
    const p = R.byKey[cur], vs = R.versions[cur] || [], v = findVer(cur, curVid), lv = latest(cur);
    sel.innerHTML = vs.slice().reverse().map(x =>
      '<option value="' + esc(x.vid) + '">v' + x.no + ' · ' + esc(fmtDate(x.created_at)) + (x === lv ? ' (ล่าสุด)' : '') +
      (x.note ? ' — ' + esc(x.note.slice(0, 50)) : '') + '</option>').join('');
    sel.value = curVid || '';
    const old = v && lv && v.vid !== lv.vid;
    const chip = $('#ver-old');
    chip.hidden = !old;
    if (old) chip.innerHTML = 'เวอร์ชันเก่า · <a href="#' + esc(cur) + '">ดู v' + lv.no + '</a>';
    sel.title = v ? [v.title, v.author ? 'โดย ' + v.author : '', v.source === 'git' ? 'Git' : 'เว็บ'].filter(Boolean).join(' · ') : '';
    $('#doc-sub').textContent = 'ฉบับร่างเพื่ออนุมัติ' + (v ? ' · v' + v.no + ' · ' + fmtDate(v.created_at) : '');
    document.title = (p ? p.unit + ' · ' + p.label + ' — ' : '') + 'JEC · BMS 3D Design Review';
    const base = '/p/' + cur + '/' + curVid + '/';
    $('#ver-open').href = base;
    $('#ver-src').href = '/src/' + cur + '/' + curVid + '.html';
    $('#ver-src').setAttribute('download', cur + '-v' + (v ? v.no : '') + '-original.html');
    $('#ver-del').hidden = !(R.canUpload && v && v.source === 'web');
  }
  sel.addEventListener('change', () => open(cur, sel.value));

  $('#ver-del').addEventListener('click', async () => {
    const v = findVer(cur, curVid);
    if (!v || !confirm('ลบ v' + v.no + ' ของ ' + pageTitle(cur) + '?\nคอมเมนต์ของเวอร์ชันนี้จะยังอยู่')) return;
    try { await API.deleteVersion(cur, curVid); } catch (e) { alert('ลบไม่สำเร็จ: ' + e.message); return; }
    await reload();
    // deleting the only version removes the page, so fall back to the first page
    const k = R.byKey[cur] ? cur : (R.pages[0] || {}).key;
    curVid = null; open(k);
  });

  /* ── open a page/version ── */
  function open(k, vid) {
    if (!R.byKey[k]) k = (R.pages[0] || {}).key;
    if (!k) return;
    const v = (vid && findVer(k, vid)) || latest(k);
    if (!v) return;
    if (k === cur && v.vid === curVid) return;
    cur = k; curVid = v.vid; loaded = false;
    ld.style.display = 'flex';
    fr.src = '/p/' + k + '/' + v.vid + '/';
    renderSub(); renderBar();
    try { localStorage.setItem(LS_KEY, k); } catch (e) { /* private mode */ }
    const want = '#' + k + (v.vid === latest(k).vid ? '' : '@' + v.vid);
    if (!location.hash.startsWith(want) || (v.vid === latest(k).vid && location.hash.includes('@'))) history.replaceState(null, '', want);
    document.dispatchEvent(new CustomEvent('viewer:change', { detail: { key: k, vid: v.vid } }));
  }

  fr.addEventListener('load', () => {
    if (!fr.getAttribute('src')) return;
    ld.style.display = 'none';
    loaded = true;
    const w = waiters; waiters = [];
    w.forEach(fn => fn());
    document.dispatchEvent(new CustomEvent('viewer:load', { detail: { key: cur, vid: curVid } }));
  });

  function parseHash() {
    const m = /^#([\w-]+)(?:@([0-9a-f]{8}))?(?:\/c=([\w-]+))?/.exec(location.hash || '');
    return m ? { key: m[1], vid: m[2] || null, comment: m[3] || null } : null;
  }
  window.addEventListener('hashchange', () => { const h = parseHash(); if (h && !h.comment) open(h.key, h.vid); });

  async function reload() {
    await loadRegistry();
    renderNav();
    if (cur) renderBar();
    document.dispatchEvent(new CustomEvent('registry:change'));
  }

  let readyResolve;
  const ready = new Promise(r => { readyResolve = r; });

  window.Viewer = {
    open, reload, parseHash, pageTitle, latest, findVer,
    frame: fr,
    get registry() { return R; },
    get key() { return cur; },
    get vid() { return curVid; },
    get win() { try { return fr.contentWindow; } catch (e) { return null; } },
    get doc() { try { return fr.contentDocument; } catch (e) { return null; } },
    /** 3D pages expose { THREE, scene, camera, renderer, controls } via window.__review */
    get r3d() { try { return loaded ? fr.contentWindow.__review || null : null; } catch (e) { return null; } },
    /** first version of a page (comments made before versions existed belong to it) */
    firstVid(k) { const v = R.versions[k] || []; return v.length ? v[0].vid : null; },
    versionNo(k, vid) { const v = findVer(k, vid); return v ? v.no : null; },
    /** resolves when the registry is loaded */
    whenReady: () => ready,
    /** open page k (and version) and resolve once it has loaded */
    load(k, vid) {
      if (k && (k !== cur || (vid && vid !== curVid))) open(k, vid);
      return new Promise(res => (loaded ? res() : waiters.push(res)));
    },
  };

  (async function init() {
    await API.init();
    try { await loadRegistry(); } catch (e) { navTabs.innerHTML = '<div class="empty">โหลดรายการหน้าไม่สำเร็จ: ' + esc(e.message) + '</div>'; }
    renderNav();
    const h = parseHash();
    let k0 = h && R.byKey[h.key] ? h.key : null;
    if (!k0) { try { k0 = localStorage.getItem(LS_KEY); } catch (e) { /* ignore */ } }
    open(k0 && R.byKey[k0] ? k0 : (R.pages[0] || {}).key, h && h.key === k0 ? h.vid : null);
    readyResolve();
  })();
})();
