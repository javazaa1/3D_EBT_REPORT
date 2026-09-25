/* Rosewood FCU — ducted chilled-water fan coil (40VDS type), ceiling-hung on rods + unistrut */
(function () {
  const C = { cab: 0xe8e6de, seam: 0xc9c6bb, dark: 0x2a302d, slab: 0xb9b3a7, steel: 0x8f969a, chws: 0x2f6fb3, chwr: 0x7aa7d6, drain: 0x9aa0a0, copper: 0xb87333, fin: 0xcfd6d8 };
  const S = { run: true, fan: 'Auto', temp: 22.1, sp: 19.5, valve: true, cut: false };
  const stage = document.getElementById('stage');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe4dfd5);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  stage.appendChild(renderer.domElement);
  const ctl = new THREE.OrbitControls(camera, renderer.domElement);
  /* review hook: lets the comment panel read the camera, pick 3D points and take snapshots */
  window.__review = { THREE: THREE, scene: scene, camera: camera, renderer: renderer, controls: ctl };

  ctl.enableDamping = true; ctl.target.set(0, 0.1, 0);

  scene.add(new THREE.HemisphereLight(0xfffaf0, 0x8a8478, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(4, 6, 5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xfff4e6, 0.3); fill.position.set(-5, 2, -3); scene.add(fill);

  const mat = (c, m = 0.1, r = 0.6, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: m, roughness: r }, o));
  const add = (p, g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const e = new THREE.Mesh(g, m); e.position.set(x, y, z); e.rotation.set(rx, ry, rz); e.castShadow = e.receiveShadow = true; p.add(e); return e; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (a, b, h, s = 16, hs = 1, open = false) => new THREE.CylinderGeometry(a, b, h, s, hs, open);

  const mCab = mat(C.cab, 0.15, 0.55), mCabGlass = mat(C.cab, 0.1, 0.5, { transparent: true, opacity: 0.18, depthWrite: false });
  const mSeam = mat(C.seam, 0.2, 0.6), mDark = mat(C.dark, 0.2, 0.8), mSteel = mat(C.steel, 0.6, 0.4);
  const mSlab = mat(0x9c968b, 0, 0.95), mWheel = mat(0xd9dde0, 0.5, 0.35), mScroll = mat(0xb9bfc2, 0.5, 0.45);

  const W = 1.7, H = 0.56, D = 1.15, Y0 = 0;
  const root = new THREE.Group(); scene.add(root);
  const G = {}; ['struct', 'cab', 'inner', 'pipes', 'flow'].forEach((k) => { G[k] = new THREE.Group(); root.add(G[k]); });

  // slab + rods + unistrut
  const SLAB_Y = 1.25;
  add(G.struct, box(6, 0.18, 4), mSlab, 0, SLAB_Y + 0.09, 0).castShadow = false;
  const RX = W / 2 + 0.12, RZ = D / 2 - 0.12, UY = -H / 2 - 0.05;
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
    add(G.struct, cyl(0.009, 0.009, SLAB_Y - UY, 8), mSteel, sx * RX, (SLAB_Y + UY) / 2, sz * RZ);
    add(G.struct, cyl(0.022, 0.022, 0.02, 6), mSteel, sx * RX, UY + 0.035, sz * RZ);
  });
  [1, -1].forEach((sz) => {
    const u = add(G.struct, box(W + 0.36, 0.045, 0.045), mSteel, 0, UY, sz * RZ);
    add(G.struct, box(W + 0.36, 0.006, 0.03), mDark, 0, UY + 0.02, sz * RZ);
  });

  // cabinet: 6 panels so it can go see-through in cutaway
  const cab = [];
  const panel = (w, h, d, x, y, z) => { const p = add(G.cab, box(w, h, d), mCab, x, y, z); cab.push(p); return p; };
  panel(W, 0.02, D, 0, H / 2, 0); panel(W, 0.02, D, 0, -H / 2, 0);
  panel(0.02, H, D, W / 2, 0, 0); panel(0.02, H, D, -W / 2, 0, 0);
  // front with two outlet holes: build as strips
  const OW = 0.4, OH = 0.36, OX = [-0.36, 0.36], OY = 0.02, FZ = D / 2;
  const fx = [-W / 2, OX[0] - OW / 2, OX[0] + OW / 2, OX[1] - OW / 2, OX[1] + OW / 2, W / 2];
  for (let i = 0; i < fx.length - 1; i += 2) panel(fx[i + 1] - fx[i], H, 0.02, (fx[i] + fx[i + 1]) / 2, 0, FZ);
  OX.forEach((x) => {
    panel(OW, H / 2 - (OY + OH / 2), 0.02, x, (H / 2 + OY + OH / 2) / 2, FZ);
    panel(OW, (OY - OH / 2) + H / 2, 0.02, x, (-H / 2 + OY - OH / 2) / 2, FZ);
  });
  // back: return-air filter frame
  panel(W, H, 0.02, 0, 0, -D / 2);
  const grille = new THREE.Group(); G.cab.add(grille);
  add(grille, box(W - 0.16, H - 0.12, 0.012), mDark, 0, 0, -D / 2 - 0.012);
  for (let k = 0; k < 18; k++) add(grille, box(0.012, H - 0.14, 0.02), mSeam, -W / 2 + 0.1 + k * (W - 0.2) / 17, 0, -D / 2 - 0.02);
  // seams + corner trims
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => add(G.cab, box(0.03, H + 0.01, 0.03), mSeam, sx * W / 2, 0, sz * D / 2));
  // outlet flanges
  OX.forEach((x) => {
    [[OW + 0.06, 0.03, 0, OH / 2 + 0.015], [OW + 0.06, 0.03, 0, -OH / 2 - 0.015], [0.03, OH, OW / 2 + 0.015, 0], [0.03, OH, -OW / 2 - 0.015, 0]]
      .forEach(([w, h, dx, dy]) => add(G.cab, box(w, h, 0.05), mSeam, x + dx, OY + dy, FZ + 0.02));
  });
  // nameplate on the right side
  const plate = (function () {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#e8e6de'; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#1f3d73'; g.beginPath(); g.ellipse(256, 128, 230, 104, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.beginPath(); g.ellipse(256, 128, 212, 88, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ffffff'; g.font = 'italic 700 92px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('40VDS', 256, 134);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  })();
  const np = add(G.cab, new THREE.PlaneGeometry(0.34, 0.17), new THREE.MeshStandardMaterial({ map: plate, roughness: 0.5 }), W / 2 + 0.012, 0.06, 0.12, 0, Math.PI / 2, 0);
  cab.push(np);

  // inside: blower scrolls + wheels, coil, drain pan
  const wheels = [];
  OX.forEach((x) => {
    const sc = add(G.inner, cyl(0.24, 0.24, 0.44, 32, 1, true), mat(0xb9bfc2, 0.5, 0.45, { side: THREE.BackSide }), x, 0.0, FZ - 0.34, 0, 0, Math.PI / 2);
    [[OW, 0.01, 0, OH / 2], [OW, 0.01, 0, -OH / 2], [0.01, OH, OW / 2, 0], [0.01, OH, -OW / 2, 0]].forEach(([w, h, dx, dy]) => add(G.inner, box(w, h, 0.26), mScroll, x + dx, OY + dy, FZ - 0.14));
    const wg = new THREE.Group(); wg.position.set(x, 0.0, FZ - 0.34); G.inner.add(wg);
    const bl = new THREE.BoxGeometry(0.4, 0.016, 0.05);
    for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2; const b = add(wg, bl, mWheel, 0, Math.cos(a) * 0.17, Math.sin(a) * 0.17, a + 0.5, 0, 0); b.castShadow = false; }
    add(wg, cyl(0.19, 0.19, 0.012, 32), mWheel, 0.2, 0, 0, 0, 0, Math.PI / 2);
    add(wg, cyl(0.19, 0.19, 0.012, 32), mWheel, -0.2, 0, 0, 0, 0, Math.PI / 2);
    add(wg, cyl(0.018, 0.018, 0.5, 10), mSteel, 0, 0, 0, 0, 0, Math.PI / 2);
    wheels.push(wg);
  });
  add(G.inner, cyl(0.07, 0.07, 0.22, 20), mat(0x3d4a44, 0.4, 0.5), 0, 0.0, FZ - 0.34, 0, 0, Math.PI / 2);
  // coil
  const coilZ = -D / 2 + 0.2;
  const coilTex = (function () { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#b8c2c4'; g.fillRect(0, 0, 256, 64); g.strokeStyle = '#8e999b'; g.lineWidth = 1.2; for (let i = 0; i < 256; i += 3) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2); return t; })();
  add(G.inner, box(W - 0.14, H - 0.1, 0.1), new THREE.MeshStandardMaterial({ map: coilTex, metalness: 0.4, roughness: 0.5 }), 0, 0.02, coilZ);
  for (let r = 0; r < 4; r++) add(G.inner, cyl(0.012, 0.012, W - 0.1, 8), mat(C.copper, 0.7, 0.35), 0, -0.14 + r * 0.1, coilZ + 0.055, 0, 0, Math.PI / 2);
  add(G.inner, box(W - 0.1, 0.03, 0.26), mat(0x9aa3a6, 0.5, 0.4), 0, -H / 2 + 0.03, coilZ);

  // CHW piping on the right: supply (low) → coil, coil → 2-way valve → return (high)
  const mS = mat(C.chws, 0.3, 0.45), mR = mat(C.chwr, 0.3, 0.45), mDr = mat(C.drain, 0.2, 0.6);
  const PX = W / 2, PZ1 = coilZ - 0.02, PZ2 = coilZ + 0.1, pr = 0.032;
  const run = (m, pts, r) => { for (let i = 0; i < pts.length - 1; i++) { const a = new THREE.Vector3(...pts[i]), b = new THREE.Vector3(...pts[i + 1]); const L = a.distanceTo(b); const e = add(G.pipes, cyl(r, r, L, 16), m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); e.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); if (i) add(G.pipes, new THREE.SphereGeometry(r * 1.02, 12, 10), m, a.x, a.y, a.z); } };
  const SUP = [[PX - 0.02, -0.12, PZ1], [PX + 0.3, -0.12, PZ1], [PX + 0.3, SLAB_Y - 0.12, PZ1], [PX + 0.3, SLAB_Y - 0.12, PZ1 - 1.4]];
  const RET = [[PX - 0.02, 0.14, PZ2], [PX + 0.48, 0.14, PZ2], [PX + 0.48, SLAB_Y - 0.26, PZ2], [PX + 0.48, SLAB_Y - 0.26, PZ1 - 1.4]];
  run(mS, SUP, pr); run(mR, RET, pr);
  // 2-way valve + actuator on return
  const VX = PX + 0.24, VY = 0.14;
  add(G.pipes, box(0.1, 0.08, 0.08), mat(0x5c6663, 0.5, 0.45), VX, VY, PZ2);
  add(G.pipes, cyl(0.012, 0.012, 0.08, 8), mSteel, VX, VY + 0.08, PZ2);
  const act = add(G.pipes, box(0.11, 0.1, 0.09), mat(0x2b2f2d, 0.1, 0.7), VX, VY + 0.17, PZ2);
  const actLed = add(G.pipes, new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({ color: 0x3fd977 }), VX + 0.056, VY + 0.19, PZ2);
  // condensate drain
  run(mDr, [[PX - 0.02, -H / 2 + 0.04, coilZ - 0.08], [PX + 0.14, -H / 2 + 0.04, coilZ - 0.08], [PX + 0.14, -H / 2 - 0.3, coilZ - 0.08]], 0.018);
  // supply/return duct stubs
  OX.forEach((x) => add(G.cab, box(OW + 0.02, OH + 0.02, 0.2), mat(0xc2c6c4, 0.5, 0.45, { transparent: true, opacity: 0.0 }), x, OY, FZ + 0.14).visible = false);

  // flow darts (chiller-style: cone head + faded tail, inside the pipe / airstream)
  const dartG = new THREE.ConeGeometry(0.03, 0.09, 12); dartG.rotateX(Math.PI / 2);
  const tailG = new THREE.CylinderGeometry(0.01, 0.003, 0.09, 8); tailG.rotateX(Math.PI / 2); tailG.translate(0, 0, -0.07);
  const thru = { transparent: true, depthTest: false, depthWrite: false };
  const tracers = [];
  function path(pts, color, n, speed, scale = 1, guide = 0.2) {
    const air = scale > 1.2, thru = air ? { transparent: true, depthWrite: false } : { transparent: true, depthTest: false, depthWrite: false };
    const v = pts.map((p) => new THREE.Vector3(...p)); const seg = [], tot = []; let sum = 0;
    for (let i = 0; i < v.length - 1; i++) { const d = v[i].distanceTo(v[i + 1]); seg.push(d); sum += d; tot.push(sum); }
    const cp = new THREE.CurvePath(); for (let i = 0; i < v.length - 1; i++) cp.add(new THREE.LineCurve3(v[i], v[i + 1]));
    const gl = new THREE.Mesh(new THREE.TubeGeometry(cp, v.length * 16, 0.011 * scale, 8, false), new THREE.MeshBasicMaterial(Object.assign({ color, opacity: guide }, thru)));
    gl.renderOrder = 19; G.flow.add(gl);
    const mh = new THREE.MeshBasicMaterial(Object.assign({ color, opacity: 0.95 }, thru)), mt = new THREE.MeshBasicMaterial(Object.assign({ color, opacity: 0.4 }, thru));
    for (let k = 0; k < n; k++) {
      const g = new THREE.Group(); const h = new THREE.Mesh(dartG, mh), t = new THREE.Mesh(tailG, mt); h.renderOrder = t.renderOrder = 20; g.add(h, t); g.scale.setScalar(scale); G.flow.add(g);
      tracers.push({ g, gl, v, seg, tot, len: sum, t: (k / n) * sum, speed, base: scale });
    }
  }
  path(SUP.slice().reverse(), 0x9fd0ff, 6, 0.35); // supply comes from riser into coil
  path(RET, 0xffffff, 6, 0.35);
  const AIR_IN = 0xd9a06a, AIR_OUT = 0x7fd0ff;
  [-0.45, 0.45].forEach((x) => path([[x, 0.02, -D / 2 - 0.5], [x, 0.02, coilZ - 0.1]], AIR_IN, 2, 0.45, 1.8, 0.12));
  OX.forEach((x) => path([[x, OY, FZ - 0.1], [x, OY, FZ + 0.8]], AIR_OUT, 2, 0.6, 1.8, 0.12));

  // live values UI
  const $ = (id) => document.getElementById(id);
  function paint() {
    $('cmd').textContent = S.run ? 'On' : 'Off'; $('cmd').className = 'val ' + (S.run ? 'on' : 'off');
    $('mode').textContent = 'Cool'; $('fan').textContent = S.fan;
    $('temp').textContent = S.temp.toFixed(1) + ' °C'; $('sp').textContent = S.sp.toFixed(1) + ' °C';
    $('valve').textContent = S.run && S.valve ? 'Open' : 'Closed';
    $('stat').textContent = S.run ? 'RUNNING' : 'STOPPED'; $('stat').className = 'stat ' + (S.run ? 'on' : 'off');
    $('tsT').textContent = S.temp.toFixed(1); $('tsF').textContent = S.fan; $('tsO').textContent = S.run ? 'On' : 'Off';
    actLed.material.color.set(S.run && S.valve ? 0x3fd977 : 0x8a9990);
    document.querySelectorAll('[data-fan]').forEach((b) => b.classList.toggle('active', b.dataset.fan === S.fan));
    $('btn-run').classList.toggle('active', S.run); $('btn-stop').classList.toggle('active', !S.run);
    $('btn-cut').classList.toggle('active', S.cut);
  }
  function setCut(on) { S.cut = on; cab.forEach((p) => { p.material = on ? mCabGlass : (p === np ? p.material : mCab); if (p === np) p.visible = !on; }); grille.visible = !on; paint(); }
  $('btn-run').onclick = () => { S.run = true; paint(); };
  $('btn-stop').onclick = () => { S.run = false; paint(); };
  $('btn-cut').onclick = () => setCut(!S.cut);
  document.querySelectorAll('[data-fan]').forEach((b) => (b.onclick = () => { S.fan = b.dataset.fan; paint(); }));
  const views = { iso: [3.9, 1.7, 4.5], front: [0, 0.25, 5], side: [5, 0.5, 0.4], under: [2.8, -3, 3.4] };
  let fly = null;
  Object.keys(views).forEach((k) => { const b = $('v-' + k); if (b) b.onclick = () => { fly = new THREE.Vector3(...views[k]); document.querySelectorAll('.vb').forEach((q) => q.classList.toggle('active', q === b)); }; });
  camera.position.set(...views.iso);
  window.FCU = { S, paint, setCut };

  function resize() { const r = stage.getBoundingClientRect(); renderer.setSize(r.width, r.height); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();

  const clock = new THREE.Clock(); const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const FAN_K = { Low: 0.55, Med: 0.8, High: 1, Auto: 0.8 };
  (function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, clock.getDelta());
    if (fly) { camera.position.lerp(fly, 0.08); if (camera.position.distanceTo(fly) < 0.01) fly = null; }
    const k = S.run ? FAN_K[S.fan] : 0;
    wheels.forEach((w) => (w.rotation.x -= dt * 2 * Math.PI * 1.9 * k));
    tracers.forEach((p) => {
      const water = p.speed < 0.4, on = S.run && (!water || S.valve);
      p.g.visible = on; p.gl.visible = on; if (!on) return;
      p.t = (p.t + dt * p.speed * (water ? 1 : k)) % p.len;
      let i = 0; while (i < p.tot.length - 1 && p.t > p.tot[i]) i++;
      const before = i ? p.tot[i - 1] : 0, f = p.seg[i] ? (p.t - before) / p.seg[i] : 0;
      p.g.position.lerpVectors(p.v[i], p.v[i + 1], f); p.g.lookAt(p.v[i + 1]);
      const edge = Math.min(p.t - before, p.tot[i] - p.t);
      p.g.scale.setScalar(p.base * Math.min(1, edge / 0.06));
    });
    ctl.update(); renderer.render(scene, camera);
  })();
  paint();
})();
