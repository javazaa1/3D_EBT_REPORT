/* Rosewood OAU — outdoor air unit: inlet duct → filter → CHW coil → belt-driven centrifugal fan → supply duct */
(function () {
  const S = { run: true, auto: true, vsd: 72, lat: 16.8, latSp: 17.0, valve: 64, pa: 245, paSp: 250, filter: 'CLEAN', fault: 'NORMAL', casing: 'open' };
  const stage = document.getElementById('stage');
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe9e5dc);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  stage.appendChild(renderer.domElement);
  const ctl = new THREE.OrbitControls(camera, renderer.domElement);
  /* review hook: lets the comment panel read the camera, pick 3D points and take snapshots */
  window.__review = { THREE: THREE, scene: scene, camera: camera, renderer: renderer, controls: ctl };

  ctl.enableDamping = true; ctl.target.set(0.2, 0.2, 0);

  scene.add(new THREE.HemisphereLight(0xfffaf0, 0x7d776c, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 0.75); key.position.set(-4, 9, 7); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 6, bottom: -6 }); scene.add(key);
  const rim = new THREE.DirectionalLight(0xfff0e0, 0.3); rim.position.set(6, 3, -5); scene.add(rim);

  const mat = (c, m = 0.1, r = 0.6, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: m, roughness: r }, o));
  const add = (p, g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const e = new THREE.Mesh(g, m); e.position.set(x, y, z); e.rotation.set(rx, ry, rz); e.castShadow = e.receiveShadow = true; p.add(e); return e; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (a, b, h, s = 20, open = false) => new THREE.CylinderGeometry(a, b, h, s, 1, open);
  const G = {}; ['floor', 'duct', 'cab', 'inner', 'pipes', 'flow'].forEach((k) => { G[k] = new THREE.Group(); scene.add(G[k]); });

  const mPanel = mat(0xe6e3da, 0.12, 0.55), mInside = mat(0xd4d2ca, 0.2, 0.6), mFrame = mat(0x8e9496, 0.55, 0.4);
  const mDuct = mat(0x7d8285, 0.55, 0.5), mDuctJ = mat(0x5f6467, 0.6, 0.45), mBase = mat(0x3a403d, 0.4, 0.6);
  const mSteel = mat(0x9aa1a4, 0.65, 0.35), mDark = mat(0x2b302e, 0.3, 0.7);

  // floor
  const fl = add(G.floor, box(120, 0.05, 120), mat(0xb4ada0, 0, 0.95), 0.5, -0.9, 0);
  scene.background = new THREE.Color(0xd9d3c8); scene.fog = new THREE.Fog(0xd9d3c8, 18, 45); fl.castShadow = false;

  // casing dimensions
  const X0 = -2.6, X1 = 2.6, H = 1.5, D = 1.6, YB = -0.75, YT = YB + H, ZF = D / 2, ZB = -D / 2;
  const XF = -1.25, XC = -0.35;              // section splits: filter | coil | fan
  add(G.cab, box(X1 - X0 + 0.1, 0.12, D + 0.1), mBase, 0, YB - 0.06, 0);
  // panels (front is removable for the cutaway)
  const front = [];
  add(G.cab, box(X1 - X0, 0.03, D), mPanel, 0, YT, 0);
  add(G.cab, box(X1 - X0, H, 0.03), mPanel, 0, YB + H / 2, ZB);
  add(G.cab, box(X1 - X0, 0.02, D), mInside, 0, YB + 0.01, 0);
  [XF, XC].forEach((x) => add(G.cab, box(0.04, H, D), mInside, x, YB + H / 2, 0).visible = false);
  [[XF, XC - XF], [XC, X1 - XC], [X0, XF - X0]].forEach(([x, w]) => front.push(add(G.cab, box(w - 0.02, H - 0.04, 0.03), mPanel, x + w / 2, YB + H / 2, ZF)));
  // end walls with openings (inlet full-face at left, outlet high at right)
  const IW = 1.25, IH = 1.2, OWD = 0.8, OH = 0.62, OY = YT - 0.45;
  const endWall = (x, ow, oh, oy) => {
    add(G.cab, box(0.03, (YT - (oy + oh / 2)), D), mPanel, x, (YT + oy + oh / 2) / 2, 0);
    add(G.cab, box(0.03, (oy - oh / 2) - YB, D), mPanel, x, (YB + oy - oh / 2) / 2, 0);
    [1, -1].forEach((s) => add(G.cab, box(0.03, oh, (D - ow) / 2), mPanel, x, oy, s * (ow / 2 + (D - ow) / 4)));
  };
  endWall(X0, IW, IH, YB + H / 2); endWall(X1, OWD, OH, OY);
  // frame posts + rails
  [X0, XF, XC, X1].forEach((x) => [ZF, ZB].forEach((z) => add(G.cab, box(0.07, H + 0.02, 0.07), mFrame, x, YB + H / 2, z)));
  [YT, YB + 0.02].forEach((y) => [ZF, ZB].forEach((z) => add(G.cab, box(X1 - X0 + 0.07, 0.07, 0.07), mFrame, 0, y, z)));
  [X0, X1].forEach((x) => [YT, YB + 0.02].forEach((y) => add(G.cab, box(0.07, 0.07, D), mFrame, x, y, 0)));
  // access-door handles
  const handles = [];
  [[X0 + 0.25], [XF + 0.2], [X1 - 0.3]].forEach(([x]) => [0.25, -0.25].forEach((dy) => handles.push(add(G.cab, box(0.04, 0.12, 0.05), mDark, x, YB + H / 2 + dy, ZF + 0.03))));

  // ducts
  const duct = (x0, x1, w, h, y) => {
    add(G.duct, box(x1 - x0, h, w), mDuct, (x0 + x1) / 2, y, 0);
    const n = Math.max(1, Math.round((x1 - x0) / 1.2));
    for (let k = 0; k <= n; k++) { const x = x0 + (k * (x1 - x0)) / n; add(G.duct, box(0.05, h + 0.06, w + 0.06), mDuctJ, x, y, 0); }
  };
  duct(-6.0, X0, IW, IH, YB + H / 2);
  duct(X1, 5.8, OWD, OH, OY);

  // filter section: pleated green media on a slant
  const pleat = (function () { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#7fae5c'; g.fillRect(0, 0, 64, 256); for (let y = 0; y < 256; y += 16) { g.fillStyle = '#5f8f44'; g.fillRect(0, y, 64, 6); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 6); t.encoding = THREE.sRGBEncoding; return t; })();
  const mFilter = mat(0xffffff, 0, 0.9, { map: pleat });
  add(G.inner, box(0.08, H - 0.14, D - 0.14), mFilter, (X0 + XF) / 2 - 0.05, YB + H / 2, 0, 0, 0, 0.1);
  add(G.inner, box(0.1, H - 0.1, D - 0.1), mat(0xa8aca9, 0.5, 0.4, { wireframe: false }), (X0 + XF) / 2 - 0.05, YB + H / 2, 0, 0, 0, 0.1).scale.set(1, 1, 1);
  G.inner.children[G.inner.children.length - 1].visible = false;

  // coil section: finned coil + headers
  const fin = (function () { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#39413f'; g.fillRect(0, 0, 256, 64); g.strokeStyle = '#6c7674'; g.lineWidth = 1.3; for (let i = 0; i < 256; i += 3) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 4); return t; })();
  const CX = (XF + XC) / 2;
  add(G.inner, box(0.22, H - 0.16, D - 0.2), mat(0xffffff, 0.4, 0.5, { map: fin }), CX, YB + H / 2, 0);
  [-0.07, 0.07].forEach((dx) => add(G.inner, cyl(0.045, 0.045, H - 0.12, 14), mat(0xb87333, 0.7, 0.35), CX + dx, YB + H / 2, ZF - 0.14));
  add(G.inner, box(0.34, 0.04, D - 0.1), mSteel, CX, YB + 0.05, 0);
  // leaving-air temp probe
  const lat = add(G.inner, cyl(0.012, 0.012, 0.5, 8), mSteel, XC + 0.08, YB + H * 0.62, ZF - 0.3, Math.PI / 2, 0, 0);

  // fan section
  const FX = 1.25, FY = OY - 0.08, FR = 0.46, FW = 0.62;
  // scroll housing (open front ring + back plate) and discharge to outlet
  add(G.inner, cyl(FR + 0.08, FR + 0.08, FW, 40, true), mat(0xc8cdcf, 0.5, 0.4, { side: THREE.DoubleSide }), FX, FY, 0, Math.PI / 2, 0, 0);
  add(G.inner, cyl(FR + 0.08, FR + 0.08, 0.02, 40), mat(0xb3b9bb, 0.5, 0.4), FX, FY, -FW / 2, Math.PI / 2, 0, 0);
  add(G.inner, box(X1 - FX, OH - 0.04, OWD - 0.06), mat(0xc8cdcf, 0.5, 0.4, { transparent: true, opacity: 0.35, depthWrite: false }), (FX + X1) / 2 + 0.12, OY, 0);
  // inlet cone + wheel
  add(G.inner, cyl(0.22, 0.34, 0.12, 32, true), mat(0x6f7a78, 0.5, 0.4, { side: THREE.DoubleSide }), FX, FY, FW / 2 + 0.05, Math.PI / 2, 0, 0);
  const wheel = new THREE.Group(); wheel.position.set(FX, FY, 0); scene.add(wheel);
  const blade = box(0.02, 0.14, FW - 0.08), mBlade = mat(0x2f3533, 0.4, 0.5);
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; const b = add(wheel, blade, mBlade, Math.cos(a) * (FR - 0.1), Math.sin(a) * (FR - 0.1), 0, 0, 0, a + 0.6); b.castShadow = false; }
  add(wheel, cyl(FR - 0.02, FR - 0.02, 0.02, 32), mat(0x3fae5a, 0.3, 0.5), 0, 0, FW / 2 - 0.02, Math.PI / 2, 0, 0);
  add(wheel, cyl(FR - 0.02, FR - 0.02, 0.02, 32), mBlade, 0, 0, -FW / 2 + 0.02, Math.PI / 2, 0, 0);
  add(wheel, cyl(0.03, 0.03, FW + 0.5, 12), mSteel, 0, 0, 0.1, Math.PI / 2, 0, 0);
  // fan pulley (front)
  const fanPul = new THREE.Group(); fanPul.position.set(FX, FY, FW / 2 + 0.32); scene.add(fanPul);
  add(fanPul, cyl(0.2, 0.2, 0.07, 32), mDark, 0, 0, 0, Math.PI / 2, 0, 0);
  for (let k = 0; k < 5; k++) add(fanPul, box(0.03, 0.34, 0.075), mat(0x3fae5a, 0.3, 0.5), 0, 0, 0, 0, 0, (k / 5) * Math.PI);
  // motor on slide base
  const MX = 0.45, MY = YB + 0.34, MZ = FW / 2 + 0.05;
  add(G.inner, box(1.2, 0.08, 0.9), mBase, MX, YB + 0.08, 0.1);
  [-0.5, 0.5].forEach((dx) => [-0.3, 0.45].forEach((dz) => add(G.inner, cyl(0.05, 0.05, 0.08, 12), mDark, MX + dx, YB + 0.02, dz)));
  const mMotor = mat(0x55605b, 0.45, 0.45);
  add(G.inner, cyl(0.2, 0.2, 0.5, 28), mMotor, MX, MY, MZ - 0.12, Math.PI / 2, 0, 0);
  for (let k = 0; k < 14; k++) add(G.inner, box(0.012, 0.44, 0.03), mMotor, MX, MY, MZ - 0.12, 0, 0, (k / 14) * Math.PI).scale.set(1, 1, 16);
  add(G.inner, box(0.36, 0.08, 0.4), mMotor, MX, MY - 0.2, MZ - 0.12);
  add(G.inner, box(0.16, 0.12, 0.14), mMotor, MX, MY + 0.24, MZ - 0.12);
  const motPul = new THREE.Group(); motPul.position.set(MX, MY, FW / 2 + 0.32); scene.add(motPul);
  add(motPul, cyl(0.08, 0.08, 0.07, 24), mDark, 0, 0, 0, Math.PI / 2, 0, 0);
  add(motPul, box(0.02, 0.14, 0.075), mSteel, 0, 0, 0);
  add(G.inner, cyl(0.022, 0.022, 0.3, 10), mSteel, MX, MY, FW / 2 + 0.18, Math.PI / 2, 0, 0);
  // belt: two tangent straps
  (function () {
    const a = new THREE.Vector2(MX, MY), b = new THREE.Vector2(FX, FY), r1 = 0.085, r2 = 0.205;
    const d = b.clone().sub(a), L = d.length(), ang = Math.atan2(d.y, d.x), beta = Math.asin((r2 - r1) / L);
    [1, -1].forEach((s) => {
      const n = ang + s * (Math.PI / 2 + beta);
      const p1 = new THREE.Vector2(a.x + r1 * Math.cos(n), a.y + r1 * Math.sin(n)), p2 = new THREE.Vector2(b.x + r2 * Math.cos(n), b.y + r2 * Math.sin(n));
      const m = p1.clone().add(p2).multiplyScalar(0.5), len = p1.distanceTo(p2);
      add(G.inner, box(len, 0.018, 0.05), mDark, m.x, m.y, FW / 2 + 0.32, 0, 0, Math.atan2(p2.y - p1.y, p2.x - p1.x));
    });
  })();
  // belt guard frame (open)
  // VSD box on casing top-right side
  const vsd = add(G.cab, box(0.34, 0.46, 0.14), mat(0x2d3531, 0.2, 0.6), X1 - 0.35, YB + 0.55, ZB - 0.1);
  const vsdLed = add(G.cab, new THREE.SphereGeometry(0.02, 10, 8), new THREE.MeshBasicMaterial({ color: 0x3fd977 }), X1 - 0.35, YB + 0.7, ZB - 0.18);

  // CHW piping on top: in/out from coil headers, rising then running left
  const mS = mat(0x2f6fb3, 0.3, 0.45), mR = mat(0x7aa7d6, 0.3, 0.45);
  const run = (m, pts, r) => { for (let i = 0; i < pts.length - 1; i++) { const a = new THREE.Vector3(...pts[i]), b = new THREE.Vector3(...pts[i + 1]); const e = add(G.pipes, cyl(r, r, a.distanceTo(b), 16), m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); e.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); if (i) add(G.pipes, new THREE.SphereGeometry(r * 1.02, 12, 10), m, a.x, a.y, a.z); } };
  const PY1 = YT + 0.28, PY2 = YT + 0.5, PZ = ZF - 0.14;
  const SUP = [[-4.2, PY1, PZ], [CX - 0.07, PY1, PZ], [CX - 0.07, YT - 0.06, PZ]];
  const RET = [[CX + 0.07, YT - 0.06, PZ], [CX + 0.07, PY2, PZ], [CX + 0.9, PY2, PZ], [CX + 0.9, PY2, PZ - 0.35], [-4.2, PY2, PZ - 0.35]];
  run(mS, SUP, 0.05); run(mR, RET, 0.05);
  // isolation valves + control valve w/ actuator on return
  const valve = (x, y, z, m) => { add(G.pipes, box(0.14, 0.12, 0.12), mat(0x3b4240, 0.4, 0.5), x, y, z); add(G.pipes, cyl(0.012, 0.012, 0.1, 8), mSteel, x, y + 0.1, z); add(G.pipes, box(0.2, 0.02, 0.03), mat(0xa8583c, 0.3, 0.5), x, y + 0.16, z); };
  valve(-1.8, PY1, PZ); valve(-1.8, PY2, PZ - 0.35);
  const CVX = -0.6;
  add(G.pipes, box(0.16, 0.14, 0.14), mat(0x3b4240, 0.4, 0.5), CVX, PY2, PZ - 0.35);
  add(G.pipes, cyl(0.014, 0.014, 0.12, 8), mSteel, CVX, PY2 + 0.12, PZ - 0.35);
  add(G.pipes, box(0.16, 0.14, 0.13), mDark, CVX, PY2 + 0.25, PZ - 0.35);
  const cvLed = add(G.pipes, new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshBasicMaterial({ color: 0x3fd977 }), CVX + 0.082, PY2 + 0.28, PZ - 0.35);
  // duct static pressure sensor on outlet duct
  const PSX = 4.2;
  add(G.duct, box(0.16, 0.1, 0.12), mDark, PSX, OY + OH / 2 + 0.08, 0);
  add(G.duct, cyl(0.008, 0.008, 0.1, 6), mSteel, PSX, OY + OH / 2 + 0.01, 0);

  // flow darts (chiller-style) — water in pipes draws through the wall, air is depth-tested
  const dartG = new THREE.ConeGeometry(0.04, 0.12, 12); dartG.rotateX(Math.PI / 2);
  const tailG = new THREE.CylinderGeometry(0.014, 0.004, 0.12, 8); tailG.rotateX(Math.PI / 2); tailG.translate(0, 0, -0.09);
  const tracers = [];
  function path(pts, color, n, speed, scale, water) {
    const v = pts.map((p) => new THREE.Vector3(...p)); const seg = [], tot = []; let sum = 0;
    for (let i = 0; i < v.length - 1; i++) { const d = v[i].distanceTo(v[i + 1]); seg.push(d); sum += d; tot.push(sum); }
    const th = water ? { transparent: true, depthTest: false, depthWrite: false } : { transparent: true, depthWrite: false };
    const cp = new THREE.CurvePath(); for (let i = 0; i < v.length - 1; i++) cp.add(new THREE.LineCurve3(v[i], v[i + 1]));
    const gl = new THREE.Mesh(new THREE.TubeGeometry(cp, v.length * 16, 0.012 * scale, 8, false), new THREE.MeshBasicMaterial(Object.assign({ color, opacity: 0.2 }, th)));
    gl.renderOrder = 19; G.flow.add(gl);
    const mh = new THREE.MeshBasicMaterial(Object.assign({ color, opacity: 0.95 }, th)), mt = new THREE.MeshBasicMaterial(Object.assign({ color, opacity: 0.4 }, th));
    for (let k = 0; k < n; k++) { const g = new THREE.Group(); const a = new THREE.Mesh(dartG, mh), b = new THREE.Mesh(tailG, mt); a.renderOrder = b.renderOrder = 20; g.add(a, b); G.flow.add(g); tracers.push({ g, gl, v, seg, tot, len: sum, t: (k / n) * sum, speed, base: scale, water }); }
  }
  path(SUP, 0x9fd0ff, 7, 0.4, 1, true);
  path(RET, 0xffffff, 8, 0.4, 1, true);
  const OA = 0xd9a06a, SA = 0x5fb8e8;
  [[0.3, 0.3], [-0.3, -0.3]].forEach(([dy, dz]) => path([[-6.2, YB + H / 2 + dy, dz], [CX - 0.15, YB + H / 2 + dy, dz]], OA, 6, 0.8, 2.4));
  path([[CX + 0.15, YB + H / 2, 0], [FX - 0.2, FY - 0.1, 0.1], [X1, OY, 0], [6.0, OY, 0]], SA, 9, 0.8, 2.4);
  path([[X1, OY + 0.15, 0.2], [6.0, OY + 0.15, 0.2]], SA, 4, 0.8, 2.4);

  // floating callouts
  const labels = [];
  function callout(el, anchor) { labels.push({ el: document.getElementById(el), p: new THREE.Vector3(...anchor) }); }
  callout('c-lat', [XC + 0.08, YB + H * 0.62, ZF - 0.05]);
  callout('c-cv', [CVX, PY2 + 0.34, PZ - 0.35]);
  callout('c-pa', [PSX, OY + OH / 2 + 0.14, 0]);
  callout('c-vsd', [MX, MY, MZ + 0.15]);
  callout('c-flt', [(X0 + XF) / 2, YB + 0.2, ZF]);

  const $ = (id) => document.getElementById(id);
  function paint() {
    const on = S.run;
    $('st-on').classList.toggle('lit', on); $('st-off').classList.toggle('lit', !on);
    $('btn-run').classList.toggle('active', on); $('btn-stop').classList.toggle('active', !on);
    $('btn-auto').classList.toggle('active', S.auto); $('btn-hand').classList.toggle('active', !S.auto);
    $('sel').textContent = S.auto ? 'IN AUTO' : 'NOT IN AUTO'; $('sel').className = 'sel ' + (S.auto ? 'ok' : 'warn');
    $('v-lat').textContent = (on ? S.lat : 0).toFixed(1) + ' °C'; $('v-latsp').textContent = 'Set ' + S.latSp.toFixed(1) + ' °C';
    $('v-cv').textContent = (on ? S.valve : 0) + ' %';
    $('v-pa').textContent = (on ? S.pa : 0).toFixed(0) + ' Pa'; $('v-pasp').textContent = 'Set ' + S.paSp + ' Pa';
    $('v-vsd').textContent = (on ? S.vsd : 0) + ' %'; $('v-hz').textContent = (on ? S.vsd * 0.5 : 0).toFixed(1) + ' Hz'; $('v-fault').textContent = S.fault;
    $('v-flt').textContent = S.filter;
    $('stat').textContent = on ? 'RUNNING' : 'STOPPED'; $('stat').className = 'stat ' + (on ? 'on' : 'off');
    vsdLed.material.color.set(on ? 0x3fd977 : 0x8a9990); cvLed.material.color.set(on ? 0x3fd977 : 0x8a9990);
    document.querySelectorAll('[data-casing]').forEach((b) => b.classList.toggle('active', b.dataset.casing === S.casing));
  }
  function setCasing(m) { S.casing = m; front.forEach((p) => (p.visible = m === 'closed')); handles.forEach((h) => (h.visible = m === 'closed')); paint(); }
  $('btn-run').onclick = () => { S.run = true; paint(); };
  $('btn-stop').onclick = () => { S.run = false; paint(); };
  $('btn-auto').onclick = () => { S.auto = true; paint(); };
  $('btn-hand').onclick = () => { S.auto = false; paint(); };
  document.querySelectorAll('[data-casing]').forEach((b) => (b.onclick = () => setCasing(b.dataset.casing)));
  const views = { iso: [3.2, 4.6, 13.5], front: [0, 0.5, 14.5], air: [-10, 2.6, 7], top: [0.2, 14, 3] };
  let fly = null;
  Object.keys(views).forEach((k) => { const b = $('v-' + k); if (b) b.onclick = () => { fly = new THREE.Vector3(...views[k]); document.querySelectorAll('.vb').forEach((q) => q.classList.toggle('active', q === b)); }; });
  camera.position.set(...views.iso);
  window.OAU = { S, paint, setCasing };

  function resize() { const r = stage.getBoundingClientRect(); renderer.setSize(r.width, r.height); camera.aspect = r.width / r.height; camera.fov = r.width / r.height < 1.5 ? 44 : 34; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();

  const clock = new THREE.Clock(), _v = new THREE.Vector3();
  (function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, clock.getDelta());
    if (fly) { camera.position.lerp(fly, 0.08); if (camera.position.distanceTo(fly) < 0.02) fly = null; }
    const k = S.run ? S.vsd / 100 : 0;
    const w = dt * 2 * Math.PI * 1.9 * k;
    wheel.rotation.z -= w; fanPul.rotation.z -= w; motPul.rotation.z -= w * 2.4;
    tracers.forEach((p) => {
      p.g.visible = p.gl.visible = S.run; if (!S.run) return;
      p.t = (p.t + dt * p.speed * (p.water ? Math.max(0.3, S.valve / 100) : k)) % p.len;
      let i = 0; while (i < p.tot.length - 1 && p.t > p.tot[i]) i++;
      const before = i ? p.tot[i - 1] : 0, f = p.seg[i] ? (p.t - before) / p.seg[i] : 0;
      p.g.position.lerpVectors(p.v[i], p.v[i + 1], f); p.g.lookAt(p.v[i + 1]);
      p.g.scale.setScalar(p.base * Math.min(1, Math.min(p.t - before, p.tot[i] - p.t) / 0.08));
    });
    ctl.update(); renderer.render(scene, camera);
    const r = stage.getBoundingClientRect();
    labels.forEach((l) => { _v.copy(l.p).project(camera); const x = (_v.x * 0.5 + 0.5) * r.width, y = (-_v.y * 0.5 + 0.5) * r.height; l.el.style.transform = `translate(${x}px,${y}px)`; l.el.style.display = _v.z < 1 ? '' : 'none'; });
  })();
  setCasing('open');
})();
