/* ───────── Review comments: pins, form, list ─────────
   Anchor types saved with each comment (so a pin can be drawn again later):
     world  : 3D point hit on the model  {p:[x,y,z]}   → follows the model when rotated
     canvas : 3D canvas, missed the model {x,y} 0–1    → exact only in the saved view
     doc    : review-sheet page           {x,y} 0–1 of the scrollable document
     screen : anywhere else in the frame  {x,y} 0–1 of the frame
   3D comments also save the camera view {p,t} so "ไปที่มุมมอง" restores it. */
(function () {
  'use strict';
  const API = window.CommentAPI, V = window.Viewer;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LS_AUTHOR = 'bmsReview.author';
  const MAX_FILES = 6;

  const el = {
    body: document.body, ov: $('#ov'), pins: $('#pins'), hint: $('#pinhint'),
    pinBtn: $('#pin-btn'), newBtn: $('#new-btn'), list: $('#cm-list'), mode: $('#cm-mode'),
    form: $('#cm-form'), where: $('#f-where'), snap: $('#f-snap'), snapOn: $('#snap-on'), snapImg: $('#snap-img'),
    file: $('#file'), fileBtn: $('#file-btn'), drop: $('#drop'), thumbs: $('#f-thumbs'), err: $('#f-err'),
    submit: $('#f-submit'), cancel: $('#f-cancel'), partList: $('#part-list'),
    toggle: $('#cm-toggle'), badge: $('#cm-badge'), lb: $('#lb'),
  };

  const S = {
    all: [], scope: 'page', status: 'open',
    pinning: false, draft: null,        // {anchor, view, part}
    files: [], snapshot: null,          // Blobs waiting to be sent
    activeId: null, busy: false,
  };

  /* ════════ helpers ════════ */
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const fmtDate = s => {
    if (!s) return '';
    const d = new Date(s.length === 10 ? s + 'T00:00:00' : s);
    return isNaN(d) ? s : d.toLocaleDateString('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const fmtStamp = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleString('th-TH-u-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }); };
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
  }
  const isDone = c => c.status === 'done';
  const topLevel = () => S.all.filter(c => !c.parent_id);
  const repliesOf = id => S.all.filter(c => c.parent_id === id).sort((a, b) => a.created_at < b.created_at ? -1 : 1);

  /** Shrink big photos before upload (keeps R2 small and uploads fast on site). */
  async function shrink(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400 * 1024) return file;
    try {
      const bmp = await createImageBitmap(file);
      const s = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
      const out = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85));
      if (!out || out.size >= file.size) return file;
      return new File([out], (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch (e) { return file; }
  }

  /* ════════ 3D / page helpers ════════ */
  function getView(R) { return { p: R.camera.position.toArray().map(n => +n.toFixed(4)), t: R.controls.target.toArray().map(n => +n.toFixed(4)) }; }

  function goToView(R, v) {
    if (!R || !v) return;
    const T = R.THREE, p0 = R.camera.position.clone(), t0 = R.controls.target.clone();
    const p1 = new T.Vector3().fromArray(v.p), t1 = new T.Vector3().fromArray(v.t);
    const t = performance.now(), dur = 550;
    (function step() {
      const k = Math.min(1, (performance.now() - t) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      R.camera.position.lerpVectors(p0, p1, e); R.controls.target.lerpVectors(t0, t1, e); R.controls.update();
      if (k < 1) requestAnimationFrame(step);
    })();
  }

  function visibleChain(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }

  function pickMesh(R, x, y) {
    const c = R.renderer.domElement.getBoundingClientRect();
    if (x < c.left || x > c.right || y < c.top || y > c.bottom) return { inCanvas: false };
    const T = R.THREE, rc = new T.Raycaster();
    rc.setFromCamera(new T.Vector2(((x - c.left) / c.width) * 2 - 1, -((y - c.top) / c.height) * 2 + 1), R.camera);
    const hit = rc.intersectObjects(R.scene.children, true).find(h => {
      const m = h.object.material;
      return h.object.isMesh && visibleChain(h.object) && !(m && m.transparent && m.opacity < 0.12);
    });
    return { inCanvas: true, hit, rel: { x: (x - c.left) / c.width, y: (y - c.top) / c.height } };
  }

  function meshName(o) {
    for (; o; o = o.parent) {
      const n = (o.userData && o.userData.label) || o.name;
      if (n && !/^(scene|group|mesh|object3d|status)$/i.test(n) && n.length < 60) return n;
    }
    return '';
  }

  /** Guess the "part" from the sheet/panel under the cursor (figure caption, section label…). */
  function partFromEl(e) {
    if (!e || !e.closest) return '';
    const fig = e.closest('figure');
    if (fig) { const b = fig.querySelector('figcaption b') || fig.querySelector('figcaption'); if (b) return b.textContent.trim(); }
    const sec = e.closest('.sec, .cell, .panel, [data-screen-label]');
    if (sec) {
      const h = sec.querySelector('.k, h1, h2, h3, b');
      if (h) return h.textContent.trim().slice(0, 80);
      if (sec.dataset.screenLabel) return sec.dataset.screenLabel;
    }
    return '';
  }

  /** Screen position (px inside the viewer) of a comment's anchor, or null if off-screen. */
  function project(a) {
    const fr = V.frame, W = fr.clientWidth, H = fr.clientHeight;
    const R = V.r3d, d = V.doc;
    let x, y, loose = false, behind = false;
    if (!a) return null;
    if (a.type === 'world' || a.type === 'canvas') {
      if (!R) return null;
      const c = R.renderer.domElement.getBoundingClientRect();
      if (a.type === 'world') {
        const v = new R.THREE.Vector3().fromArray(a.p).project(R.camera);
        if (v.z > 1) return null;
        x = c.left + (v.x + 1) / 2 * c.width; y = c.top + (1 - v.y) / 2 * c.height;
        if (x < c.left || x > c.right || y < c.top || y > c.bottom) return null;
      } else { x = c.left + a.x * c.width; y = c.top + a.y * c.height; loose = true; }
    } else if (a.type === 'doc' && d) {
      const se = d.scrollingElement || d.documentElement;
      x = a.x * se.scrollWidth - se.scrollLeft; y = a.y * se.scrollHeight - se.scrollTop;
    } else { x = a.x * W; y = a.y * H; }
    if (x < 0 || y < 0 || x > W || y > H) return null;
    return { x, y, loose, behind };
  }

  /** Is a world point hidden behind another part? (checked a few times per second) */
  function occluded(R, p) {
    const T = R.THREE, pt = new T.Vector3().fromArray(p), cam = R.camera.position;
    const dir = pt.clone().sub(cam), dist = dir.length();
    const rc = new T.Raycaster(cam.clone(), dir.normalize(), 0, dist - 0.02);
    return rc.intersectObjects(R.scene.children, true).some(h => h.object.isMesh && visibleChain(h.object) &&
      !(h.object.material && h.object.material.transparent && h.object.material.opacity < 0.5));
  }

  /** Snapshot of the 3D canvas with the pin drawn on it. */
  async function snapshot(R, rel) {
    try {
      R.renderer.render(R.scene, R.camera);                // fresh frame so the buffer isn't blank
      const src = R.renderer.domElement;
      const s = Math.min(1, 1400 / src.width);
      const cv = document.createElement('canvas');
      cv.width = Math.round(src.width * s); cv.height = Math.round(src.height * s);
      const g = cv.getContext('2d');
      g.drawImage(src, 0, 0, cv.width, cv.height);
      if (rel) {
        const x = rel.x * cv.width, y = rel.y * cv.height, r = Math.max(10, cv.width / 70);
        g.fillStyle = '#b5543a'; g.strokeStyle = '#fff'; g.lineWidth = r / 4;
        g.beginPath(); g.arc(x, y - r * 1.4, r, Math.PI * 0.8, Math.PI * 2.2); g.lineTo(x, y); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y - r * 1.4, r * 0.38, 0, Math.PI * 2); g.fill();
      }
      const b = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85));
      return b ? new File([b], 'view.jpg', { type: 'image/jpeg' }) : null;
    } catch (e) { return null; }
  }

  /* ════════ pin mode ════════ */
  function setPinning(on) {
    S.pinning = on;
    el.body.classList.toggle('pinning', on);
    el.hint.hidden = !on;
    el.pinBtn.textContent = on ? '✕ ยกเลิกปักหมุด' : '📍 ปักหมุดคอมเมนต์';
  }

  el.pinBtn.addEventListener('click', () => { if (S.pinning) setPinning(false); else { closeForm(); setPinning(true); el.body.classList.remove('cm-open'); } });
  el.newBtn.addEventListener('click', () => { setPinning(false); openForm({ anchor: null, view: V.r3d ? getView(V.r3d) : null, part: '' }); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!el.lb.hidden) { el.lb.hidden = true; return; }
    if (S.pinning) setPinning(false);
  });

  el.ov.addEventListener('click', async e => {
    if (!S.pinning) return;
    const r = V.frame.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const R = V.r3d, d = V.doc;
    let anchor = { type: 'screen', x: +(x / r.width).toFixed(4), y: +(y / r.height).toFixed(4) }, part = '', view = null, snapRel = null;

    if (R) {
      view = getView(R);
      const pk = pickMesh(R, x, y);
      if (pk.inCanvas) {
        snapRel = pk.rel;
        if (pk.hit) { const p = pk.hit.point; anchor = { type: 'world', p: [p.x, p.y, p.z].map(n => +n.toFixed(4)) }; part = meshName(pk.hit.object); }
        else anchor = { type: 'canvas', x: +pk.rel.x.toFixed(4), y: +pk.rel.y.toFixed(4) };
      } else if (d) part = partFromEl(d.elementFromPoint(x, y));
    } else if (d) {
      const se = d.scrollingElement || d.documentElement;
      anchor = { type: 'doc', x: +((x + se.scrollLeft) / se.scrollWidth).toFixed(4), y: +((y + se.scrollTop) / se.scrollHeight).toFixed(4) };
      part = partFromEl(d.elementFromPoint(x, y));
    }
    setPinning(false);
    openForm({ anchor, view, part });
    if (R && snapRel) { S.snapshot = await snapshot(R, snapRel); showSnapshot(); }
  });

  /* ════════ form ════════ */
  function openForm(draft) {
    S.draft = draft; S.files = []; S.snapshot = null;
    el.form.reset();
    try { el.form.author.value = localStorage.getItem(LS_AUTHOR) || ''; } catch (e) { /* ignore */ }
    el.form.review_date.value = today();
    el.form.part.value = draft.part || '';
    const title = V.titles[V.key] || V.key;
    const kind = !draft.anchor ? 'คอมเมนต์ทั่วไป (ทั้งหน้า)'
      : draft.anchor.type === 'world' ? 'หมุดบนโมเดล 3D'
      : draft.anchor.type === 'canvas' ? 'หมุดในมุมมอง 3D (ไม่โดนชิ้นส่วน)'
      : 'หมุดบนหน้า';
    el.where.innerHTML = '<b>' + esc(title) + '</b><br>' + esc(kind);
    el.snap.hidden = true; el.err.hidden = true;
    renderThumbs(); fillPartList();
    el.form.hidden = false;
    el.body.classList.add('cm-open');
    renderPins();
    setTimeout(() => (el.form.author.value ? el.form.body : el.form.author).focus(), 30);
  }

  function closeForm() {
    el.form.hidden = true; S.draft = null; S.files = []; S.snapshot = null;
    renderPins();
  }

  function showSnapshot() {
    if (!S.snapshot || !S.draft) return;
    if (el.snapImg.src.startsWith('blob:')) URL.revokeObjectURL(el.snapImg.src);
    el.snapImg.src = URL.createObjectURL(S.snapshot);
    el.snapOn.checked = true; el.snap.classList.remove('off'); el.snap.hidden = false;
  }
  el.snapOn.addEventListener('change', () => el.snap.classList.toggle('off', !el.snapOn.checked));

  function fillPartList() {
    const parts = [...new Set(S.all.filter(c => c.page === V.key && c.part).map(c => c.part))];
    el.partList.innerHTML = parts.map(p => '<option value="' + esc(p) + '">').join('');
  }

  async function addFiles(list) {
    const imgs = Array.from(list || []).filter(f => f && /^image\//.test(f.type));
    for (const f of imgs) {
      if (S.files.length >= MAX_FILES) { toast('แนบได้สูงสุด ' + MAX_FILES + ' รูป'); break; }
      S.files.push(await shrink(f));
    }
    renderThumbs();
  }
  function renderThumbs() {
    $$('img', el.thumbs).forEach(i => URL.revokeObjectURL(i.src));
    el.thumbs.innerHTML = '';
    S.files.forEach((f, i) => {
      const d = document.createElement('div'); d.className = 'th';
      const u = URL.createObjectURL(f);
      d.innerHTML = '<img alt=""><button type="button" title="เอาออก">✕</button>';
      d.querySelector('img').src = u;
      d.querySelector('img').onclick = () => lightbox(u);
      d.querySelector('button').onclick = () => { S.files.splice(i, 1); renderThumbs(); };
      el.thumbs.appendChild(d);
    });
  }

  el.fileBtn.addEventListener('click', () => el.file.click());
  el.file.addEventListener('change', () => { addFiles(el.file.files); el.file.value = ''; });
  ['dragenter', 'dragover'].forEach(t => el.form.addEventListener(t, e => { e.preventDefault(); el.drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => el.form.addEventListener(t, e => { e.preventDefault(); el.drop.classList.remove('over'); }));
  el.form.addEventListener('drop', e => addFiles(e.dataTransfer.files));
  el.form.addEventListener('paste', e => {
    const fs = Array.from(e.clipboardData.items || []).filter(i => i.kind === 'file').map(i => i.getAsFile());
    if (fs.length) { e.preventDefault(); addFiles(fs); }
  });
  el.cancel.addEventListener('click', closeForm);

  el.form.addEventListener('submit', async e => {
    e.preventDefault();
    if (S.busy || !S.draft) return;
    const f = el.form;
    const author = f.author.value.trim(), body = f.body.value.trim();
    if (!author || !body) return;
    try { localStorage.setItem(LS_AUTHOR, author); } catch (e2) { /* ignore */ }
    const files = (S.snapshot && el.snapOn.checked ? [S.snapshot] : []).concat(S.files);
    S.busy = true; el.submit.disabled = true; el.submit.textContent = 'กำลังส่ง…'; el.err.hidden = true;
    try {
      const c = await API.create({
        page: V.key, author, body, part: f.part.value.trim(), review_date: f.review_date.value,
        anchor: S.draft.anchor, view: S.draft.view,
      }, files);
      S.all.push(c);
      closeForm();
      S.activeId = c.id;
      if (S.status === 'done') setSeg('status', 'open');
      render();
      toast('ส่งคอมเมนต์แล้ว');
    } catch (err) {
      el.err.textContent = 'ส่งไม่สำเร็จ: ' + err.message; el.err.hidden = false;
    } finally {
      S.busy = false; el.submit.disabled = false; el.submit.textContent = 'ส่งคอมเมนต์';
    }
  });

  /* ════════ list ════════ */
  function setSeg(which, v) {
    S[which] = v;
    $$('#f-' + which + ' button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  }
  ['scope', 'status'].forEach(w => $$('#f-' + w + ' button').forEach(b => b.addEventListener('click', () => { setSeg(w, b.dataset.v); render(); })));

  function visibleList() {
    return topLevel()
      .filter(c => S.scope === 'all' || c.page === V.key)
      .filter(c => S.status === 'all' || (S.status === 'done' ? isDone(c) : !isDone(c)))
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }

  function imgsHTML(c) {
    return (c.images || []).length
      ? '<div class="cc-imgs">' + c.images.map(k => '<img loading="lazy" src="' + esc(API.img(k)) + '" data-full="' + esc(API.img(k)) + '" alt="">').join('') + '</div>'
      : '';
  }

  function cardHTML(c) {
    const reps = repliesOf(c.id);
    return '<article class="cc' + (isDone(c) ? ' done' : '') + (c.id === S.activeId ? ' active' : '') + '" data-id="' + esc(c.id) + '">' +
      '<div class="cc-top"><span class="no' + (c.anchor ? '' : ' gen') + '">' + (c.anchor ? esc(c.no || '•') : '≡') + '</span>' +
      '<b>' + esc(c.author) + '</b><time title="ส่งเมื่อ ' + esc(fmtStamp(c.created_at)) + '">' + esc(fmtDate(c.review_date || c.created_at)) + '</time></div>' +
      (S.scope === 'all' ? '<div class="cc-pg">' + esc(V.titles[c.page] || c.page) + '</div>' : '') +
      (c.part ? '<div class="cc-part">ส่วน: ' + esc(c.part) + '</div>' : '') +
      '<div class="cc-body">' + esc(c.body) + '</div>' + imgsHTML(c) +
      (reps.length ? '<div class="replies">' + reps.map(r =>
        '<div class="rp" data-id="' + esc(r.id) + '"><div class="rp-h"><b>' + esc(r.author) + '</b><span>' + esc(fmtDate(r.review_date || r.created_at)) + '</span>' +
        '<button class="lk del" data-act="del" data-id="' + esc(r.id) + '" title="ลบ">🗑</button></div>' +
        '<div class="cc-body">' + esc(r.body) + '</div>' + imgsHTML(r) + '</div>').join('') + '</div>' : '') +
      '<div class="cc-ft">' +
      (c.view ? '<button class="lk" data-act="view">🎯 ไปที่มุมมอง</button>' : '') +
      '<button class="lk" data-act="reply">↩ ตอบกลับ</button>' +
      '<button class="lk ok" data-act="status">' + (isDone(c) ? '↺ เปิดใหม่' : '✓ แก้แล้ว') + '</button>' +
      '<button class="lk" data-act="link" title="คัดลอกลิงก์">🔗</button>' +
      '<button class="lk del" data-act="del" data-id="' + esc(c.id) + '" title="ลบ">🗑</button>' +
      '</div></article>';
  }

  function render() {
    const items = visibleList();
    el.list.innerHTML = items.length ? items.map(cardHTML).join('')
      : '<div class="empty">' + (S.status === 'done' ? 'ยังไม่มีรายการที่แก้แล้ว' : 'ยังไม่มีคอมเมนต์ในหน้านี้<br>กด <b>📍 ปักหมุดคอมเมนต์</b> แล้วคลิกจุดบนโมเดลหรือเอกสาร') + '</div>';
    // open-count badges on the sidebar + floating button
    const open = topLevel().filter(c => !isDone(c));
    $$('.sb').forEach(b => { const n = open.filter(c => c.page === b.dataset.k).length; if (n) b.dataset.n = n; else delete b.dataset.n; });
    el.badge.textContent = open.filter(c => c.page === V.key).length;
    renderPins();
  }

  el.list.addEventListener('click', async e => {
    const img = e.target.closest('.cc-imgs img');
    if (img) { lightbox(img.dataset.full); return; }
    const card = e.target.closest('.cc'); if (!card) return;
    const c = S.all.find(x => x.id === card.dataset.id); if (!c) return;
    const act = e.target.closest('[data-act]');
    if (e.target.closest('.rp-form')) return;
    if (!act) { focusComment(c); return; }
    const a = act.dataset.act;
    if (a === 'view') focusComment(c);
    else if (a === 'reply') openReply(card, c);
    else if (a === 'link') {
      const url = location.href.split('#')[0] + '#' + c.page + '/c=' + c.id;
      try { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์แล้ว'); } catch (err) { prompt('คัดลอกลิงก์นี้', url); }
    } else if (a === 'status') {
      const status = isDone(c) ? 'open' : 'done';
      try { await API.update(c.id, { status }); c.status = status; render(); toast(status === 'done' ? 'ทำเครื่องหมายแก้แล้ว' : 'เปิดใหม่แล้ว'); }
      catch (err) { toast('ไม่สำเร็จ: ' + err.message); }
    } else if (a === 'del') {
      const id = act.dataset.id;
      if (!confirm('ลบคอมเมนต์นี้' + (id === c.id ? ' (รวมคำตอบกลับทั้งหมด)' : '') + '?')) return;
      try { await API.remove(id); S.all = S.all.filter(x => x.id !== id && x.parent_id !== id); render(); }
      catch (err) { toast('ลบไม่สำเร็จ: ' + err.message); }
    }
  });

  function openReply(card, c) {
    if ($('.rp-form', card)) { $('.rp-form textarea', card).focus(); return; }
    const f = document.createElement('form'); f.className = 'rp-form';
    let author = ''; try { author = localStorage.getItem(LS_AUTHOR) || ''; } catch (e) { /* ignore */ }
    f.innerHTML = '<input name="author" required maxlength="80" placeholder="ชื่อ" value="' + esc(author) + '">' +
      '<textarea name="body" rows="2" required maxlength="5000" placeholder="ตอบกลับ…"></textarea>' +
      '<input type="file" name="img" accept="image/*" multiple>' +
      '<div class="f-btns"><button type="button" class="btn sm">ยกเลิก</button><button class="btn pri sm">ส่ง</button></div>';
    card.appendChild(f);
    f.querySelector('button[type=button]').onclick = () => f.remove();
    f.onsubmit = async e => {
      e.preventDefault();
      const btn = f.querySelector('.pri'); btn.disabled = true;
      try {
        localStorage.setItem(LS_AUTHOR, f.author.value.trim());
        const files = []; for (const x of Array.from(f.img.files).slice(0, MAX_FILES)) files.push(await shrink(x));
        const r = await API.create({ page: c.page, parent_id: c.id, author: f.author.value.trim(), body: f.body.value.trim(), review_date: today() }, files);
        S.all.push(r); render();
      } catch (err) { toast('ส่งไม่สำเร็จ: ' + err.message); btn.disabled = false; }
    };
    f.body.focus();
  }

  async function focusComment(c) {
    S.activeId = c.id;
    if (c.page !== V.key) { await V.ready(c.page); }
    if (c.view && V.r3d) goToView(V.r3d, c.view);
    if (c.anchor && c.anchor.type === 'doc' && V.doc) {
      const se = V.doc.scrollingElement || V.doc.documentElement;
      se.scrollTo({ top: Math.max(0, c.anchor.y * se.scrollHeight - V.frame.clientHeight / 2), behavior: 'smooth' });
    }
    history.replaceState(null, '', '#' + c.page + '/c=' + c.id);
    render();
    const card = $('.cc[data-id="' + c.id + '"]', el.list);
    if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    setTimeout(() => { const p = $('.pin[data-id="' + c.id + '"]', el.pins); if (p) { p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash'); } }, 600);
  }

  /* ════════ pins overlay ════════ */
  let pinNodes = new Map();
  function renderPins() {
    const want = topLevel().filter(c => c.page === V.key && c.anchor && (S.status === 'all' || (S.status === 'done' ? isDone(c) : !isDone(c))));
    const keep = new Set();
    want.forEach(c => {
      keep.add(c.id);
      let n = pinNodes.get(c.id);
      if (!n) {
        n = document.createElement('button'); n.type = 'button'; n.className = 'pin'; n.dataset.id = c.id;
        n.innerHTML = '<span><b></b></span>';
        n.onclick = () => { el.body.classList.add('cm-open'); focusComment(c); };
        el.pins.appendChild(n); pinNodes.set(c.id, n);
      }
      n.querySelector('b').textContent = c.no || '•';
      n.title = c.author + ': ' + c.body.slice(0, 80);
      n.classList.toggle('done', isDone(c));
      n.classList.toggle('active', c.id === S.activeId);
      n._anchor = c.anchor;
    });
    if (S.draft && S.draft.anchor) {
      keep.add('__draft');
      let n = pinNodes.get('__draft');
      if (!n) { n = document.createElement('div'); n.className = 'pin draft'; n.innerHTML = '<span><b>＋</b></span>'; el.pins.appendChild(n); pinNodes.set('__draft', n); }
      n._anchor = S.draft.anchor;
    }
    pinNodes.forEach((n, id) => { if (!keep.has(id)) { n.remove(); pinNodes.delete(id); } });
  }

  let frameNo = 0;
  (function tick() {
    frameNo++;
    const R = V.r3d;
    pinNodes.forEach(n => {
      let pos = null;
      try { pos = project(n._anchor); } catch (e) { pos = null; }
      if (!pos) { n.style.display = 'none'; return; }
      n.style.display = '';
      n.style.transform = 'translate(' + pos.x.toFixed(1) + 'px,' + pos.y.toFixed(1) + 'px)';
      n.classList.toggle('loose', pos.loose);
      if (R && n._anchor.type === 'world' && frameNo % 12 === 0) {
        try { n.classList.toggle('hidden3d', occluded(R, n._anchor.p)); } catch (e) { /* ignore */ }
      }
    });
    requestAnimationFrame(tick);
  })();

  /* ════════ misc ════════ */
  function lightbox(src) { $('img', el.lb).src = src; el.lb.hidden = false; }
  el.lb.addEventListener('click', e => { if (e.target.tagName !== 'IMG') el.lb.hidden = true; });
  el.toggle.addEventListener('click', () => el.body.classList.toggle('cm-open'));
  const closeBtn = $('#cm-close'); if (closeBtn) closeBtn.addEventListener('click', () => el.body.classList.remove('cm-open'));

  document.addEventListener('viewer:change', () => { setPinning(false); closeForm(); S.activeId = null; render(); });
  document.addEventListener('viewer:load', () => {
    // Esc inside the iframe should also cancel pin mode
    try { V.win.addEventListener('keydown', e => { if (e.key === 'Escape') setPinning(false); }); } catch (e) { /* ignore */ }
    renderPins();
  });

  async function refresh() {
    try { S.all = await API.list(); render(); } catch (e) { el.list.innerHTML = '<div class="empty">โหลดคอมเมนต์ไม่สำเร็จ: ' + esc(e.message) + '</div>'; }
  }

  (async function init() {
    const mode = await API.init();
    el.mode.textContent = mode === 'remote' ? 'ออนไลน์' : 'โหมดทดลอง (เก็บในเครื่องนี้)';
    el.mode.className = 'mode ' + mode;
    el.mode.title = mode === 'remote' ? 'บันทึกใน Cloudflare D1 + R2 — ทุกคนเห็นเหมือนกัน' : 'ไม่พบ /api — คอมเมนต์เก็บใน browser นี้เท่านั้น';
    await refresh();
    const h = V.parseHash();
    if (h && h.comment) {
      const c = S.all.find(x => x.id === h.comment);
      if (c) { setSeg('status', 'all'); el.body.classList.add('cm-open'); focusComment(c); }
    }
    // keep everyone's view in sync
    if (mode === 'remote') setInterval(() => { if (!document.hidden && el.form.hidden && !$('.rp-form')) refresh(); }, 30000);
  })();
})();
