/* ───────── Comment storage ─────────
   remote : Cloudflare Pages Functions  (/api/comments → D1, /api/img → R2)
   local  : fallback when /api is not reachable (opened from a plain static
            server or file://). Saved in this browser only — for trying the UI. */
(function () {
  'use strict';
  const LS = 'bmsReview.localComments';
  const KEY_LS = 'bmsReview.reviewKey';
  let mode = null;

  function reviewKey() { try { return localStorage.getItem(KEY_LS) || ''; } catch (e) { return ''; } }

  async function req(url, opts, retried) {
    opts = opts || {};
    const headers = Object.assign({}, opts.headers || {});
    const k = reviewKey(); if (k) headers['x-review-key'] = k;
    const res = await fetch(url, Object.assign({}, opts, { headers }));
    if (res.status === 401 && !retried) {
      // Optional shared key (REVIEW_KEY env var). Ask once, remember it.
      const v = prompt('ใส่รหัสสำหรับคอมเมนต์ (Review key)');
      if (v) { try { localStorage.setItem(KEY_LS, v.trim()); } catch (e) { /* ignore */ } return req(url, opts, true); }
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* not JSON */ }
    if (!res.ok) throw new Error((data && data.error) || ('HTTP ' + res.status));
    return data;
  }

  /* ── local fallback helpers ── */
  function lsRead() { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) { return []; } }
  function lsWrite(a) { localStorage.setItem(LS, JSON.stringify(a)); }
  const toDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });

  const API = {
    get mode() { return mode; },

    async init() {
      try {
        const r = await fetch('api/comments?page=__ping', { cache: 'no-store' });
        const ct = r.headers.get('content-type') || '';
        mode = r.ok && ct.includes('json') ? 'remote' : 'local';
      } catch (e) { mode = 'local'; }
      return mode;
    },

    async list() {
      if (mode === 'remote') return (await req('api/comments', { cache: 'no-store' })).comments || [];
      return lsRead();
    },

    /** fields: {page,parent_id,author,part,body,review_date,anchor,view}  files: Blob[] */
    async create(fields, files) {
      if (mode === 'remote') {
        const fd = new FormData();
        Object.entries(fields).forEach(([k, v]) => {
          if (v == null || v === '') return;
          fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
        });
        (files || []).forEach((f, i) => fd.append('images', f, f.name || ('image-' + (i + 1) + '.jpg')));
        return req('api/comments', { method: 'POST', body: fd });
      }
      const all = lsRead();
      const images = [];
      for (const f of files || []) images.push(await toDataURL(f));
      const top = all.filter(c => c.page === fields.page && !c.parent_id);
      const c = Object.assign({}, fields, {
        id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        no: fields.parent_id ? null : top.reduce((m, x) => Math.max(m, x.no || 0), 0) + 1,
        images, status: 'open', created_at: new Date().toISOString(),
      });
      all.push(c);
      try { lsWrite(all); } catch (e) { throw new Error('พื้นที่เก็บในเบราว์เซอร์เต็ม (โหมดทดลอง) — ลองใช้รูปให้น้อยลง'); }
      return c;
    },

    async update(id, patch) {
      if (mode === 'remote') {
        return req('api/comments/' + encodeURIComponent(id), {
          method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch),
        });
      }
      const all = lsRead(); const c = all.find(x => x.id === id);
      if (c) Object.assign(c, patch, { updated_at: new Date().toISOString() });
      lsWrite(all); return c;
    },

    async remove(id) {
      if (mode === 'remote') return req('api/comments/' + encodeURIComponent(id), { method: 'DELETE' });
      lsWrite(lsRead().filter(x => x.id !== id && x.parent_id !== id));
      return { ok: true };
    },

    /** image entry → URL (remote: R2 key, local: data URL) */
    img(k) { return /^data:/.test(k) ? k : 'api/img/' + k.split('/').map(encodeURIComponent).join('/'); },
  };

  window.CommentAPI = API;
})();
