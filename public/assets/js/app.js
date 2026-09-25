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
  const fr = $('#fr'), ld = $('#ld'), navList = $('#nav-list'), sel = $('#ver');
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
    R.canUpload = !!d.canUpload;
  }

  /* ── sidebar: grouped by unit (equipment), one pill per page ── */
  function renderNav() {
    const units = [];
    const byUnit = {};
    R.pages.forEach(p => {
      const u = (p.site || '') + '|' + (p.unit || p.key);
      if (!byUnit[u]) { byUnit[u] = { site: p.site, unit: p.unit || p.key, desc: p.desc, pages: [] }; units.push(byUnit[u]); }
      byUnit[u].pages.push(p);
      if (!byUnit[u].desc && p.desc) byUnit[u].desc = p.desc;
    });
    navList.innerHTML = units.map(u => {
      const main = u.pages.find(p => /3d/i.test(p.label)) || u.pages[0];
      return '<div class="grp"><button class="nb" data-k="' + esc(main.key) + '"><span class="p">' + esc(u.site || '') + '</span>' +
        '<b>' + esc(u.unit) + '</b>' + (u.desc ? '<small>' + esc(u.desc) + '</small>' : '') + '</button>' +
        '<div class="sub">' + u.pages.map(p => {
          const lv = latest(p.key);
          return '<button class="sb' + (isNew(lv) ? ' new' : '') + '" data-k="' + esc(p.key) + '" title="' +
            esc('v' + lv.no + ' · ' + fmtDate(lv.created_at) + (lv.note ? ' · ' + lv.note : '')) + '">' + esc(p.label) +
            '<em>v' + lv.no + '</em></button>';
        }).join('') + '</div></div>';
    }).join('') || '<div class="empty">ยังไม่มีหน้า — อัพโหลดไฟล์ HTML หรือใส่ไฟล์ในโฟลเดอร์ uploads/</div>';
    navList.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => open(b.dataset.k)));
    markActive();
    $('#up-btn').hidden = !R.canUpload;
    $('#ver-up').hidden = !R.canUpload;
  }
  function markActive() { navList.querySelectorAll('.sb').forEach(b => b.classList.toggle('on', b.dataset.k === cur)); }

  /* ── version bar ── */
  function renderBar() {
    const p = R.byKey[cur], vs = R.versions[cur] || [], v = findVer(cur, curVid), lv = latest(cur);
    $('#bar-unit').textContent = p ? p.unit : '';
    $('#bar-label').textContent = p ? p.label : '';
    sel.innerHTML = vs.slice().reverse().map(x =>
      '<option value="' + esc(x.vid) + '">v' + x.no + ' · ' + esc(fmtDate(x.created_at)) + (x === lv ? ' (ล่าสุด)' : '') +
      (x.note ? ' — ' + esc(x.note.slice(0, 50)) : '') + '</option>').join('');
    sel.value = curVid || '';
    const old = v && lv && v.vid !== lv.vid;
    const chip = $('#ver-old');
    chip.hidden = !old;
    if (old) chip.innerHTML = 'เวอร์ชันเก่า · <a href="#' + esc(cur) + '">ดู v' + lv.no + '</a>';
    $('#ver-meta').textContent = v ? [v.title, v.author ? 'โดย ' + v.author : '', v.source === 'git' ? 'Git' : 'เว็บ'].filter(Boolean).join(' · ') : '';
    const base = '/p/' + cur + '/' + curVid + '/';
    $('#ver-open').href = base;
    $('#ver-src').href = '/src/' + cur + '/' + curVid + '.html';
    $('#ver-src').setAttribute('download', cur + '-v' + (v ? v.no : '') + '.html');
    $('#ver-del').hidden = !(R.canUpload && v && v.source === 'web');
  }
  sel.addEventListener('change', () => open(cur, sel.value));

  $('#ver-del').addEventListener('click', async () => {
    const v = findVer(cur, curVid);
    if (!v || !confirm('ลบ v' + v.no + ' ของ ' + pageTitle(cur) + '?\nคอมเมนต์ของเวอร์ชันนี้จะยังอยู่')) return;
    try { await API.deleteVersion(cur, curVid); await reload(); open(cur); } catch (e) { alert('ลบไม่สำเร็จ: ' + e.message); }
  });

  /* ── open a page/version ── */
  function open(k, vid) {
    if (!R.byKey[k]) k = (R.pages[0] || {}).key;
    if (!k) return;
    const v = (vid && findVer(k, vid)) || latest(k);
    if (k === cur && v.vid === curVid) return;
    cur = k; curVid = v.vid; loaded = false;
    ld.style.display = 'flex';
    fr.src = '/p/' + k + '/' + v.vid + '/';
    markActive(); renderBar();
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
    try { await loadRegistry(); } catch (e) { navList.innerHTML = '<div class="empty">โหลดรายการหน้าไม่สำเร็จ: ' + esc(e.message) + '</div>'; }
    renderNav();
    const h = parseHash();
    let k0 = h && R.byKey[h.key] ? h.key : null;
    if (!k0) { try { k0 = localStorage.getItem(LS_KEY); } catch (e) { /* ignore */ } }
    open(k0 && R.byKey[k0] ? k0 : (R.pages[0] || {}).key, h && h.key === k0 ? h.vid : null);
    readyResolve();
  })();
})();
