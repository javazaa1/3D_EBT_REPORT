/* ───────── Server calls ─────────
   remote : the Cloudflare Worker (/api/*  → D1 + R2)
   local  : fallback when /api is not reachable (plain static server / file://).
            Comments are kept in this browser only; pages come from p/manifest.json. */
(function () {
  'use strict';
  const LS = 'bmsReview.localComments';
  const KEYS = { review: 'bmsReview.reviewKey', upload: 'bmsReview.uploadKey' };
  let mode = null, initP = null;

  const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } };

  async function req(url, opts, retried) {
    opts = opts || {};
    const headers = Object.assign({}, opts.headers || {});
    if (lsGet(KEYS.review)) headers['x-review-key'] = lsGet(KEYS.review);
    if (lsGet(KEYS.upload)) headers['x-upload-key'] = lsGet(KEYS.upload);
    const res = await fetch(url, Object.assign({}, opts, { headers }));
    let data = null;
    try { data = await res.json(); } catch (e) { /* not JSON */ }
    if (res.status === 401 && !retried && data && (data.code === 'review_key' || data.code === 'upload_key')) {
      const isUp = data.code === 'upload_key';
      const v = prompt(isUp ? 'ใส่รหัสอัพโหลด (UPLOAD_KEY)' : 'ใส่รหัสสำหรับคอมเมนต์ (REVIEW_KEY)');
      if (v) { lsSet(isUp ? KEYS.upload : KEYS.review, v.trim()); return req(url, opts, true); }
    }
    if (!res.ok) { const e = new Error((data && data.error) || ('HTTP ' + res.status)); e.status = res.status; e.data = data; throw e; }
    return data;
  }

  function lsRead() { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) { return []; } }
  function lsWrite(a) { localStorage.setItem(LS, JSON.stringify(a)); }
  const toDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });

  const API = {
    get mode() { return mode; },

    init() {
      initP = initP || (async () => {
        try {
          const r = await fetch('/api/comments?page=__ping', { cache: 'no-store' });
          mode = r.ok && (r.headers.get('content-type') || '').includes('json') ? 'remote' : 'local';
        } catch (e) { mode = 'local'; }
        return mode;
      })();
      return initP;
    },

    /* ── pages & versions ── */
    async pages() {
      if (mode === 'remote') return req('/api/pages', { cache: 'no-store' });
      const r = await fetch('p/manifest.json', { cache: 'no-store' });
      const man = r.ok ? await r.json() : { pages: {}, versions: [] };
      const no = {};
      return {
        pages: Object.entries(man.pages).map(([key, p]) => Object.assign({ key }, p)).sort((a, b) => (a.sort || 0) - (b.sort || 0)),
        versions: man.versions.map(v => Object.assign({}, v, { no: (no[v.key] = (no[v.key] || 0) + 1), source: 'git' })),
        canUpload: false,
      };
    },
    putFile(path, bytes, type) {
      return req('/api/files/' + path, { method: 'PUT', headers: { 'content-type': type || 'application/octet-stream' }, body: bytes });
    },
    async exists(path) {
      try { return (await fetch('/' + path, { method: 'HEAD', cache: 'no-store' })).ok; } catch (e) { return false; }
    },
    checkUpload() { return req('/api/upload-auth', { cache: 'no-store' }); },
    addVersion(v) { return req('/api/versions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(v) }); },
    deleteVersion(key, vid) { return req('/api/versions/' + encodeURIComponent(key) + '/' + encodeURIComponent(vid), { method: 'DELETE' }); },

    /* ── comments ── */
    async list() {
      if (mode === 'remote') return (await req('/api/comments', { cache: 'no-store' })).comments || [];
      return lsRead();
    },

    /** fields: {page,vid,parent_id,author,part,body,review_date,anchor,view}  files: Blob[] */
    async create(fields, files) {
      if (mode === 'remote') {
        const fd = new FormData();
        Object.entries(fields).forEach(([k, v]) => {
          if (v == null || v === '') return;
          fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
        });
        (files || []).forEach((f, i) => fd.append('images', f, f.name || ('image-' + (i + 1) + '.jpg')));
        return req('/api/comments', { method: 'POST', body: fd });
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
        return req('/api/comments/' + encodeURIComponent(id), {
          method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch),
        });
      }
      const all = lsRead(); const c = all.find(x => x.id === id);
      if (c) Object.assign(c, patch, { updated_at: new Date().toISOString() });
      lsWrite(all); return c;
    },

    async remove(id) {
      if (mode === 'remote') return req('/api/comments/' + encodeURIComponent(id), { method: 'DELETE' });
      lsWrite(lsRead().filter(x => x.id !== id && x.parent_id !== id));
      return { ok: true };
    },

    img(k) { return /^data:/.test(k) ? k : '/api/img/' + k.split('/').map(encodeURIComponent).join('/'); },
  };

  window.CommentAPI = API;
})();
