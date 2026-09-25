/* Silom Complex — CT-5 cooling tower bank (3 cells) · 3D graphic
   Geometry read off the site graphic: induced-draft counterflow cells in a row,
   top fan stacks with guards, walkway rail round the fan deck, tan CDWR header
   across the top, yellow CDWS mains at basin level, louvered air inlets.
   Public API at the bottom takes live values from Niagara. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const host = $('stage');

  const C = {
    galv: 0xd3d6cd, galvLit: 0xe6e8df, galvDark: 0xaaaea6,
    panel: 0xe0ded1, panelLit: 0xefede1, panelDark: 0xc0bdb0,
    louvre: 0x9aa09a, grate: 0x9ca09a,
    deck: 0xdcdacd, rail: 0xc2c6be,
    stack: 0xe4e2d6, guard: 0xa6aaa2,
    blade: 0x8f948c, hub: 0x6b6f68,
    hot: 0xc98a52, hotDark: 0x9c6636,      // CDWR — hot water back from condensers
    cold: 0xd8c21a, coldDark: 0xa89610,    // CDWS — cold water out to pumps
    valve: 0x6d737a, actuator: 0x3f464d,
    concrete: 0x9a978e, slab: 0x8b8880,
    water: 0x3fa7c4, steel: 0x9aa1a6, white: 0xf2f2ec, gauge: 0xdedac2,
  };

  const CELLS = ['CT-5-01', 'CT-5-02', 'CT-5-03'];
  const CW = 2.6, CD = 3.0;                 // cell width / depth
  const Y_PLINTH = 0.35;
  const Y_BASIN0 = Y_PLINTH, Y_BASIN1 = 1.25;
  const Y_LOUV0 = Y_BASIN1, Y_LOUV1 = 2.90;
  const Y_CAS0 = Y_LOUV1, Y_CAS1 = 3.60;
  const Y_DECK = 3.72;
  const Y_STK0 = Y_DECK, Y_STK1 = 4.58;
  const STK_R = 0.92;
  const cellX = (i) => (i - 1) * CW;

  // ── scene ────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101820);
  scene.fog = new THREE.Fog(0x101820, 22, 46);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  /* review hook: lets the comment panel read the camera, pick 3D points and take snapshots */
  window.__review = { THREE: THREE, scene: scene, camera: camera, renderer: renderer, controls: controls };

  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 5;
  controls.maxDistance = 34;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.target.set(0, 2.1, 0);

  scene.add(new THREE.HemisphereLight(0xdfeaf2, 0x26303a, 0.55));
  const key = new THREE.DirectionalLight(0xfff3e0, 1.25);
  key.position.set(7, 11, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -12; key.shadow.camera.right = 12;
  key.shadow.camera.top = 12; key.shadow.camera.bottom = -12;
  key.shadow.camera.far = 40; key.shadow.bias = -0.0009;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbcd6ff, 0.45);
  fill.position.set(-8, 4, -5); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.35);
  rim.position.set(-3, 6, -9); scene.add(rim);

  const G = {};
  ['ground', 'frame', 'casing', 'fill', 'fans', 'pipes', 'valves', 'flow', 'basin'].forEach((k) => {
    G[k] = new THREE.Group(); G[k].name = k; scene.add(G[k]);
  });

  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt, rb, h, s) => new THREE.CylinderGeometry(rt, rb, h, s || 24);
  const mat = (c, m, r, x) => new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: m, roughness: r }, x || {}));
  function add(g, geo, m, x, y, z, rx, ry, rz) {
    const e = new THREE.Mesh(geo, m);
    e.position.set(x || 0, y || 0, z || 0);
    e.rotation.set(rx || 0, ry || 0, rz || 0);
    e.castShadow = true; e.receiveShadow = true; g.add(e);
    return e;
  }

  const mGalv = mat(C.galv, 0.55, 0.45), mGalvLit = mat(C.galvLit, 0.5, 0.4), mGalvDark = mat(C.galvDark, 0.6, 0.45);
  const mPanel = mat(C.panel, 0.2, 0.62), mPanelLit = mat(C.panelLit, 0.18, 0.58), mPanelDark = mat(C.panelDark, 0.25, 0.62);
  const mLouvre = mat(C.louvre, 0.3, 0.72), mDeck = mat(C.deck, 0.3, 0.6), mRail = mat(C.rail, 0.6, 0.4);
  const mStack = mat(C.stack, 0.25, 0.55), mGuard = mat(C.guard, 0.6, 0.4);
  const mHub = mat(C.hub, 0.55, 0.45);
  const mHot = mat(C.hot, 0.35, 0.5), mHotD = mat(C.hotDark, 0.4, 0.55);
  const mCold = mat(C.cold, 0.35, 0.48), mColdD = mat(C.coldDark, 0.4, 0.52);
  const mValve = mat(C.valve, 0.65, 0.4), mAct = mat(C.actuator, 0.4, 0.55);
  const mConc = mat(C.concrete, 0.0, 0.92);
  const mSkin = mat(0xcfd8d4, 0.1, 0.25, { transparent: true, opacity: 0.18, depthWrite: false });
  const mPanelSee = mat(C.panelLit, 0.18, 0.58, { transparent: true, opacity: 0.16, depthWrite: false });
  const nozzles = [];
  const mFill = (function () {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    const r = 16, w = Math.sqrt(3) * r;
    g.lineWidth = 5; g.strokeStyle = '#e4dcb8';
    for (let row = -1; row < 256 / (1.5 * r) + 1; row++) {
      for (let col = -1; col < 256 / w + 1; col++) {
        const cx = col * w + (row % 2 ? w / 2 : 0), cy = row * 1.5 * r;
        g.beginPath();
        for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
        g.closePath(); g.stroke();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.2, 1.3);
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return mat(0xffffff, 0.05, 0.85, { map: t, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  })();

  // ── ground + plinth ──────────────────────────────────────────────────
  (function ground() {
    const f = add(G.ground, box(26, 0.2, 20), mat(0x2a333b, 0.05, 0.95), 0, -0.1, 0);
    f.castShadow = false;
    const gm = new THREE.LineBasicMaterial({ color: 0x3f4a54, transparent: true, opacity: 0.5 });
    for (let i = -6; i <= 6; i++) {
      G.ground.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
        [new THREE.Vector3(i * 1.6, 0.002, -8), new THREE.Vector3(i * 1.6, 0.002, 8)]), gm));
      G.ground.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
        [new THREE.Vector3(-9.6, 0.002, i * 1.3), new THREE.Vector3(9.6, 0.002, i * 1.3)]), gm));
    }
    // concrete plinth under the whole bank
    add(G.ground, box(CW * 3 + 0.5, Y_PLINTH, CD + 0.5), mConc, 0, Y_PLINTH / 2, 0);
    add(G.ground, box(CW * 3 + 0.66, 0.07, CD + 0.66), mat(C.slab, 0.0, 0.94), 0, 0.035, 0);
  })();

  // ── cells: basin, louvers, casing, structural frame ──────────────────
  const runStripes = [];   // one scrolling sleeve per fan stack (off in this build)
  const bladeMats = [];    // per-cell fan blades — these are the run indicator
  const stackMats = [];    // open stack shells: green and clear while running
  const hubMats = [];      // hub + blade ribs follow the same run colour
  const fanHubs = [];
  const cellGlowMats = [];

  CELLS.forEach((tag, i) => {
    const x = cellX(i);

    // cold-water basin, slightly proud of the casing
    add(G.basin, box(CW - 0.04, Y_BASIN1 - Y_BASIN0, CD + 0.1), mPanelDark, x, (Y_BASIN0 + Y_BASIN1) / 2, 0);
    add(G.basin, box(CW - 0.02, 0.07, CD + 0.14), mGalvDark, x, Y_BASIN1 - 0.03, 0);
    add(G.basin, box(CW - 0.02, 0.07, CD + 0.14), mGalvDark, x, Y_BASIN0 + 0.03, 0);

    // air inlet louvres (lower band) + see-through skin over the fill zone
    const Y_AIR1 = Y_LOUV1, Y_FILL0 = Y_LOUV0 + 0.04, Y_FILL1 = 2.82;
    const nL = 15, lh = (Y_LOUV1 - Y_LOUV0 - 0.1) / nL;
    for (let k = 0; k < nL; k++) {
      const y = Y_LOUV0 + 0.05 + lh * (k + 0.5);
      [1, -1].forEach((s) => add(G.casing, box(CW - 0.12, lh * 0.62, 0.05), mLouvre,
        x, y, s * (CD / 2 - 0.04), -0.42 * s, 0, 0));
    }
    // fill media pack inside the cell, above the air inlet
    add(G.fill, box(CW - 0.22, Y_FILL1 - Y_FILL0, CD - 0.34), mFill, x, (Y_FILL0 + Y_FILL1) / 2, 0);
    [-1, 1].forEach((sz) => add(G.fill, box(CW - 0.2, 0.04, 0.05), mGalvDark, x, Y_FILL0 - 0.02, sz * (CD / 2 - 0.2)));
    // distribution header + spray nozzles above the fill
    const SPY = Y_CAS0 + 0.32;
    add(G.fill, cyl(0.06, 0.06, CW - 0.3, 14), mHot, x, SPY, 0, 0, 0, Math.PI / 2);
    for (let n = 0; n < 4; n++) {
      const nx = x - (CW - 0.6) / 2 + n * (CW - 0.6) / 3;
      add(G.fill, cyl(0.02, 0.02, 0.1, 8), mGalvDark, nx, SPY - 0.09, 0);
      add(G.fill, cyl(0.03, 0.07, 0.07, 12), mGalvLit, nx, SPY - 0.17, 0);
      nozzles.push({ i, x: nx, y: SPY - 0.2 });
    }
    // louvre end frames
    [1, -1].forEach((s) => add(G.casing, box(0.06, Y_AIR1 - Y_LOUV0, CD - 0.04), mPanel, x + s * (CW / 2 - 0.03), (Y_LOUV0 + Y_AIR1) / 2, 0));
    // side walls of the louvre band (only the outer two cells show one)
    if (i === 0 || i === 2) {
      const s = i === 0 ? -1 : 1;
      add(G.casing, box(0.05, Y_AIR1 - Y_LOUV0, CD - 0.05), mPanelLit, x + s * (CW / 2 - 0.02), (Y_LOUV0 + Y_AIR1) / 2, 0);
    }

    // upper casing — drift eliminator / plenum, pale sheet panels
    add(G.casing, box(CW - 0.04, Y_CAS1 - Y_CAS0, CD - 0.04), mPanelLit, x, (Y_CAS0 + Y_CAS1) / 2, 0);
    // panel seams
    [-0.62, 0, 0.62].forEach((dz) =>
      add(G.casing, box(CW - 0.02, Y_CAS1 - Y_CAS0 - 0.05, 0.02), mPanelDark, x, (Y_CAS0 + Y_CAS1) / 2, dz + CD / 2 - 0.02));
    add(G.casing, box(CW, 0.06, CD), mGalv, x, Y_CAS1 - 0.02, 0);

    // access door on the plenum face
    add(G.casing, box(0.62, 0.78, 0.03), mPanel, x - 0.4, Y_CAS0 + 0.4, CD / 2 + 0.005);
    add(G.casing, box(0.05, 0.12, 0.04), mGalvDark, x - 0.12, Y_CAS0 + 0.4, CD / 2 + 0.03);

    // corner posts + horizontal girts
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) =>
      add(G.frame, box(0.09, Y_CAS1 - Y_BASIN0, 0.09), mGalv, x + sx * (CW / 2 - 0.05), (Y_BASIN0 + Y_CAS1) / 2, sz * (CD / 2 - 0.05)));
    [Y_LOUV1, Y_CAS1].forEach((y) => [1, -1].forEach((sz) =>
      add(G.frame, box(CW - 0.08, 0.07, 0.07), mGalvLit, x, y, sz * (CD / 2 - 0.05))));
    // diagonal brace on the end cells
    if (i === 0 || i === 2) {
      const s = i === 0 ? -1 : 1;
      const h = Y_CAS1 - Y_BASIN0;
      const d = Math.hypot(h, CD - 0.1);
      add(G.frame, box(0.05, d, 0.05), mGalvDark, x + s * (CW / 2 - 0.02), (Y_BASIN0 + Y_CAS1) / 2, 0,
        Math.atan2(CD - 0.1, h), 0, 0);
    }

    // ── fan deck, stack, guard and blades ──
    add(G.fans, box(CW - 0.02, 0.09, CD - 0.02), mDeck, x, Y_DECK - 0.04, 0);
    // stack: flared velocity-recovery cylinder
    const stkMat = mat(0x8fd9ae, 0.15, 0.32, {
      transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false,
    });
    stackMats.push(stkMat);
    const stk = new THREE.Mesh(
      new THREE.CylinderGeometry(STK_R + 0.09, STK_R, Y_STK1 - Y_STK0, 40, 1, true), stkMat);
    stk.position.set(x, (Y_STK0 + Y_STK1) / 2, 0);
    stk.renderOrder = 2;
    G.fans.add(stk);
    add(G.fans, new THREE.TorusGeometry(STK_R + 0.1, 0.03, 8, 40), mGalv, x, Y_STK1 - 0.02, 0, Math.PI / 2, 0, 0);
    add(G.fans, new THREE.TorusGeometry(STK_R + 0.05, 0.026, 8, 40), mGalvDark, x, Y_STK0 + 0.03, 0, Math.PI / 2, 0, 0);

    // guard: a light cross brace only — the propeller has to stay readable
    add(G.fans, new THREE.TorusGeometry(STK_R + 0.05, 0.016, 8, 34), mGuard, x, Y_STK1 + 0.05, 0, Math.PI / 2, 0, 0);

    // fan: 9 tapered, twisted blades on a hub spider — mechanical-draft
    // propeller, seen through an open stack the way the reference shows it
    const hub = new THREE.Group();
    hub.position.set(x, Y_STK1 - 0.1, 0);
    G.fans.add(hub);
    fanHubs.push(hub);

    const bladeMat = mat(0x2fd46a, 0.32, 0.38, { emissive: 0x1d9b4c, emissiveIntensity: 0.5, roughness: 0.34, flatShading: false });
    bladeMats.push(bladeMat);
    const hubMat = mat(0x3f8f63, 0.45, 0.4, { emissive: 0x16733c, emissiveIntensity: 0.3 });
    hubMats.push(hubMat);
    const put = (parent, geo, m, px, py, pz, rx, ry, rz) => {
      const e = new THREE.Mesh(geo, m);
      e.position.set(px || 0, py || 0, pz || 0);
      e.rotation.set(rx || 0, ry || 0, rz || 0);
      e.castShadow = true; parent.add(e); return e;
    };

    // hub: boss, cap, and the clamp ring the blade roots bolt into
    put(hub, cyl(0.2, 0.235, 0.2, 22), hubMat, 0, 0, 0);
    put(hub, cyl(0.13, 0.19, 0.085, 22), hubMat, 0, 0.13, 0);
    put(hub, new THREE.TorusGeometry(0.235, 0.022, 8, 24), hubMat, 0, -0.06, 0, Math.PI / 2, 0, 0);

    const NB = 6, ROOT = 0.24, TIP = STK_R - 0.025;   // tips run close to the shroud
    const SPAN = 14, NC = 9;               // spanwise / chordwise stations
    function bladeGeometry() {
      const pos = [], nrm = [], idx = [];
      const ring = [];
      for (let i = 0; i <= SPAN; i++) {
        const t = i / SPAN;
        const r = ROOT + (TIP - ROOT) * t;
        // chord: narrow at the root, widest around mid-span, tapering to the tip
        // neck at the root, broad paddle from mid-span out, rounded at the tip
        const flare = Math.pow(Math.min(1, t / 0.42), 1.5);
        const tipRound = t > 0.86 ? Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.86) / 0.14, 2))) : 1;
        const chord = (0.13 + 0.62 * flare) * tipRound;
        const twist = 0.94 * (1 - 0.46 * t);            // steep at the root, washing out
        const camber = 0.075 * (1 - 0.3 * t);
        const row = [];
        for (let j = 0; j < NC; j++) {
          const u = j / (NC - 1);                        // 0 = leading edge
          const cx = (u - 0.42) * chord;
          // airfoil: thick at the leading edge, feathered at the trailing edge
          const thick = 0.030 * (1 - 0.55 * t) * Math.sin(Math.PI * Math.pow(u, 0.55)) * (1 - u * 0.72);
          const arc = camber * Math.sin(Math.PI * u);
          row.push({ r, cx, arc, thick, twist });
        }
        ring.push(row);
      }
      const push = (st, sign) => {
        const y = st.arc + sign * st.thick;
        const c = Math.cos(st.twist), sn = Math.sin(st.twist);
        pos.push(st.r, y * c - st.cx * sn, st.cx * c + y * sn);
      };
      // upper then lower surface, sharing the spanwise grid
      [1, -1].forEach((sign) => ring.forEach((row) => row.forEach((st) => push(st, sign))));
      const N = (SPAN + 1) * NC;
      const quad = (a, b, c, d) => idx.push(a, b, c, a, c, d);
      for (let side = 0; side < 2; side++) {
        const o = side * N;
        for (let i = 0; i < SPAN; i++) for (let j = 0; j < NC - 1; j++) {
          const a = o + i * NC + j, b = a + 1, c = a + NC + 1, d = a + NC;
          if (side === 0) quad(a, b, c, d); else quad(a, d, c, b);
        }
      }
      // close the tip and the leading edge so the blade is a solid casting
      for (let j = 0; j < NC - 1; j++) {
        const a = SPAN * NC + j, b = a + 1;
        quad(a, b, N + b, N + a);
      }
      for (let i = 0; i < SPAN; i++) {
        const a = i * NC, b = a + NC;
        quad(a, N + a, N + b, b);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    }
    const bladeGeo = bladeGeometry();

    for (let b = 0; b < NB; b++) {
      const wing = new THREE.Group();
      wing.rotation.y = -(b / NB) * Math.PI * 2;
      hub.add(wing);
      // blade-root clamp: split collar plus its bolt pair
      put(wing, cyl(0.062, 0.062, 0.15, 16), hubMat, ROOT - 0.02, 0, 0, 0, 0, Math.PI / 2);
      put(wing, cyl(0.072, 0.072, 0.03, 16), mGuard, ROOT + 0.03, 0, 0, 0, 0, Math.PI / 2);
      put(wing, cyl(0.072, 0.072, 0.03, 16), mGuard, ROOT - 0.07, 0, 0, 0, 0, Math.PI / 2);
      [-1, 1].forEach((sg) => put(wing, cyl(0.013, 0.013, 0.14, 8), mGuard, ROOT - 0.02, sg * 0.055, 0, 0, 0, Math.PI / 2));
      const bl = new THREE.Mesh(bladeGeo, bladeMat);
      bl.castShadow = true; wing.add(bl);
    }

    // gearbox / driveshaft below the fan
    add(G.fans, cyl(0.16, 0.16, 0.34, 18), mGalvDark, x, Y_STK0 - 0.1, 0);
    add(G.fans, box(0.42, 0.3, 0.42), mat(0x5d6a55, 0.45, 0.5), x, Y_CAS1 - 0.22, -CD * 0.28);
    add(G.fans, cyl(0.05, 0.05, CD * 0.24, 12), mat(C.steel, 0.7, 0.3), x, Y_CAS1 - 0.22, -CD * 0.14, Math.PI / 2, 0, 0);

    // run stripes round the fan stack — the state cue, same language as the pumps
    (function stripes() {
      const W = 512, H = 8;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const cx = cv.getContext('2d');
      const BARS = 18, duty = 0.4;
      for (let k = 0; k < BARS; k++) {
        const x0 = (k / BARS) * W, bw = (W / BARS) * duty;
        const g = cx.createLinearGradient(x0, 0, x0 + bw, 0);
        g.addColorStop(0, 'rgba(20,150,72,0)');
        g.addColorStop(0.35, 'rgba(34,196,96,1)');
        g.addColorStop(0.65, 'rgba(34,196,96,1)');
        g.addColorStop(1, 'rgba(20,150,72,0)');
        cx.fillStyle = g; cx.fillRect(x0, 0, bw, H);
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
      const m = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0,
        depthWrite: false, side: THREE.DoubleSide,
      });
      const sleeve = new THREE.Mesh(cyl(STK_R + 0.11, STK_R + 0.02, Y_STK1 - Y_STK0 - 0.12, 48, 1), m);
      sleeve.geometry = new THREE.CylinderGeometry(STK_R + 0.11, STK_R + 0.02, Y_STK1 - Y_STK0 - 0.12, 48, 1, true);
      sleeve.position.set(x, (Y_STK0 + Y_STK1) / 2, 0);
      sleeve.renderOrder = 3;
      sleeve.visible = false;   // retired: the fan wheel carries run state
    })();

    // status band round the basin rim, per cell
    cellGlowMats.push(null);
  });

  // ── walkway: deck plate, kick plate and handrail round the fan deck ──
  (function walkway() {
    const W = CW * 3, D = CD;
    add(G.frame, box(W + 0.7, 0.05, 0.55), mat(C.grate, 0.5, 0.6), 0, Y_DECK + 0.02, D / 2 + 0.3);
    add(G.frame, box(0.55, 0.05, D + 0.6), mat(C.grate, 0.5, 0.6), -W / 2 - 0.3, Y_DECK + 0.02, 0);
    // rail posts + two rails
    const posts = [];
    for (let k = 0; k <= 8; k++) posts.push([-W / 2 - 0.3 + (k / 8) * (W + 0.6), D / 2 + 0.52]);
    for (let k = 1; k <= 4; k++) posts.push([-W / 2 - 0.52, D / 2 + 0.52 - (k / 4) * (D + 0.6)]);
    posts.forEach(([px, pz]) => add(G.frame, cyl(0.022, 0.022, 1.02, 10), mRail, px, Y_DECK + 0.53, pz));
    [0.52, 1.0].forEach((dy) => {
      add(G.frame, box(W + 0.62, 0.035, 0.035), mRail, 0, Y_DECK + dy, D / 2 + 0.52);
      add(G.frame, box(0.035, 0.035, D + 0.62), mRail, -W / 2 - 0.52, Y_DECK + dy, 0);
    });
    add(G.frame, box(W + 0.62, 0.11, 0.02), mGalvDark, 0, Y_DECK + 0.09, D / 2 + 0.55);
    // access ladder on the near right corner
    const LX = CW * 1.5 + 0.18;
    [-0.16, 0.16].forEach((dz) => add(G.frame, cyl(0.026, 0.026, Y_DECK + 0.5, 10), mRail, LX, (Y_DECK + 0.5) / 2, D / 2 + 0.34 + dz));
    for (let k = 0; k < 11; k++) add(G.frame, cyl(0.016, 0.016, 0.34, 8), mRail, LX, 0.28 + k * 0.32, D / 2 + 0.34, 0, 0, Math.PI / 2);
  })();

  // ── piping: tan CDWR header on top, yellow CDWS mains at the basin ──
  function pipeRun(g, a, b, r, m, seg) {
    const va = new THREE.Vector3().fromArray(a), vb = new THREE.Vector3().fromArray(b);
    const len = va.distanceTo(vb);
    const p = new THREE.Mesh(cyl(r, r, len, seg || 20), m);
    p.position.copy(va).add(vb).multiplyScalar(0.5);
    p.lookAt(vb); p.rotateX(Math.PI / 2);
    p.castShadow = true; p.receiveShadow = true; g.add(p);
    return p;
  }
  function flangePair(g, a, b, r, m, axis, axisB) {
    [[a, axis], [b, axisB === undefined ? axis : axisB]].forEach(([p, ax]) => {
      const f = new THREE.Mesh(cyl(r * 1.4, r * 1.4, 0.05, 20), m);
      if (ax === 'x') f.rotation.z = Math.PI / 2;
      else if (ax === 'z') f.rotation.x = Math.PI / 2;
      f.position.fromArray(p); f.castShadow = true; g.add(f);
    });
  }

  // quarter-bend at a real corner: 'a' and 'b' are unit directions the two legs
  // leave the corner along, so the torus always lands ON the corner point
  function elbow(g, at, a, b, r, bend, m) {
    const va = new THREE.Vector3().fromArray(a).normalize();
    const vb = new THREE.Vector3().fromArray(b).normalize();
    const e = new THREE.Mesh(new THREE.TorusGeometry(bend, r, 12, 24, Math.PI / 2), m);
    const nz = new THREE.Vector3().crossVectors(vb, va).normalize();
    e.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(vb.clone().negate(), va.clone().negate(), nz));
    e.position.set(at[0], at[1], at[2])
      .add(va.clone().multiplyScalar(bend))
      .add(vb.clone().multiplyScalar(bend));
    e.castShadow = true; g.add(e);
    return e;
  }
  function tee(g, at, axis, r, m) {
    const t = new THREE.Mesh(cyl(r * 1.35, r * 1.35, r * 2.1, 18), m);
    if (axis === 'x') t.rotation.z = Math.PI / 2;
    else if (axis === 'z') t.rotation.x = Math.PI / 2;
    t.position.set(at[0], at[1], at[2]);
    t.castShadow = true; g.add(t);
    return t;
  }
  function blindFlange(g, at, axis, r, m) {
    const f = new THREE.Mesh(cyl(r * 1.5, r * 1.5, 0.06, 20), m);
    if (axis === 'x') f.rotation.z = Math.PI / 2;
    else if (axis === 'z') f.rotation.x = Math.PI / 2;
    f.position.set(at[0], at[1], at[2]);
    f.castShadow = true; g.add(f);
    return f;
  }

  const HDR_Y = Y_CAS1 + 0.28, HDR_R = 0.19;
  const RISER_X = CW * 1.5 + 0.62;
  const HZ = -CD * 0.22;                 // header centreline, back of the cells
  const RZ = CD / 2 + 0.16;              // riser centreline, front of the bank
  const HDR_X0 = -CW * 1.5 - 0.3;        // far (left) end of the top header
  const HOT_LOW_Y = Y_BASIN0 + 0.94;     // CDWR arrives at plant level, clear of CDWS
  const LOW_Y = 2.35;                     // low tan cross-over on the front face
  const CY = Y_BASIN0 + 0.42;            // CDWS main centreline
  const CZ = CD / 2 + 0.62;
  const CX0 = -CW * 1.5 - 0.55;          // left end of the CDWS main
  const AWAY_Z = -CD / 2 - 1.3;          // both mains leave the bank this way
  const BH = HDR_R * 1.5, BL = 0.13 * 1.5, BC = 0.22 * 1.5;   // bend radii

  (function piping() {
    // ── CDWR: hot water arrives at plant level, rises on the right, runs the
    //    top header, and drops into each cell. Every corner gets a real bend.
    pipeRun(G.pipes, [RISER_X, HOT_LOW_Y, AWAY_Z], [RISER_X, HOT_LOW_Y, RZ - BH], HDR_R, mHot, 26);
    elbow(G.pipes, [RISER_X, HOT_LOW_Y, RZ], [0, 0, -1], [0, 1, 0], HDR_R, BH, mHot);
    pipeRun(G.pipes, [RISER_X, HOT_LOW_Y + BH, RZ], [RISER_X, HDR_Y - BH, RZ], HDR_R, mHot, 22);
    elbow(G.pipes, [RISER_X, HDR_Y, RZ], [0, -1, 0], [0, 0, -1], HDR_R, BH, mHot);
    pipeRun(G.pipes, [RISER_X, HDR_Y, RZ - BH], [RISER_X, HDR_Y, HZ + BH], HDR_R, mHot, 22);
    elbow(G.pipes, [RISER_X, HDR_Y, HZ], [0, 0, 1], [-1, 0, 0], HDR_R, BH, mHot);
    pipeRun(G.pipes, [RISER_X - BH, HDR_Y, HZ], [HDR_X0, HDR_Y, HZ], HDR_R, mHot, 26);
    blindFlange(G.pipes, [HDR_X0, HDR_Y, HZ], 'x', HDR_R, mHotD);

    // branch straight down into each cell's distribution box — no bend needed,
    // but the header does need a tee where each branch takes off
    CELLS.forEach((t, i) => {
      add(G.pipes, box(0.14, 0.3, 0.14), mGalvDark, cellX(i), HDR_Y - 0.32, HZ);
      tee(G.pipes, [cellX(i), HDR_Y, HZ], 'x', HDR_R, mHotD);
      pipeRun(G.pipes, [cellX(i), HDR_Y, HZ], [cellX(i), Y_CAS1 - 0.1, HZ], 0.115, mHot, 18);
      flangePair(G.pipes, [cellX(i), HDR_Y - 0.06, HZ], [cellX(i), Y_CAS1 + 0.02, HZ], 0.115, mHotD);
    });

    // low tan cross-over on the front: tees off the riser, runs left, turns up
    // into cell 1 as the secondary CDWR feed
    tee(G.pipes, [RISER_X, LOW_Y, RZ], 'y', HDR_R, mHotD);
    pipeRun(G.pipes, [RISER_X, LOW_Y, RZ], [cellX(0) + BL, LOW_Y, RZ], 0.13, mHot, 22);
    elbow(G.pipes, [cellX(0), LOW_Y, RZ], [1, 0, 0], [0, 1, 0], 0.13, BL, mHot);
    pipeRun(G.pipes, [cellX(0), LOW_Y + BL, RZ], [cellX(0), Y_CAS0 + 0.1, RZ], 0.13, mHot, 18);
    flangePair(G.pipes, [cellX(0), Y_LOUV1 - 0.04, RZ], [cellX(0), Y_CAS0 + 0.06, RZ], 0.13, mHotD);
    [cellX(1), cellX(2)].forEach((px) => {
      add(G.pipes, box(0.1, 0.08, RZ - CD / 2 + 0.05), mGalvDark, px, LOW_Y - 0.17, (CD / 2 + RZ + 0.05) / 2);
      add(G.pipes, box(0.14, 0.2, 0.03), mGalvDark, px, LOW_Y - 0.12, CD / 2 + 0.015);
    });

    // ── CDWS: out of each basin into a common main, then away to the pumps
    pipeRun(G.pipes, [CX0 + BC, CY, CZ], [RISER_X + 0.5, CY, CZ], 0.22, mCold, 26);
    blindFlange(G.pipes, [RISER_X + 0.5, CY, CZ], 'x', 0.22, mColdD);
    elbow(G.pipes, [CX0, CY, CZ], [1, 0, 0], [0, 0, -1], 0.22, BC, mCold);
    pipeRun(G.pipes, [CX0, CY, CZ - BC], [CX0, CY, AWAY_Z], 0.22, mCold, 26);
    CELLS.forEach((t, i) => {
      tee(G.pipes, [cellX(i), CY, CZ], 'x', 0.22, mColdD);
      pipeRun(G.pipes, [cellX(i), CY, CD / 2 + 0.06], [cellX(i), CY, CZ], 0.13, mCold, 18);
      flangePair(G.pipes, [cellX(i), CY, CD / 2 + 0.2], [cellX(i), CY, CZ - 0.1], 0.13, mColdD, 'z');
    });

    // pipe supports on the slab
    [CX0, 0, RISER_X + 0.3].forEach((px) =>
      add(G.pipes, box(0.14, CY - 0.07, 0.14), mConc, px, (CY - 0.07) / 2 + 0.07, CZ));
    [AWAY_Z + 0.5, -0.4].forEach((pz) =>
      add(G.pipes, box(0.14, HOT_LOW_Y - 0.07, 0.14), mConc, RISER_X, (HOT_LOW_Y - 0.07) / 2 + 0.07, pz));
  })();

  // ── ancillary basin lines: makeup, overflow, drain, blowdown ──────────
  const mMake = mat(0x4f9ec7, 0.3, 0.45), mMakeD = mat(0x37728f, 0.35, 0.5);
  const mDrain = mat(0x8b9197, 0.4, 0.6), mDrainD = mat(0x6b7177, 0.45, 0.6);
  (function ancillary() {
    const MU_R = 0.055, OF_R = 0.075, DR_R = 0.065, BD_R = 0.05;
    const MU_Y = Y_BASIN1 + 0.2;          // makeup runs above the basin rim
    const MU_Z = CD / 2 + 0.24;
    const BMU = MU_R * 2.4, BOF = OF_R * 2.2, BDR = DR_R * 2.2;

    // MAKEUP: city water up the left end, along the front, ball float into cell 2
    pipeRun(G.pipes, [CX0 - 0.3, 0.12, MU_Z], [CX0 - 0.3, MU_Y - BMU, MU_Z], MU_R, mMake, 14);
    elbow(G.pipes, [CX0 - 0.3, MU_Y, MU_Z], [0, -1, 0], [1, 0, 0], MU_R, BMU, mMake);
    pipeRun(G.pipes, [CX0 - 0.3 + BMU, MU_Y, MU_Z], [cellX(1) - BMU, MU_Y, MU_Z], MU_R, mMake, 20);
    add(G.pipes, box(0.1, 0.19, 0.1), mMakeD, CX0 + 0.5, MU_Y, MU_Z);            // strainer
    add(G.pipes, box(0.11, 0.14, 0.11), mat(0x2f3338, 0.4, 0.55), cellX(0) + 0.5, MU_Y + 0.11, MU_Z);
    add(G.pipes, cyl(MU_R * 1.5, MU_R * 1.5, 0.1, 14), mMakeD, cellX(0) + 0.5, MU_Y, MU_Z); // solenoid
    // drop through the basin rim + ball float arm
    elbow(G.pipes, [cellX(1), MU_Y, MU_Z], [-1, 0, 0], [0, -1, 0], MU_R, BMU, mMake);
    pipeRun(G.pipes, [cellX(1), MU_Y - BMU, MU_Z], [cellX(1), Y_BASIN1 - 0.06, MU_Z], MU_R, mMake, 12);
    add(G.pipes, cyl(0.02, 0.02, 0.34, 10), mDrain, cellX(1) + 0.17, Y_BASIN1 - 0.1, MU_Z, 0, 0, Math.PI / 2);
    add(G.pipes, new THREE.SphereGeometry(0.085, 14, 12), mat(0xd8d2b3, 0.15, 0.55), cellX(1) + 0.34, Y_BASIN1 - 0.1, MU_Z);
    blindFlange(G.pipes, [CX0 - 0.3, 0.12, MU_Z], 'y', MU_R, mMakeD);

    // OVERFLOW: standpipe out of the left basin, down the end wall to the trench
    const OFZ = CD / 2 + BOF + 0.16, OFX = cellX(0) - 0.85, OFY = Y_BASIN1 - 0.14;
    pipeRun(G.pipes, [OFX, OFY, CD / 2 - 0.02], [OFX, OFY, OFZ - BOF], OF_R, mDrain, 14);
    elbow(G.pipes, [OFX, OFY, OFZ], [0, 0, -1], [0, -1, 0], OF_R, BOF, mDrain);
    pipeRun(G.pipes, [OFX, OFY - BOF, OFZ], [OFX, 0.1, OFZ], OF_R, mDrain, 14);
    flangePair(G.pipes, [OFX, OFY, CD / 2 + 0.04], [OFX, 0.24, OFZ], OF_R, mDrainD, 'z', 'y');

    // BASIN DRAIN: bottom tapping under cell 1 with a gate valve
    const DRZ = CD / 2 + BDR + 0.16, DRX = cellX(0) + 0.85, DRY = Y_BASIN0 + 0.06;
    pipeRun(G.pipes, [DRX, DRY, CD / 2 - 0.02], [DRX, DRY, DRZ - BDR], DR_R, mDrain, 14);
    elbow(G.pipes, [DRX, DRY, DRZ], [0, 0, -1], [0, -1, 0], DR_R, BDR, mDrain);
    pipeRun(G.pipes, [DRX, DRY - BDR, DRZ], [DRX, 0.08, DRZ], DR_R, mDrain, 14);
    flangePair(G.pipes, [DRX, DRY, CD / 2 + 0.04], [DRX, 0.2, DRZ], DR_R, mDrainD, 'z', 'y');
    add(G.pipes, cyl(DR_R * 1.7, DR_R * 1.7, 0.11, 16), mDrainD, DRX, 0.36, DRZ);
    add(G.pipes, cyl(0.026, 0.026, 0.15, 10), mat(C.steel, 0.7, 0.3), DRX, 0.36, DRZ + 0.13, Math.PI / 2, 0, 0);
    add(G.pipes, cyl(0.075, 0.075, 0.022, 16), mat(0xb03a2c, 0.3, 0.5), DRX, 0.36, DRZ + 0.21, Math.PI / 2, 0, 0);

    // BLOWDOWN / BLEED: tees off the CDWS main, motorised valve, to the trench
    const BX = cellX(2) + 1.3;
    tee(G.pipes, [BX, CY, CZ], 'x', 0.22, mColdD);
    pipeRun(G.pipes, [BX, CY - 0.12, CZ], [BX, 0.1, CZ], BD_R, mDrain, 12);
    add(G.pipes, cyl(BD_R * 1.8, BD_R * 1.8, 0.1, 16), mDrainD, BX, CY - 0.34, CZ);
    add(G.pipes, box(0.11, 0.13, 0.1), mat(0x2f3338, 0.4, 0.55), BX + 0.1, CY - 0.34, CZ);
    blindFlange(G.pipes, [BX, 0.1, CZ], 'y', BD_R, mDrainD);
  })();

  // ── valves: CDR (return, on the riser) and CDS (supply, on the mains) ──
  const VALVES = [];
  (function valves() {
    function butterfly(id, pos, axis, r, m) {
      const g = new THREE.Group(); g.position.set(pos[0], pos[1], pos[2]); G.valves.add(g);
      const body = new THREE.Mesh(cyl(r * 1.55, r * 1.55, 0.17, 22), mValve);
      if (axis === 'y') { /* upright pipe */ } else if (axis === 'z') body.rotation.x = Math.PI / 2;
      else body.rotation.z = Math.PI / 2;
      body.castShadow = true; g.add(body);
      // bolt ring
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const b = new THREE.Mesh(cyl(0.018, 0.018, 0.2, 8), mat(C.steel, 0.7, 0.35));
        if (axis === 'y') b.position.set(Math.cos(a) * r * 1.35, 0, Math.sin(a) * r * 1.35);
        else if (axis === 'z') { b.rotation.x = Math.PI / 2; b.position.set(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35, 0); }
        else { b.rotation.z = Math.PI / 2; b.position.set(0, Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35); }
        g.add(b);
      }
      // stem + actuator, offset clear of the pipe
      const stem = new THREE.Mesh(cyl(0.035, 0.035, 0.26, 12), mat(C.steel, 0.7, 0.3));
      const head = new THREE.Mesh(box(0.2, 0.17, 0.15), mAct);
      const ind = new THREE.Mesh(box(0.12, 0.03, 0.03), mat(0xd8d2b3, 0.2, 0.5));
      if (axis === 'y') {
        stem.rotation.z = Math.PI / 2; stem.position.set(r * 1.5 + 0.13, 0, 0);
        head.position.set(r * 1.5 + 0.35, 0, 0); ind.position.set(r * 1.5 + 0.35, 0.11, 0);
      } else {
        stem.position.set(0, r * 1.5 + 0.13, 0);
        head.position.set(0, r * 1.5 + 0.34, 0); ind.position.set(0, r * 1.5 + 0.46, 0);
      }
      [stem, head, ind].forEach((e) => { e.castShadow = true; g.add(e); });
      VALVES.push({ id, g, ind, head, open: false, manual: null });
      return g;
    }
    // return-side isolation on the riser (vertical pipe → 'y' axis body)
    butterfly('CDR-1', [RISER_X, HDR_Y - 0.75, RZ], 'y', HDR_R);
    butterfly('CDR-3', [RISER_X, HOT_LOW_Y + 0.62, RZ], 'y', HDR_R);
    // supply-side isolation on each basin outlet (pipe runs in z → 'z' axis)
    butterfly('CDS-1', [cellX(0), Y_BASIN0 + 0.42, CZ - 0.24], 'z', 0.13);
    butterfly('CDS-2', [cellX(1), Y_BASIN0 + 0.42, CZ - 0.24], 'z', 0.13);
    butterfly('CDS-3', [cellX(2), Y_BASIN0 + 0.42, CZ - 0.24], 'z', 0.13);
  })();

  // ── basin water surface + level switches ─────────────────────────────
  let waterMesh = null;
  const levelLamps = { HL: [], LL: [] };
  (function water() {
    const m = new THREE.MeshStandardMaterial({
      color: C.water, metalness: 0.25, roughness: 0.18,
      transparent: true, opacity: 0.66,
    });
    waterMesh = new THREE.Mesh(box(CW * 3 - 0.14, 0.03, CD - 0.1), m);
    waterMesh.position.set(0, Y_BASIN0 + 0.62, 0);
    waterMesh.receiveShadow = true;
    G.basin.add(waterMesh);

    // HL / LL float switches on the front face of cells 1 and 3
    [0, 2].forEach((i) => {
      const x = cellX(i) - 0.55;
      [['HL', Y_BASIN0 + 0.78], ['LL', Y_BASIN0 + 0.34]].forEach(([k, y]) => {
        add(G.basin, box(0.15, 0.13, 0.05), mat(0x3d444a, 0.4, 0.55), x, y, CD / 2 + 0.08);
        const lm = new THREE.MeshBasicMaterial({ color: k === 'HL' ? 0xd64536 : 0x2fd46a, transparent: true, opacity: 0.35 });
        const lamp = new THREE.Mesh(box(0.1, 0.05, 0.02), lm);
        lamp.position.set(x, y, CD / 2 + 0.115); G.basin.add(lamp);
        levelLamps[k].push(lm);
        // float rod down into the water
        add(G.basin, cyl(0.012, 0.012, 0.3, 8), mat(C.steel, 0.7, 0.3), x + 0.1, y - 0.1, CD / 2 + 0.02);
      });
    });
  })();

  // ── flow: falling water inside the cells + pipe tracers ──────────────
  const fallDrops = [];
  const faceDrops = [];
  const tracers = [];
  (function flow() {
    // fill water: thin vertical streaks in each cell, only visible in cutaway
    const dm = new THREE.MeshBasicMaterial({ color: 0x8fdcf0, transparent: true, opacity: 0.5 });
    CELLS.forEach((t, i) => {
      for (let k = 0; k < 16; k++) {
        const s = new THREE.Mesh(box(0.014, 0.34, 0.014), dm);
        s.position.set(cellX(i) + (Math.random() - 0.5) * (CW - 0.5),
          Y_LOUV0 + Math.random() * (Y_CAS1 - Y_LOUV0),
          (Math.random() - 0.5) * (CD - 0.6));
        s.visible = false;
        G.flow.add(s);
        fallDrops.push({ m: s, x0: s.position.x, z0: s.position.z, t: Math.random() });
      }
    });
    // internal water: spray from nozzles onto the fill, rain from fill into basin
    const fm = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 1, depthWrite: false });
    nozzles.forEach((nz) => {
      for (let k = 0; k < 8; k++) {
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), fm);
        d.scale.set(1, 2, 1); G.flow.add(d);
        faceDrops.push({ m: d, t: Math.random(), i: nz.i, x0: nz.x, z0: 0, sx: (Math.random() - 0.5) * 0.55, sz: (Math.random() - 0.5) * 1.6, y0: nz.y, y1: 2.84, spray: true });
      }
    });
    CELLS.forEach((t, i) => {
      for (let k = 0; k < 40; k++) {
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), fm);
        d.scale.set(1, 2.6, 1); G.flow.add(d);
        faceDrops.push({ m: d, t: Math.random(), i, x0: cellX(i) + (Math.random() - 0.5) * (CW - 0.4), z0: (Math.random() - 0.5) * (CD - 0.5), sx: 0, sz: 0, y0: 2.82, y1: Y_BASIN1 - 0.12 });
      }
    });
    // in-pipe flow (built like Silom Chiller RTHD v3): darts ride the pipe
    // centreline and draw through the pipe wall, with a faint guide tube
    // marking the route so each dart reads as flow inside a path
    const dart = new THREE.ConeGeometry(0.08, 0.26, 12); dart.rotateX(Math.PI / 2);
    const tail = new THREE.CylinderGeometry(0.024, 0.008, 0.24, 8); tail.rotateX(Math.PI / 2); tail.translate(0, 0, -0.17);
    const thru = { depthTest: false, depthWrite: false, transparent: true };
    const FM = {
      hot: new THREE.MeshBasicMaterial(Object.assign({ color: 0xfff6ea, opacity: 0.96 }, thru)),
      cold: new THREE.MeshBasicMaterial(Object.assign({ color: 0x1d2b5a, opacity: 0.96 }, thru)),
      soft: new THREE.MeshBasicMaterial(Object.assign({ color: 0xffffff, opacity: 0.42 }, thru)),
      coldSoft: new THREE.MeshBasicMaterial(Object.assign({ color: 0x1d2b5a, opacity: 0.42 }, thru)),
    };
    function tracerPath(pts, color, n, r, gate) {
      const kind = color === 0x3a4a9a ? 'cold' : 'hot';
      const v = pts.map((p) => new THREE.Vector3().fromArray(p));
      const path = new THREE.CurvePath();
      for (let i = 0; i < v.length - 1; i++) path.add(new THREE.LineCurve3(v[i], v[i + 1]));
      const gm = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(8, v.length * 20), r * 0.42, 14, false),
        new THREE.MeshBasicMaterial(Object.assign({ color: kind === 'hot' ? 0xfff6ea : 0x1d2b5a, opacity: 0.2 }, thru)));
      gm.renderOrder = 19; G.flow.add(gm);
      const seg = [], tot = []; let sum = 0;
      for (let i = 0; i < v.length - 1; i++) { const d = v[i].distanceTo(v[i + 1]); seg.push(d); sum += d; tot.push(sum); }
      const off = seg.map(() => new THREE.Vector3());
      for (let k = 0; k < n; k++) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(dart, FM[kind])); g.add(new THREE.Mesh(tail, kind === 'hot' ? FM.soft : FM.coldSoft));
        g.children.forEach((c) => { c.renderOrder = 20; });
        G.flow.add(g);
        tracers.push({ m: g, guide: gm, v, off, seg, tot, len: sum, t: (k / n) * sum, gate });
      }
      if (!n) tracers.push({ m: gm, guideOnly: true, gate });
    }
    // CDWR: plant → riser → top header (hot main)
    tracerPath([[RISER_X, HOT_LOW_Y, AWAY_Z], [RISER_X, HOT_LOW_Y, RZ], [RISER_X, HDR_Y, RZ],
      [RISER_X, HDR_Y, HZ], [HDR_X0, HDR_Y, HZ]], 0xfff4e0, 8, HDR_R, 'hot');
    // header drop into each cell's distribution box
    CELLS.forEach((t, i) => tracerPath([[cellX(i), HDR_Y, HZ], [cellX(i), Y_CAS1 - 0.1, HZ]], 0xfff4e0, 1, 0.115, i));
    // low cross-over into cell 1
    tracerPath([[RISER_X, LOW_Y, RZ], [cellX(0), LOW_Y, RZ], [cellX(0), Y_CAS0 + 0.1, RZ]], 0xfff4e0, 3, 0.13, 0);
    // CDWS: each basin outlet into the main
    CELLS.forEach((t, i) => tracerPath([[cellX(i), CY, CD / 2 + 0.06], [cellX(i), CY, CZ]], 0x3a4a9a, 1, 0.13, i));
    // cold main: flows left to the elbow, then away to the pumps
    tracerPath([[RISER_X + 0.5, CY, CZ], [CX0, CY, CZ], [CX0, CY, AWAY_Z]], 0x3a4a9a, 7, 0.22, 'cold');
  })();

  // ── labels ───────────────────────────────────────────────────────────
  const tagHost = $('tags');
  const TAGS = [
    { pt: 'CT1_Speed', u: '%', d: 1, a: [cellX(0), Y_STK1 + 0.2, 0], t: 'CT-5-01 พัดลม', o: [-40, -96] },
    { pt: 'CT2_Speed', u: '%', d: 1, a: [cellX(1), Y_STK1 + 0.2, 0], t: 'CT-5-02 พัดลม', o: [0, -104] },
    { pt: 'CT3_Speed', u: '%', d: 1, a: [cellX(2), Y_STK1 + 0.2, 0], t: 'CT-5-03 พัดลม', o: [56, -96] },
    { pt: 'HdrReturnTemp', u: '°C', d: 1, a: [0, HDR_Y, -CD * 0.22],
      alt: [[cellX(1), HDR_Y + 0.1, -CD * 0.22]], t: 'CDWR เข้าหัวจ่าย', o: [-150, -34] },
    { pt: 'BasinTemp', u: '°C', d: 1, a: [cellX(1), Y_BASIN0 + 0.62, CD / 2 + 0.1],
      alt: [[cellX(1), Y_BASIN0 + 0.7, 0]], t: 'น้ำในบ่อ', o: [-130, 52] },
    { pt: 'BasinLevel', u: '%', d: 0, a: [cellX(0) - 0.55, Y_BASIN0 + 0.56, CD / 2 + 0.12],
      alt: [[cellX(2) - 0.55, Y_BASIN0 + 0.56, CD / 2 + 0.12]], t: 'ระดับน้ำ HL/LL', o: [-142, 30] },
    { pt: 'CdrPos', u: '', d: 0, a: [RISER_X + 0.4, HDR_Y - 0.75, RZ], t: 'วาล์ว CDR', o: [108, -18] },
    { pt: 'CdsPos', u: '', d: 0, a: [cellX(2), CY, CZ - 0.1],
      alt: [[cellX(1), CY, CZ - 0.1]], t: 'วาล์ว CDS', o: [138, -62] },
  ];
  TAGS.forEach((d) => {
    const e = document.createElement('div');
    e.className = 'tag';
    e.innerHTML = '<i></i><span></span><b></b>';
    e.querySelector('span').textContent = d.t;
    tagHost.appendChild(e);
    const ln = document.createElement('div');
    ln.className = 'tagline'; tagHost.appendChild(ln);
    d.el = e; d.ln = ln; d.val = e.querySelector('b'); d.hw = 0; d.value = null;
  });
  let tagsOn = true;

  function paintTagValues() {
    TAGS.forEach((d) => {
      if (d.value === null || d.value === undefined) { d.val.textContent = ''; d.el.classList.remove('has', 'flt'); return; }
      const v = typeof d.value === 'number' ? d.value.toFixed(d.d) : String(d.value);
      d.val.textContent = v + (d.u ? ' ' + d.u : '');
      d.el.classList.add('has');
      d.el.classList.toggle('flt', !!d.fault);
    });
    TAGS.forEach((d) => { d.hw = 0; });
  }

  const tmpV = new THREE.Vector3();
  function project(p) {
    tmpV.set(p[0], p[1], p[2]).project(camera);
    return [(tmpV.x * 0.5 + 0.5) * host.clientWidth, (-tmpV.y * 0.5 + 0.5) * host.clientHeight, tmpV.z];
  }
  function placeTags() {
    if (!tagsOn) { TAGS.forEach((d) => { d.el.style.opacity = 0; d.ln.style.opacity = 0; }); return; }
    const w = host.clientWidth, h = host.clientHeight;
    const ctlR = $('ctl').getBoundingClientRect();
    const layersEl = $('layers');
    const stripR = $('strip').getBoundingClientRect();
    const viewsR = $('views').getBoundingClientRect();
    const tbR = $('tb').getBoundingClientRect();
    const leftColumn = layersEl
      ? (function () {
          const lb = layersEl.getBoundingClientRect();
          return { left: ctlR.left, right: ctlR.right, top: ctlR.top, bottom: lb.bottom, width: ctlR.width, height: Math.max(0, lb.bottom - ctlR.top) };
        })()
      : ctlR;
    const B = { left: (ctlR.width > 0 ? ctlR.right : 0) + 16, bottom: (stripR.height > 0 ? stripR.top : h) - 12 };
    const placed = [];
    const pad = 10;

    TAGS.forEach((d) => {
      // pick the anchor that is most face-on to the camera
      let anchor = d.a, best = -Infinity;
      const cands = [d.a].concat(d.alt || []);
      cands.forEach((c) => {
        const pr = project(c);
        if (pr[2] > 1) return;
        const score = (pr[0] > B.left ? 1 : 0) * 1000 - Math.abs(pr[1] - h * 0.42);
        if (score > best) { best = score; anchor = c; }
      });
      const p = project(anchor);
      if (p[2] > 1) { d.el.style.opacity = 0; d.ln.style.opacity = 0; return; }

      if (!d.hw) { const r = d.el.getBoundingClientRect(); d.hw = r.width / 2 || 60; d.hh = r.height / 2 || 11; }
      const halfW = d.hw, halfH = d.hh;
      let tx = p[0] + d.o[0], ty = p[1] + d.o[1];

      tx = Math.max(B.left + halfW, Math.min(w - 12 - halfW, tx));
      ty = Math.max(72 + halfH, Math.min(B.bottom - halfH, ty));

      const obstacles = [leftColumn, stripR, viewsR, tbR].filter((r) => r.width > 0 && r.height > 0);
      const clampX = (v) => Math.max(B.left + halfW, Math.min(w - 12 - halfW, v));
      const clampY = (v) => Math.max(72 + halfH, Math.min(B.bottom - halfH, v));
      const hits = (r, px, py) => px + halfW > r.left - pad && px - halfW < r.right + pad &&
        py + halfH > r.top - pad && py - halfH < r.bottom + pad;
      obstacles.forEach((r) => {
        if (!hits(r, tx, ty)) return;
        // every escape is clamped to the frame first, then checked — a candidate
        // that clamps straight back into the panel is no escape at all
        const opts = [
          [tx, r.bottom + pad + halfH], [tx, r.top - pad - halfH],
          [r.right + pad + halfW, ty], [r.left - pad - halfW, ty],
        ].map(([px, py]) => [clampX(px), clampY(py)])
          .filter(([px, py]) => !hits(r, px, py));
        if (!opts.length) return;
        opts.sort((a, b) => (Math.hypot(a[0] - tx, a[1] - ty) - Math.hypot(b[0] - tx, b[1] - ty)));
        tx = opts[0][0]; ty = opts[0][1];
      });
      tx = Math.max(B.left + halfW, Math.min(w - 12 - halfW, tx));
      ty = Math.max(72 + halfH, Math.min(B.bottom - halfH, ty));

      for (let pass = 0; pass < 8; pass++) {
        let moved = false;
        for (let k = 0; k < placed.length; k++) {
          const q = placed[k];
          if (!(Math.abs(tx - q.x) < halfW + q.hw + 8 && Math.abs(ty - q.y) < halfH + q.hh + 6)) continue;
          const dy = halfH + q.hh + 8, dx = halfW + q.hw + 10;
          const away = ty >= q.y ? 1 : -1, side = tx >= q.x ? 1 : -1;
          const list = [
            [tx, q.y + away * dy], [tx, q.y - away * dy],
            [q.x + side * dx, ty], [q.x - side * dx, ty],
            [q.x + side * dx, q.y + away * dy], [q.x - side * dx, q.y - away * dy],
          ];
          let bestC = null;
          for (const [cx2, cy2] of list) {
            const nx = Math.max(B.left + halfW, Math.min(w - 12 - halfW, cx2));
            const ny = Math.max(72 + halfH, Math.min(B.bottom - halfH, cy2));
            if (Math.abs(nx - tx) < 0.5 && Math.abs(ny - ty) < 0.5) continue;
            const ox = Math.max(0, halfW + q.hw + 8 - Math.abs(nx - q.x));
            const oy = Math.max(0, halfH + q.hh + 6 - Math.abs(ny - q.y));
            const area = ox * oy;
            if (area === 0) { tx = nx; ty = ny; moved = true; bestC = null; break; }
            if (!bestC || area < bestC.area) bestC = { nx, ny, area };
          }
          if (bestC) { tx = bestC.nx; ty = bestC.ny; moved = true; }
        }
        if (!moved) break;
      }

      d.el.style.opacity = 1;
      d.el.style.left = tx + 'px';
      d.el.style.top = ty + 'px';
      const dx2 = p[0] - tx, dy2 = p[1] - ty;
      const len = Math.hypot(dx2, dy2);
      d.ln.style.opacity = len > 18 ? 0.9 : 0;
      d.ln.style.left = tx + 'px';
      d.ln.style.top = ty + 'px';
      d.ln.style.width = len + 'px';
      d.ln.style.transform = 'rotate(' + Math.atan2(dy2, dx2) + 'rad)';
      placed.push({ x: tx, y: ty, hw: halfW, hh: halfH });
    });
  }

  // ── state ────────────────────────────────────────────────────────────
  const S = {
    cells: [
      { run: true, speed: 78, glow: 1, spin: 0, kw: 0, hz: 0 },
      { run: true, speed: 78, glow: 1, spin: 0, kw: 0, hz: 0 },
      { run: false, speed: 0, glow: 0, spin: 0, kw: 0, hz: 0 },
    ],
    hdrIn: 35.2, basin: 30.4, level: 62, cutaway: false,
  };
  const LIVE = { on: false };
  const setTxt = (id, v) => { const e = $(id); if (e) e.textContent = v; };

  function cellKw(c) { return c.run ? (55 * Math.pow(c.speed / 100, 3) + 1.5) : 0; }
  function cellHz(c) { return c.run ? c.speed * 0.5 : 0; }

  function paint() {
    let kw = 0, running = 0;
    S.cells.forEach((c, i) => {
      c.kw = cellKw(c); c.hz = cellHz(c);
      kw += c.kw; if (c.run) running++;
      setTxt('c' + (i + 1) + '-kw', c.kw.toFixed(2));
      setTxt('c' + (i + 1) + '-hz', c.hz.toFixed(1));
      setTxt('c' + (i + 1) + '-sp', c.speed.toFixed(1));
      const st = $('c' + (i + 1) + '-state');
      if (st) { st.textContent = c.run ? 'RUN' : 'STOP'; st.className = 'stt ' + (c.run ? 'on' : 'off'); }
      const led = $('c' + (i + 1) + '-led');
      if (led) led.className = 'led ' + (c.run ? 'on' : 'off');
      const b = $('c' + (i + 1) + '-btn');
      if (b) { b.classList.toggle('active', c.run); b.textContent = c.run ? 'STOP' : 'START'; }
      const sl = $('c' + (i + 1) + '-sl');
      if (sl && +sl.value !== Math.round(c.speed)) sl.value = Math.round(c.speed);
    });
    setTxt('r-kw', kw.toFixed(1));
    setTxt('r-run', running + '/3');
    setTxt('r-hdr', S.hdrIn.toFixed(1));
    setTxt('r-basin', S.basin.toFixed(1));
    setTxt('r-range', (S.hdrIn - S.basin).toFixed(1));
    setTxt('r-level', S.level.toFixed(0));
    const led = $('led'); if (led) led.className = 'led ' + (running ? 'on' : 'off');
    const stt = $('r-state');
    if (stt) { stt.textContent = running ? 'RUNNING ' + running + '/3' : 'ALL STOPPED'; stt.className = 'stt ' + (running ? 'on' : 'off'); }

    TAGS[0].value = S.cells[0].run ? S.cells[0].speed : 0;
    TAGS[1].value = S.cells[1].run ? S.cells[1].speed : 0;
    TAGS[2].value = S.cells[2].run ? S.cells[2].speed : 0;
    TAGS[3].value = S.hdrIn;
    TAGS[4].value = S.basin;
    TAGS[5].value = S.level;
    TAGS[5].fault = S.level > 88 || S.level < 22;
    TAGS[6].value = VALVES.filter((v) => /^CDR/.test(v.id) && v.open).length ? 'OPEN' : 'CLOSED';
    TAGS[7].value = VALVES.filter((v) => /^CDS/.test(v.id) && v.open).length + '/3 OPEN';
    paintTagValues();

    // level lamps
    levelLamps.HL.forEach((m) => { m.opacity = S.level > 88 ? 0.95 : 0.3; });
    levelLamps.LL.forEach((m) => { m.opacity = S.level < 22 ? 0.95 : 0.3; });
    if (waterMesh) waterMesh.position.y = Y_BASIN0 + 0.22 + (S.level / 100) * 0.72;
  }

  // valves follow the cells they serve
  function syncValves() {
    VALVES.forEach((v) => {
      const n = +(v.id.match(/(\d)$/) || [0, 1])[1];
      const c = S.cells[Math.min(2, n - 1)] || S.cells[0];
      const auto = /^CDR/.test(v.id) ? S.cells.some((q) => q.run) : !!c.run;   // riser valves are in series and feed the whole bank
      v.open = v.manual !== null ? v.manual : auto;
      v.ind.rotation.y = v.open ? Math.PI / 2 : 0;
      v.head.material = v.open ? mat(0x2a6b3f, 0.4, 0.5) : mAct;
    });
  }

  // cutaway: water pipes go semi-transparent and the flow darts are depth-tested,
  // so they only show inside the pipe and anything in front hides them
  function setPipeGlass(on) {
    [mHot, mHotD, mCold, mColdD].forEach((m) => {
      m.transparent = on; m.opacity = on ? 0.35 : 1; m.depthWrite = !on; m.needsUpdate = true;
    });
    G.flow.traverse((o) => { if (o.material && o.material.isMeshBasicMaterial && o !== G.flow) {
      if (o.material.map) return;
      const isTracer = tracers.some((p) => p.guide === o || (p.m && p.m.children && p.m.children.includes(o)));
      if (isTracer) { o.material.depthTest = on; o.material.needsUpdate = true; }
    } });
  }

  // click a valve to close / reopen it by hand (overrides the auto-follow)
  (function valveClick() {
    const rc = new THREE.Raycaster(), mp = new THREE.Vector2();
    let down = null;
    renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
      const r = renderer.domElement.getBoundingClientRect();
      mp.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      rc.setFromCamera(mp, camera);
      const hit = rc.intersectObjects(G.valves.children, true)[0];
      if (!hit) return;
      const v = VALVES.find((q) => { let o = hit.object; while (o) { if (o === q.g) return true; o = o.parent; } return false; });
      if (!v) return;
      v.manual = !v.open; syncValves(); paint();
    });
  })();

  // ── views ────────────────────────────────────────────────────────────
  const VIEWS = {
    iso: { p: [9.2, 6.6, 10.2], t: [0, 2.3, 0] },
    fans: { p: [4.5, 10.5, 7.5], t: [0, 3.6, 0] },
    louvre: { p: [1.5, 2.6, 11.5], t: [0, 2.0, 0] },
    pipes: { p: [12.5, 5.5, 6.5], t: [3.2, 2.6, 1.4] },
    side: { p: [13, 3.2, 0.5], t: [0, 2.3, 0] },
    top: { p: [0.2, 14.5, 0.6], t: [0, 2.0, 0] },
  };
  let camA = null;
  function setView(k) {
    const v = VIEWS[k] || VIEWS.iso;
    camA = { fp: new THREE.Vector3().fromArray(v.p), ft: new THREE.Vector3().fromArray(v.t), t: 0 };
    ['iso', 'fans', 'louvre', 'pipes', 'side', 'top'].forEach((n) => {
      const b = $('v-' + n); if (b) b.classList.toggle('active', n === k);
    });
  }

  // ── layers ───────────────────────────────────────────────────────────
  const LAYERS = { frame: 'frame', casing: 'casing', fans: 'fans', pipes: 'pipes', valves: 'valves', basin: 'basin', flow: 'flow' };
  document.querySelectorAll('[data-layer]').forEach((b) => {
    b.classList.remove('off');
    b.onclick = () => {
      const g = G[LAYERS[b.dataset.layer]];
      if (!g) return;
      g.visible = !g.visible;
      b.classList.toggle('off', !g.visible);
    };
  });

  // ── controls ─────────────────────────────────────────────────────────
  S.cells.forEach((c, i) => {
    const b = $('c' + (i + 1) + '-btn');
    if (b) b.onclick = () => { if (LIVE.on) return; c.run = !c.run; if (c.run && c.speed < 20) c.speed = 60; syncValves(); paint(); };
    const sl = $('c' + (i + 1) + '-sl');
    if (sl) sl.oninput = () => { if (LIVE.on) return; c.speed = +sl.value; if (c.speed > 0 && !c.run) c.run = true; syncValves(); paint(); };
  });
  const bAll = $('btn-all');
  if (bAll) bAll.onclick = () => {
    if (LIVE.on) return;
    const anyOff = S.cells.some((c) => !c.run);
    S.cells.forEach((c) => { c.run = anyOff; if (anyOff && c.speed < 20) c.speed = 60; });
    syncValves(); paint();
  };
  const bCut = $('btn-cut');
  if (bCut) bCut.onclick = () => {
    S.cutaway = !S.cutaway;
    bCut.classList.toggle('active', S.cutaway);
    G.casing.visible = !S.cutaway;
    fallDrops.forEach((d) => { d.m.visible = false; });
    setPipeGlass(S.cutaway);
    const n = $('cut-note'); if (n) n.textContent = S.cutaway ? 'ผ่าดูภายใน' : 'ตัวเรือนทึบ';
  };
  const bTags = $('btn-tags');
  if (bTags) bTags.onclick = () => { tagsOn = !tagsOn; bTags.classList.toggle('active', tagsOn); };
  ['iso', 'fans', 'louvre', 'pipes', 'side', 'top'].forEach((k) => {
    const b = $('v-' + k); if (b) b.onclick = () => setView(k);
  });

  // ── loop ─────────────────────────────────────────────────────────────
  let last = performance.now(), drift = 0;
  function frame() {
    requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (camA) {
      camA.t = Math.min(1, camA.t + dt * 1.7);
      const e = 1 - Math.pow(1 - camA.t, 3);
      camera.position.lerp(camA.fp, e * 0.3);
      controls.target.lerp(camA.ft, e * 0.3);
      if (camA.t >= 1) camA = null;
    }

    S.cells.forEach((c, i) => {
      const target = c.run ? 1 : 0;
      c.glow += (target - c.glow) * Math.min(1, dt * 2.4);
      if (c.run || c.glow > 0.02) {
        c.spin += dt * (1.6 + (c.speed / 100) * 7) * c.glow;
        if (fanHubs[i]) fanHubs[i].rotation.y = c.spin;


      } else {


      }
    });

    const anyRun = S.cells.some((c) => c.glow > 0.02);
    const avg = S.cells.reduce((a, c) => a + c.glow * (c.speed / 100), 0) / 3;

    // water path follows the valves: CDR-3 → CDR-1 → header → nozzles → fill → basin → CDS-n → main
    const vOpen = (id) => { const v = VALVES.find((q) => q.id === id); return !!(v && v.open); };
    const hotOK = vOpen('CDR-1') && vOpen('CDR-3');
    const cellOK = [1, 2, 3].map((n) => hotOK && vOpen('CDS-' + n));
    const anyCold = cellOK.some(Boolean);
    faceDrops.forEach((d) => {
      d.m.visible = cellOK[d.i];
      if (!d.m.visible) return;
      d.t += dt * 1.1 / (d.y0 - d.y1);
      if (d.t > 1) d.t -= 1;
      d.m.position.set(d.x0 + d.sx * d.t, d.y0 - d.t * (d.y0 - d.y1), d.z0 + d.sz * d.t);
    });
    // falling water in the fill
    if (S.cutaway) {
      fallDrops.forEach((d) => {
        d.t += dt * (0.55 + avg * 0.9);
        if (d.t > 1) d.t -= 1;
        d.m.position.y = Y_CAS1 - 0.1 - d.t * (Y_CAS1 - Y_LOUV0 - 0.2);
        d.m.material.opacity = 0.2 + 0.45 * anyRun;
      });
    }

    // pipe tracers
    const _a = new THREE.Vector3(), _b = new THREE.Vector3();
    tracers.forEach((p) => {
      const on = p.gate === 'hot' ? hotOK : p.gate === 'cold' ? anyCold : cellOK[p.gate];
      p.m.visible = on; if (p.guide) p.guide.visible = on;
      if (!on) return;
      p.t = (p.t + dt * 0.55) % p.len;
      let i = 0; while (i < p.tot.length - 1 && p.t > p.tot[i]) i++;
      const before = i === 0 ? 0 : p.tot[i - 1];
      const local = p.seg[i] ? (p.t - before) / p.seg[i] : 0;
      _a.copy(p.v[i]).add(p.off[i]); _b.copy(p.v[i + 1]).add(p.off[i]);
      p.m.position.lerpVectors(_a, _b, local);
      p.m.lookAt(_b);
      // hide the dart for the short hop round each bend so it never cuts a corner
      const edge = Math.min(p.t - before, p.tot[i] - p.t);
      p.m.scale.setScalar(Math.min(1, edge / 0.2));
    });

    if (anyRun && !LIVE.on) {
      drift += dt;
      if (drift > 1.5) {
        drift = 0;
        const load = Math.max(0.2, avg);
        S.hdrIn = 35 + (Math.random() - 0.5) * 0.5;
        S.basin = S.hdrIn - (3.2 + load * 2.4) + (Math.random() - 0.5) * 0.3;
        S.level = Math.max(24, Math.min(86, S.level + (Math.random() - 0.5) * 2.4));
        paint();
      }
    }

    S.cells.forEach((c, i) => {
      const m = bladeMats[i];
      if (m) {
        m.emissiveIntensity = 0.04 + 0.62 * c.glow;
        m.color.setHex(0xa8b0aa).lerp(new THREE.Color(0x2fd46a), c.glow);
      }
      const hm = hubMats[i];
      if (hm) {
        hm.emissiveIntensity = 0.03 + 0.34 * c.glow;
        hm.color.setHex(0x8e968f).lerp(new THREE.Color(0x3f8f63), c.glow);
      }
      const sm = stackMats[i];
      if (sm) {
        sm.color.setHex(0xd7d5c8).lerp(new THREE.Color(0x8fd9ae), c.glow);
        sm.opacity = 0.46 - 0.16 * c.glow;   // clearer while running
      }
    });

    controls.update();
    renderer.render(scene, camera);
    try { placeTags(); } catch (e) { if (!frame.warned) { frame.warned = 1; console.error('placeTags', e); } }
  }

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    // shift the frustum right by half the covered width; every view preset then
    // frames itself inside the visible area with no per-preset fudging
    const rail = $('ctl');
    const railR = rail ? rail.getBoundingClientRect().right : 0;
    if (railR > 8 && railR < w * 0.6) camera.setViewOffset(w, h, -railR / 2, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  addEventListener('resize', resize);

  function clock() {
    const d = new Date();
    setTxt('tb-time', d.toLocaleTimeString('en-GB'));
    setTxt('tb-date', d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));
  }
  setInterval(clock, 1000); clock();

  resize();
  setView('iso');
  camera.position.fromArray(VIEWS.iso.p);
  controls.target.fromArray(VIEWS.iso.t);
  syncValves();
  paint();
  frame();

  // ── Niagara interface ────────────────────────────────────────────────
  // Point names map straight onto the site graphic:
  //   CT1_Run / CT1_Speed / CT1_Kw / CT1_Hz   (likewise CT2_, CT3_)
  //   HdrReturnTemp · BasinTemp · BasinLevel
  //   CDR_1..3_Open · CDS_1..3_Open
  const API = {
    setPoints(o) {
      if (!o) return false;
      LIVE.on = true;
      const src = $('r-src'); if (src) { src.textContent = 'LIVE'; src.className = 'src live'; }
      [1, 2, 3].forEach((n) => {
        const c = S.cells[n - 1];
        if (o['CT' + n + '_Run'] !== undefined) c.run = !!o['CT' + n + '_Run'];
        if (o['CT' + n + '_Speed'] !== undefined) c.speed = +o['CT' + n + '_Speed'];
        if (o['CT' + n + '_Kw'] !== undefined) c.kwLive = +o['CT' + n + '_Kw'];
        if (o['CT' + n + '_Hz'] !== undefined) c.hzLive = +o['CT' + n + '_Hz'];
      });
      if (o.HdrReturnTemp !== undefined) S.hdrIn = +o.HdrReturnTemp;
      if (o.BasinTemp !== undefined) S.basin = +o.BasinTemp;
      if (o.BasinLevel !== undefined) S.level = +o.BasinLevel;
      VALVES.forEach((v) => {
        const k = v.id.replace('-', '_') + '_Open';
        if (o[k] !== undefined) {
          v.open = !!o[k];
          v.ind.rotation.y = v.open ? Math.PI / 2 : 0;
          v.head.material = v.open ? mat(0x2a6b3f, 0.4, 0.5) : mAct;
        }
      });
      paint();
      return true;
    },
    setSim() {
      LIVE.on = false;
      const src = $('r-src'); if (src) { src.textContent = 'SIM'; src.className = 'src sim'; }
      return true;
    },
    setTag(names) {
      if (Array.isArray(names)) names.forEach((n, i) => { const e = $('c' + (i + 1) + '-tag'); if (e) e.textContent = n; });
      else if (typeof names === 'string') { const e = $('unit-tag'); if (e) e.textContent = names; }
      TAGS.forEach((d) => { d.hw = 0; });
      return true;
    },
    setView,
    showTags(on) { tagsOn = !!on; const b = $('btn-tags'); if (b) b.classList.toggle('active', tagsOn); return true; },
    setCutaway(on) { if (!!on !== S.cutaway) { const b = $('btn-cut'); if (b) b.click(); } return true; },
    state() { return JSON.parse(JSON.stringify({ cells: S.cells, hdrIn: S.hdrIn, basin: S.basin, level: S.level, live: LIVE.on })); },
  };
  window.SilomCT5 = API;
})();
