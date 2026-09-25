/* ───────── Viewer: loads each review page into the iframe ─────────
   Pages live in /pages/<key>/index.html (separate HTML / CSS / JS per page).
   URL hash:  #ct5-3d            → open that page
              #ct5-3d/c=<id>     → open that page and focus one comment        */
(function () {
  'use strict';
  const fr = document.getElementById('fr');
  const ld = document.getElementById('ld');
  const DEFAULT = 'ct5-sheet';
  const LS_KEY = 'bmsReview.k';

  // Page titles come straight from the sidebar markup, so adding a page = adding a button.
  const titles = {};
  document.querySelectorAll('#nav .grp').forEach(g => {
    const name = g.querySelector('.nb b')?.textContent.trim() || '';
    g.querySelectorAll('.sb').forEach(b => { titles[b.dataset.k] = name + ' · ' + b.textContent.trim(); });
  });

  let cur = null;
  let loaded = false;
  let waiters = [];

  function exists(k) { return !!document.querySelector('.sb[data-k="' + k + '"]'); }

  function open(k) {
    if (!exists(k)) k = DEFAULT;
    if (k === cur) return;
    cur = k; loaded = false;
    ld.style.display = 'flex';
    fr.src = 'pages/' + k + '/';
    document.querySelectorAll('.sb').forEach(b => b.classList.toggle('on', b.dataset.k === k));
    try { localStorage.setItem(LS_KEY, k); } catch (e) { /* private mode */ }
    if (!location.hash.startsWith('#' + k)) history.replaceState(null, '', '#' + k);
    document.dispatchEvent(new CustomEvent('viewer:change', { detail: { key: k } }));
  }

  fr.addEventListener('load', () => {
    if (!fr.src || fr.src === 'about:blank') return;
    ld.style.display = 'none';
    loaded = true;
    const w = waiters; waiters = [];
    w.forEach(fn => fn());
    document.dispatchEvent(new CustomEvent('viewer:load', { detail: { key: cur } }));
  });

  document.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => open(b.dataset.k)));

  function parseHash() {
    const m = /^#([\w-]+)(?:\/c=([\w-]+))?/.exec(location.hash || '');
    return m ? { key: m[1], comment: m[2] || null } : null;
  }

  window.Viewer = {
    open,
    titles,
    frame: fr,
    get key() { return cur; },
    get win() { try { return fr.contentWindow; } catch (e) { return null; } },
    get doc() { try { return fr.contentDocument; } catch (e) { return null; } },
    /** 3D pages expose { THREE, scene, camera, renderer, controls } via window.__review */
    get r3d() { try { return loaded ? fr.contentWindow.__review || null : null; } catch (e) { return null; } },
    /** resolves once page `k` is open and loaded */
    ready(k) {
      if (k && k !== cur) open(k);
      return new Promise(res => (loaded ? res() : waiters.push(res)));
    },
    parseHash,
  };

  const h = parseHash();
  let k0 = h && exists(h.key) ? h.key : null;
  if (!k0) { try { k0 = localStorage.getItem(LS_KEY); } catch (e) { /* ignore */ } }
  open(k0 && exists(k0) ? k0 : DEFAULT);
})();
