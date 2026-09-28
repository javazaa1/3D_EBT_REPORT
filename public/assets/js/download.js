/* ───────── ⬇ Download: "HTML อ่านง่าย" ─────────
   Builds ONE self-contained, readable HTML from the split files the site serves at /p/<key>/<vid>/:
   <body> stays normal HTML, CSS goes into <style>, JS into <script>, images/fonts become data: URLs.
   (The other option, "ไฟล์ต้นฉบับ", is the exported bundle exactly as uploaded.) */
(function () {
  'use strict';
  const V = window.Viewer;
  const btn = document.getElementById('ver-dl'), menu = document.getElementById('dl-menu'), flatBtn = document.getElementById('dl-flat');

  btn.addEventListener('click', e => { e.stopPropagation(); menu.hidden = !menu.hidden; });
  document.addEventListener('click', e => { if (!menu.contains(e.target)) menu.hidden = true; });
  document.getElementById('ver-src').addEventListener('click', () => { menu.hidden = true; });

  const cache = new Map();
  async function dataURL(url) {
    if (cache.has(url)) return cache.get(url);
    const p = fetch(url).then(r => { if (!r.ok) throw new Error(r.status + ' ' + url); return r.blob(); })
      .then(b => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); }));
    cache.set(url, p);
    return p;
  }
  async function replaceAsync(str, re, fn) {
    const jobs = [];
    str.replace(re, (...m) => { jobs.push(fn(...m)); return m[0]; });
    const out = await Promise.all(jobs);
    let i = 0;
    return str.replace(re, () => out[i++]);
  }
  const same = u => new URL(u).origin === location.origin;
  const safeScript = code => code.replace(/<\/script/gi, '<\\/script');

  async function flatten(base) {
    const pageUrl = new URL(base, location.origin).href;
    const html = await (await fetch(pageUrl)).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const abs = u => new URL(u, pageUrl).href;

    // stylesheets → <style>; url(...) inside → data: URLs. Font files go to the END of <body>
    // so the top of the file stays readable.
    for (const l of [...doc.querySelectorAll('link[rel~="stylesheet"][href]')]) {
      const href = abs(l.getAttribute('href'));
      if (!same(href)) continue;
      let css = await (await fetch(href)).text();
      css = await replaceAsync(css, /url\((['"]?)([^'")]+)\1\)/g, async (m, q, u) =>
        /^(data:|#)/.test(u) ? m : 'url("' + await dataURL(new URL(u, href).href) + '")');
      const st = doc.createElement('style');
      if (/@font-face/.test(css) && !/[^\s]/.test(css.replace(/@font-face\s*\{[^}]*\}/g, '').replace(/\/\*[\s\S]*?\*\//g, ''))) {
        st.textContent = '\n' + css + '\n';
        doc.body.append(doc.createComment(' fonts (embedded) '), st);
        l.remove();
      } else {
        st.textContent = '\n' + css + '\n';
        l.replaceWith(st);
      }
    }
    // <script src> → inline
    for (const s of [...doc.querySelectorAll('script[src]')]) {
      const src = abs(s.getAttribute('src'));
      if (!same(src)) continue;
      const code = await (await fetch(src)).text();
      const n = doc.createElement('script');
      for (const a of s.attributes) if (a.name !== 'src') n.setAttribute(a.name, a.value);
      const name = src.split('/').pop();
      n.textContent = '\n/* ' + (src.includes('/lib/') ? 'library ' : '') + name + ' */\n' + safeScript(code) + '\n';
      s.replaceWith(n);
    }
    // images / media in the markup
    for (const el of [...doc.querySelectorAll('img[src], source[src], video[poster], image[href], use[href]')]) {
      for (const attr of ['src', 'poster', 'href']) {
        const v = el.getAttribute(attr);
        if (!v || /^(data:|#)/.test(v)) continue;
        const u = abs(v);
        if (same(u)) el.setAttribute(attr, await dataURL(u));
      }
    }
    // inline style="…url(…)…"
    for (const el of [...doc.querySelectorAll('[style*="url("]')]) {
      el.setAttribute('style', await replaceAsync(el.getAttribute('style'), /url\((['"]?)([^'")]+)\1\)/g, async (m, q, u) =>
        /^(data:|#)/.test(u) ? m : 'url("' + await dataURL(abs(u)) + '")'));
    }
    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML + '\n';
  }

  flatBtn.addEventListener('click', async () => {
    const key = V.key, vid = V.vid, no = V.versionNo(key, vid);
    const label = flatBtn.querySelector('b'), txt = label.textContent;
    flatBtn.disabled = true; label.textContent = 'กำลังรวมไฟล์…';
    try {
      const out = await flatten('/p/' + key + '/' + vid + '/');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([out], { type: 'text/html' }));
      a.download = key + '-v' + (no || '') + '.html';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      menu.hidden = true;
    } catch (e) {
      alert('สร้างไฟล์ไม่สำเร็จ: ' + e.message);
    } finally {
      flatBtn.disabled = false; label.textContent = txt;
    }
  });

  window.flattenPage = flatten;   // used by tests
})();
