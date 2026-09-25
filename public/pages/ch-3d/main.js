// Trane Series R helical-rotary (RTHD) water-cooled screw chiller
// Built from site photos 1082293–1082296: insulated evaporator low, bare cream
// condenser above, screw compressor with twin vertical oil separators at the
// drive end, and a two-door cream starter panel spanning the service side.
(function () {
  const $ = (id) => document.getElementById(id);
  const host = $('stage');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101820);
  scene.fog = new THREE.Fog(0x101820, 16, 34);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  camera.position.set(-4.6, 2.6, 7.3);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  host.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  /* review hook: lets the comment panel read the camera, pick 3D points and take snapshots */
  window.__review = { THREE: THREE, scene: scene, camera: camera, renderer: renderer, controls: controls };

  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.target.set(0.55, 1.35, 0);
  controls.minDistance = 3; controls.maxDistance = 24;
  controls.maxPolarAngle = Math.PI * 0.52;

  // legacy (r128) light units — small numbers on purpose
  scene.add(new THREE.HemisphereLight(0xc8d8e4, 0x24282c, 0.34));
  const key = new THREE.DirectionalLight(0xfff4e2, 0.78);
  key.position.set(6, 8.5, 5.5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 30 });
  key.shadow.bias = -0.0012; scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fc4dd, 0.3); fill.position.set(-7, 4, -4); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.26); rim.position.set(-2, 5, -8); scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.14));

  const C = {
    cream: 0xd4cdab, creamLit: 0xe4ddb9, creamDark: 0x9b9578, creamWorn: 0xb9b294,
    insul: 0x1d1e21, insulLit: 0x2a2b2f, insulSeam: 0x141517,
    base: 0x15130f, baseEdge: 0x241f1b,
    steel: 0x9aa1a8, steelDark: 0x454b51, bolt: 0x8d7a5c,
    chws: 0x7fa8dc, chwr: 0x3f4c86, cdw: 0xe2a81e, cdwOrange: 0xd9691f,
    flangeBlue: 0x2f52a8, spring: 0xa9b0b6,
    screen: 0x16222c, traneRed: 0xcb352a, green: 0x2f6b3f, white: 0xeeece3,
    brass: 0xb08a3c, conduit: 0x9aa1a6, floor: 0x4d5459, pad: 0x9c9685,
  };
  const mat = (c, m, r, x) => new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: m, roughness: r }, x || {}));
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cylX = (r1, r2, l, s = 36) => { const g = new THREE.CylinderGeometry(r1, r2, l, s); g.rotateZ(Math.PI / 2); return g; };

  const G = {};
  ['evap', 'cond', 'comp', 'panel', 'base', 'pipes', 'flow', 'room'].forEach((k) => { G[k] = new THREE.Group(); G[k].name = k; scene.add(G[k]); });
  const add = (g, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz);
    o.castShadow = true; o.receiveShadow = true; g.add(o); return o;
  };

  // RTHD is a compact machine — shorter and lower than the CenTraVac
  const L = 2.95;
  const EV_R = 0.52, EV_Y = 0.64;
  const CD_R = 0.42, CD_Y = 1.58;

  (function room() {
    const f = add(G.room, box(24, 0.2, 18), mat(C.floor, 0, 0.96), 0, -0.2, 0); f.castShadow = false;
    add(G.room, box(L + 1.6, 0.16, 2.2), mat(C.pad, 0, 0.95), 0.1, -0.02, 0);
    add(G.room, box(L + 1.7, 0.03, 2.3), mat(0xa09a8a, 0.05, 0.9), 0.1, -0.11, 0);
  })();

  // ── EVAPORATOR — black insulated shell with rounded insulated end caps ──
  (function evaporator() {
    const ins = mat(C.insul, 0.02, 0.95), insL = mat(C.insulLit, 0.03, 0.9), seam = mat(C.insulSeam, 0.02, 0.88);
    add(G.evap, cylX(EV_R, EV_R, L, 48), ins, 0, EV_Y, 0);
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(EV_R + 0.008, 0.015, 8, 40), seam);
      t.rotation.y = Math.PI / 2; t.position.set(-L / 2 + 0.4 + i * 0.72, EV_Y, 0);
      t.castShadow = true; G.evap.add(t);
    }
    // insulated dished waterbox heads, as moulded on site
    [-1, 1].forEach((s) => {
      const hx = s * (L / 2);
      const d = new THREE.Mesh(new THREE.SphereGeometry(EV_R, 36, 22, 0, Math.PI * 2, 0, Math.PI / 2), ins);
      d.rotation.z = -s * Math.PI / 2; d.position.set(hx, EV_Y, 0); d.scale.set(1, 0.68, 1);
      d.castShadow = true; d.receiveShadow = true; G.evap.add(d);
      add(G.evap, cylX(EV_R + 0.02, EV_R + 0.02, 0.05, 40), insL, hx, EV_Y, 0);
      add(G.evap, cylX(0.2, 0.2, 0.1, 24), insL, hx + s * 0.34, EV_Y, 0);
    });
  })();

  // ── CONDENSER — bare cream shell, bolted dished head, relief valve ──
  (function condenser() {
    const cr = mat(C.cream, 0.16, 0.56), crD = mat(C.creamDark, 0.16, 0.6), crW = mat(C.creamWorn, 0.16, 0.6);
    add(G.cond, cylX(CD_R, CD_R, L - 0.2, 48), cr, 0.06, CD_Y, 0);
    for (let i = 0; i < 3; i++) add(G.cond, cylX(CD_R + 0.01, CD_R + 0.01, 0.03, 44), crW, -0.8 + i * 0.85, CD_Y, 0);

    [-1, 1].forEach((s) => {
      const fx = s * (L / 2 - 0.1);
      add(G.cond, cylX(CD_R + 0.07, CD_R + 0.07, 0.07, 44), crW, fx + 0.06, CD_Y, 0);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(CD_R + 0.05, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2), cr);
      dome.rotation.z = -s * Math.PI / 2; dome.position.set(fx + 0.06 + s * 0.05, CD_Y, 0);
      dome.scale.set(1, 0.74, 1); dome.castShadow = true; dome.receiveShadow = true; G.cond.add(dome);
      for (let b = 0; b < 24; b++) {
        const a = (b / 24) * Math.PI * 2;
        add(G.cond, cylX(0.02, 0.02, 0.085, 8), mat(C.bolt, 0.35, 0.55), fx + 0.06 + s * 0.03,
          CD_Y + Math.cos(a) * (CD_R + 0.05), Math.sin(a) * (CD_R + 0.05));
      }
    });

    // brass pressure-relief valve assembly on the crown (photo 1082293)
    add(G.cond, new THREE.CylinderGeometry(0.05, 0.05, 0.14, 18), mat(C.brass, 0.45, 0.42), -0.32, CD_Y + CD_R + 0.07, 0.12);
    add(G.cond, new THREE.CylinderGeometry(0.055, 0.055, 0.09, 18), mat(C.traneRed, 0.15, 0.5), -0.32, CD_Y + CD_R + 0.18, 0.12);
    add(G.cond, new THREE.CylinderGeometry(0.022, 0.022, 0.34, 12), mat(C.steel, 0.5, 0.42), -0.32, CD_Y + CD_R + 0.34, 0.12, 0, 0, 0.5);

    // sight glass + service valves along the shell
    [[-0.95, 0.22], [0.6, -0.2]].forEach(([x, dz]) =>
      add(G.cond, new THREE.CylinderGeometry(0.035, 0.035, 0.1, 14), mat(C.steel, 0.5, 0.4), x, CD_Y + CD_R + 0.04, dz));

    // decals: LIFT plate, green refrigerant label, data plate
    add(G.cond, box(0.2, 0.07, 0.008), mat(C.white, 0.05, 0.6), -0.75, CD_Y + 0.24, CD_R + 0.004);
    add(G.cond, box(0.24, 0.18, 0.008), mat(C.green, 0.05, 0.6), 0.72, CD_Y + 0.04, CD_R + 0.004);
    add(G.cond, box(0.3, 0.2, 0.008), mat(C.white, 0.05, 0.62), 0.34, CD_Y + 0.02, CD_R + 0.004);
  })();

  // ── SCREW COMPRESSOR + TWIN OIL SEPARATORS — drive end ──────────────
  let motorMesh = null, sepA = null, fanHub = null, spinMark = null, markHub = null;
  const compTracers = [], compGuides = [];
  let rotorCase = null, rotorBoreA = null, rotorBoreB = null;
  let rotorM = null, rotorF = null, rotorMats = [], rotorPorts = [];
  let hmiMat = null, beaconMat = null, ledRun = null, ledAlm = null, dischargeMats = [];
  (function compressor() {
    const cr = mat(C.cream, 0.16, 0.55), crD = mat(C.creamDark, 0.16, 0.6), crW = mat(C.creamWorn, 0.16, 0.6);
    const CX = 1.12, CY = CD_Y + CD_R + 0.32;

    // rotor housing + bolted motor barrel (photo 1082295)
    rotorCase = add(G.comp, cylX(0.26, 0.26, 0.52, 36), cr.clone(), CX - 0.28, CY, 0);
    // the twin bores read as a figure-8 once the crown is cut away
    rotorBoreA = add(G.comp, cylX(0.135, 0.135, 0.505, 30), crD.clone(), CX - 0.28, CY, 0.088);
    rotorBoreB = add(G.comp, cylX(0.12, 0.12, 0.505, 30), crD.clone(), CX - 0.28, CY, -0.09);
    add(G.comp, cylX(0.3, 0.3, 0.07, 36), crD, CX + 0.02, CY, 0);
    motorMesh = add(G.comp, cylX(0.31, 0.31, 0.62, 38), cr, CX + 0.38, CY, 0);
    add(G.comp, cylX(0.34, 0.34, 0.05, 40), crD, CX + 0.7, CY, 0);
    for (let b = 0; b < 26; b++) {
      const a = (b / 26) * Math.PI * 2;
      add(G.comp, cylX(0.018, 0.018, 0.07, 8), mat(C.bolt, 0.35, 0.55), CX + 0.71,
        CY + Math.cos(a) * 0.31, Math.sin(a) * 0.31);
    }
    add(G.comp, box(0.22, 0.16, 0.18), crD, CX + 0.38, CY + 0.34, 0);
    // fan-end guard with spokes — this is what makes the spin readable
    fanHub = new THREE.Group(); fanHub.position.set(CX + 0.74, CY, 0); G.comp.add(fanHub);
    bladeMat = mat(0x2fd46a, 0.3, 0.42, { emissive: 0x2fd46a, emissiveIntensity: 1.0 });
    for (let b = 0; b < 8; b++) {
      const a = (b / 8) * Math.PI * 2;
      const bl = new THREE.Mesh(box(0.02, 0.2, 0.055), bladeMat);
      bl.position.set(0, Math.cos(a) * 0.15, Math.sin(a) * 0.15);
      bl.rotation.x = -a + 0.5; bl.castShadow = true; fanHub.add(bl);
    }
    add(G.comp, cylX(0.035, 0.035, 0.1, 14), mat(C.steel, 0.6, 0.35), CX + 0.74, CY, 0);
    guardMat = mat(0x2fd46a, 0.35, 0.4, { emissive: 0x2fd46a, emissiveIntensity: 0.85 });
    add(G.comp, new THREE.TorusGeometry(0.22, 0.018, 8, 30), guardMat, CX + 0.78, CY, 0, 0, Math.PI / 2, 0);
    // motion-blur disc: only visible at speed, sells the spin at a glance
    spinDisc = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32),
      new THREE.MeshBasicMaterial({ color: 0x49e08a, transparent: true, opacity: 0, side: THREE.DoubleSide }));
    spinDisc.position.set(CX + 0.755, CY, 0); spinDisc.rotation.y = Math.PI / 2; G.comp.add(spinDisc);
    // painted alignment stripe — rides on a hub centred on the motor axis so it
    // orbits the barrel instead of flapping about its own centre
    markHub = new THREE.Group(); markHub.position.set(CX + 0.38, CY, 0); G.comp.add(markHub);
    spinMarkMat = mat(0x2fd46a, 0.2, 0.45, { emissive: 0x2fd46a, emissiveIntensity: 0.75 });
    spinMark = new THREE.Mesh(box(0.46, 0.018, 0.14), spinMarkMat);
    spinMark.position.set(0, 0.316, 0); spinMark.castShadow = true; markHub.add(spinMark);
    // ── SCREW ROTORS: male 4-lobe driving female 6-lobe, cut into the housing.
    // Lobe profile is swept along the axis with a progressive twist, so the
    // helix is one continuous casting rather than stacked slices.
    function rotorGeo(lobes, R, A, len, twist, segA = 60, segL = 54) {
      const pos = [], idx = [];
      for (let i = 0; i <= segL; i++) {
        const t = i / segL, x = (t - 0.5) * len, phase = twist * t;
        for (let j = 0; j < segA; j++) {
          const u = (j / segA) * Math.PI * 2;
          const r = R + A * Math.cos(lobes * u);
          const a = u + phase;
          pos.push(x, Math.cos(a) * r, Math.sin(a) * r);
        }
      }
      for (let i = 0; i < segL; i++) for (let j = 0; j < segA; j++) {
        const a = i * segA + j, b = i * segA + (j + 1) % segA;
        const c = b + segA, d = a + segA;
        idx.push(a, b, c, a, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    }
    const rotorLen = 0.5;
    const mkRotor = (lobes, R, A, twist, z, hue) => {
      const m = mat(hue, 0.55, 0.3, { emissive: 0x1d9b4c, emissiveIntensity: 0.5 });
      rotorMats.push(m);
      const grp = new THREE.Group();
      grp.position.set(CX - 0.28, CY, z);
      const bl = new THREE.Mesh(rotorGeo(lobes, R, A, rotorLen, twist), m);
      bl.castShadow = true; grp.add(bl);
      // shaft stubs and journal bearings at both ends
      const sh = mat(C.steel, 0.65, 0.32);
      add(grp, cylX(0.022, 0.022, rotorLen + 0.16, 14), sh, 0, 0, 0);
      [-1, 1].forEach((sg) => add(grp, cylX(0.042, 0.042, 0.05, 16), mat(C.bolt, 0.4, 0.5), sg * (rotorLen / 2 + 0.04), 0, 0));
      G.comp.add(grp);
      return grp;
    };
    // ports: low-pressure gas in at one end, compressed gas out at the other
    [[-1, 0x4a9ad0, 0x2c6f9e], [1, 0xd06a3a, 0x9c4620]].forEach(([sg, hue, rim]) => {
      const pz = sg > 0 ? -0.09 : 0.088;
      const px = CX - 0.28 + sg * 0.2;
      // throat: an angled duct standing out of the bore wall, so it reads from
      // the rotor view instead of collapsing to a sliver like a flat plane did
      const pm = mat(hue, 0.3, 0.42, { emissive: hue, emissiveIntensity: 0.4, transparent: true, opacity: 0.85 });
      rotorPorts.push(pm);
      const th = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.07, 0.17, 20, 1, true), pm);
      th.rotation.set(0, 0, sg * 0.42);
      th.position.set(px, CY + 0.13, pz);
      th.castShadow = true; G.comp.add(th);
      // flanged mouth + gas-side stub, both in the port colour family
      add(G.comp, new THREE.CylinderGeometry(0.076, 0.076, 0.022, 22), mat(rim, 0.45, 0.45),
        px + sg * 0.087, CY + 0.208, pz, 0, 0, sg * 0.42);
      add(G.comp, new THREE.TorusGeometry(0.058, 0.009, 8, 22), mat(rim, 0.5, 0.42),
        px - sg * 0.033, CY + 0.052, pz, Math.PI / 2, 0, sg * 0.42);
    });

    rotorM = mkRotor(4, 0.086, 0.034, Math.PI * 1.15, 0.088, 0x2fd46a);
    rotorF = mkRotor(6, 0.074, 0.026, -Math.PI * 0.78, -0.09, 0x27c05f);
    [rotorM, rotorF].forEach((r) => { r.visible = false; });

    // suction elbow up from the evaporator into the rotor housing
    const suc = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.16, 18, 30, Math.PI / 2), cr);
    suc.position.set(CX - 0.54, CY - 0.1, 0); suc.rotation.set(0, Math.PI / 2, Math.PI);
    suc.castShadow = true; G.comp.add(suc);
    add(G.comp, new THREE.CylinderGeometry(0.16, 0.16, 0.5, 28), cr, CX - 0.88, CD_Y + CD_R - 0.02, 0);
    // legs down onto the condenser crown
    [[-0.3, 0.2], [-0.3, -0.2], [0.4, 0.2], [0.4, -0.2]].forEach(([dx, dz]) =>
      add(G.comp, box(0.07, 0.3, 0.07), crD, CX + dx, CD_Y + CD_R + 0.08, dz));

    // twin vertical oil separators standing beside the compressor (photo 1082293)
    [[-0.1, 0.3], [-0.1, -0.3]].forEach(([dx, dz], i) => {
      const sx = CX + dx - 0.55, sy = CD_Y + CD_R + 0.62;
      const b = add(G.comp, new THREE.CylinderGeometry(0.17, 0.17, 1.02, 28), cr, sx, sy, dz);
      if (i === 0) sepA = b;
      add(G.comp, new THREE.SphereGeometry(0.17, 26, 14, 0, Math.PI * 2, 0, Math.PI / 2), cr, sx, sy + 0.51, dz);
      add(G.comp, new THREE.SphereGeometry(0.17, 26, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), cr, sx, sy - 0.51, dz);
      add(G.comp, new THREE.CylinderGeometry(0.19, 0.19, 0.05, 30), crW, sx, sy + 0.2, dz);
      add(G.comp, new THREE.CylinderGeometry(0.19, 0.19, 0.05, 30), crW, sx, sy - 0.24, dz);
      // oil drain line down to the compressor
      add(G.comp, new THREE.CylinderGeometry(0.026, 0.026, 0.5, 12), crW, sx, sy - 0.86, dz);
    });
    // gooseneck discharge loop from the compressor over to the separators
    const hotMat = mat(C.cream, 0.16, 0.55, { emissive: 0x000000, emissiveIntensity: 0 });
    dischargeMats.push(hotMat);
    const goose = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.115, 16, 28, Math.PI), hotMat);
    goose.position.set(CX - 0.72, CD_Y + CD_R + 1.16, 0.3);
    goose.rotation.set(0, Math.PI / 2, 0); goose.castShadow = true; G.comp.add(goose);
    add(G.comp, new THREE.CylinderGeometry(0.115, 0.115, 0.4, 24), hotMat, CX - 1.02, CD_Y + CD_R + 0.96, 0.3);
    add(G.comp, cylX(0.115, 0.115, 0.62, 24), hotMat, CX - 0.72, CD_Y + CD_R + 1.16, -0.0, 0, 0, 0);

    // oil filter canister + service valves slung off the housing
    add(G.comp, new THREE.CylinderGeometry(0.075, 0.075, 0.3, 20), crW, CX - 0.62, CD_Y - 0.1, 0.44, 0, 0, Math.PI / 2);
    add(G.comp, box(0.16, 0.14, 0.14), mat(C.insulLit, 0.1, 0.7), CX - 0.2, CD_Y - 0.26, 0.42);
  })();

  // ── STARTER / CONTROL PANEL — two-door cream cabinet on the service side
  (function panel() {
    const px = 0.15, py = CD_Y - 0.18, pz = EV_R + 0.62;
    const body = mat(C.creamLit, 0.16, 0.52), door = mat(C.cream, 0.16, 0.56), dk = mat(C.creamDark, 0.16, 0.6);
    add(G.panel, box(1.86, 1.12, 0.46), body, px, py, pz);
    [-0.47, 0.47].forEach((dx) => {
      add(G.panel, box(0.86, 1.02, 0.02), door, px + dx, py, pz + 0.24);
      add(G.panel, box(0.02, 1.02, 0.03), dk, px + dx + 0.44, py, pz + 0.25);
      // louvre vents
      for (let i = 0; i < 4; i++) add(G.panel, box(0.16, 0.016, 0.01), dk, px + dx - 0.3, py + 0.38 - i * 0.06, pz + 0.255);
    });
    // red disconnect handle on the left door
    add(G.panel, box(0.11, 0.11, 0.05), mat(C.steelDark, 0.4, 0.5), px - 0.62, py + 0.16, pz + 0.26);
    add(G.panel, box(0.05, 0.17, 0.04), mat(C.traneRed, 0.15, 0.45), px - 0.62, py + 0.22, pz + 0.29, 0, 0, 0.5);
    // Trane badge strip + HMI on the right door
    add(G.panel, box(0.44, 0.09, 0.01), mat(0x2a2a26, 0.1, 0.55), px + 0.5, py + 0.32, pz + 0.255);
    add(G.panel, box(0.1, 0.055, 0.008), mat(C.traneRed, 0.1, 0.45), px + 0.34, py + 0.32, pz + 0.262);
    add(G.panel, box(0.26, 0.2, 0.02), mat(0x2b3036, 0.4, 0.5), px + 0.48, py + 0.05, pz + 0.255);
    hmiMat = mat(C.screen, 0.1, 0.2, { emissive: 0x14374a, emissiveIntensity: 0.9 });
    add(G.panel, box(0.22, 0.16, 0.01), hmiMat, px + 0.48, py + 0.05, pz + 0.268);
    // stack beacon on top of the cabinet
    beaconMat = mat(0x2f9e54, 0.1, 0.35, { emissive: 0x2f9e54, emissiveIntensity: 1.1 });
    add(G.panel, new THREE.CylinderGeometry(0.055, 0.055, 0.12, 18), beaconMat, px + 0.8, py + 0.64, pz - 0.02);
    add(G.panel, new THREE.CylinderGeometry(0.06, 0.06, 0.04, 18), mat(C.steelDark, 0.4, 0.5), px + 0.8, py + 0.56, pz - 0.02);
    // RUN / ALARM pilot lights beside the HMI
    ledRun = mat(0x2f9e54, 0.1, 0.3, { emissive: 0x2f9e54, emissiveIntensity: 1.2 });
    ledAlm = mat(0x5a3020, 0.1, 0.4, { emissive: 0x000000, emissiveIntensity: 0 });
    add(G.panel, new THREE.CylinderGeometry(0.026, 0.026, 0.02, 16), ledRun, px + 0.48, py - 0.09, pz + 0.262, Math.PI / 2, 0, 0);
    add(G.panel, new THREE.CylinderGeometry(0.026, 0.026, 0.02, 16), ledAlm, px + 0.62, py - 0.09, pz + 0.262, Math.PI / 2, 0, 0);
    add(G.panel, box(0.22, 0.16, 0.008), mat(C.white, 0.05, 0.62), px + 0.46, py - 0.28, pz + 0.255);
    add(G.panel, box(0.14, 0.1, 0.008), mat(C.green, 0.05, 0.6), px - 0.78, py - 0.1, pz + 0.255);
    // conduit riser to the ceiling tray
    add(G.panel, new THREE.CylinderGeometry(0.026, 0.026, 1.5, 12), mat(C.conduit, 0.4, 0.5), px + 0.9, py + 1.2, pz - 0.1);
    const bend = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.026, 10, 20, Math.PI / 2), mat(C.conduit, 0.4, 0.5));
    bend.position.set(px + 0.9, py + 0.6, pz + 0.06); bend.rotation.set(Math.PI / 2, 0, 0); G.panel.add(bend);
    // cabinet support brackets down to the base
    [-0.7, 0.7].forEach((dx) => add(G.panel, box(0.1, 0.5, 0.3), mat(C.insul, 0.2, 0.8), px + dx, py - 0.8, pz - 0.06));
  })();

  // ── BASE — fabricated black steel frame with bolted feet ────────────
  (function base() {
    const st = mat(C.base, 0.2, 0.82), stE = mat(C.baseEdge, 0.22, 0.78);
    [-0.62, 0.62].forEach((z) => add(G.base, box(L + 0.5, 0.16, 0.14), st, 0.05, 0.18, z));
    [-1.2, 1.25].forEach((x) => {
      add(G.base, box(0.2, 0.5, 1.36), st, x, 0.35, 0);
      add(G.base, box(0.26, 0.06, 1.44), stE, x, 0.58, 0);
      // splayed foot plates
      [-0.58, 0.58].forEach((z) => {
        add(G.base, box(0.42, 0.06, 0.3), stE, x, 0.05, z);
        add(G.base, box(0.16, 0.12, 0.2), st, x, 0.13, z);
      });
    });
    add(G.base, box(L + 0.4, 0.1, 1.2), st, 0.05, 0.1, 0);
  })();

  // ── PIPEWORK ────────────────────────────────────────────────────────
  // roundedPath(): corner points replaced by quadratic-bezier arcs
  function roundedPath(pts, r) {
    const v = pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const out = [v[0].clone()];
    for (let i = 1; i < v.length - 1; i++) {
      const a = v[i - 1], b = v[i], c = v[i + 1];
      const d1 = new THREE.Vector3().subVectors(a, b), d2 = new THREE.Vector3().subVectors(c, b);
      const rr = Math.min(r, d1.length() * 0.46, d2.length() * 0.46);
      d1.normalize(); d2.normalize();
      const p1 = b.clone().addScaledVector(d1, rr);
      const p2 = b.clone().addScaledVector(d2, rr);
      out.push(p1);
      for (let k = 1; k < 12; k++) {
        const t = k / 12;
        out.push(new THREE.Vector3()
          .addScaledVector(p1, (1 - t) * (1 - t))
          .addScaledVector(b, 2 * (1 - t) * t)
          .addScaledVector(p2, t * t));
      }
      out.push(p2);
    }
    out.push(v[v.length - 1].clone());
    return out;
  }
  // one unbroken tube + the exact centreline the tracers ride
  function pipeRun(g, pts, radius, material, bendR) {
    const p = roundedPath(pts, bendR || radius * 1.6);
    const curve = new THREE.CatmullRomCurve3(p, false, 'catmullrom', 0);
    const geo = new THREE.TubeGeometry(curve, Math.max(48, p.length * 2), radius, 22, false);
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true; m.receiveShadow = true; g.add(m);
    return p.map((q) => [q.x, q.y, q.z]);
  }

  const PATH = { chw: [], cdw: [] };
  (function pipework() {
    const blueM = mat(C.chws, 0.12, 0.6), navyM = mat(C.chwr, 0.1, 0.66);
    const cdwM = mat(C.cdw, 0.12, 0.58), orgM = mat(C.cdwOrange, 0.12, 0.6);
    const flM = mat(C.flangeBlue, 0.25, 0.55), stM = mat(C.steel, 0.45, 0.42);

    // CHW at the evaporator — one continuous tube per main, floor → shell
    [[0.26, blueM], [-0.26, navyM]].forEach(([dz, m]) => {
      const R = 0.2, xF = L / 2 + 0.36, xE = xF + 0.9;
      PATH.chw.push(pipeRun(G.pipes, [
        [xE + 0.34, 0.14, dz], [xE + 0.34, EV_Y, dz], [xF - 0.16, EV_Y, dz],
      ], R, m, 0.34));
      add(G.pipes, cylX(R + 0.045, R + 0.045, 0.07, 30), flM, xF - 0.1, EV_Y, dz);
      [0.3, 0.56].forEach((dx) => add(G.pipes, cylX(R + 0.022, R + 0.022, 0.05, 30), m, xF + dx, EV_Y, dz));
      add(G.pipes, new THREE.CylinderGeometry(0.032, 0.032, 0.3, 12), stM, xE + 0.34, 0.15, dz + R + 0.13);
      add(G.pipes, box(0.16, 0.02, 0.16), mat(C.steelDark, 0.4, 0.5), xE + 0.34, 0.01, dz + R + 0.13);
    });

    // CDW at the condenser — continuous tube, shell → ceiling
    [[0.24, cdwM], [-0.24, orgM]].forEach(([dz, m]) => {
      const R = 0.17, xF = -(L / 2 + 0.24), topY = CD_Y + 1.55;
      PATH.cdw.push(pipeRun(G.pipes, [
        [xF - 0.96, topY, dz], [xF - 0.96, CD_Y, dz], [xF + 0.16, CD_Y, dz],
      ], R, m, 0.3));
      add(G.pipes, cylX(R + 0.04, R + 0.04, 0.07, 30), flM, xF + 0.06, CD_Y, dz);
      add(G.pipes, box(0.05, 0.3, 0.05), stM, xF - 0.96, topY - 0.12, dz + 0.24);
    });
  })();

  // ── shell-side refrigerant: boiling in the evaporator, condensing above ──
  const boilFields = [];

  (function shellBoil() {
    const sprite = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(120,255,150,1)');
      g.addColorStop(0.28, 'rgba(34,214,92,1)');
      g.addColorStop(0.62, 'rgba(18,150,62,0.9)');
      g.addColorStop(1, 'rgba(10,110,44,0)');
      x.fillStyle = g; x.beginPath(); x.arc(32, 32, 32, 0, Math.PI * 2); x.fill();
      return new THREE.CanvasTexture(c);
    })();

    function field(y0, R, count, dir, size) {
      const pos = new Float32Array(count * 3);
      const seed = [];
      for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * (L - 0.45);
        // spread across the barrel width; the chord limits how high it can go
        const z = (Math.random() * 2 - 1) * R * 0.88;
        seed.push({ x, z, ph: Math.random(), sp: 0.55 + Math.random() * 0.85, w: Math.random() * 6.283 });
        pos[i * 3] = x; pos[i * 3 + 1] = y0; pos[i * 3 + 2] = z;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({
        size, map: sprite, transparent: true, opacity: 0,
        depthTest: true, depthWrite: false, sizeAttenuation: true,
        color: 0x2fd46a,
      });
      const pts = new THREE.Points(geo, m);
      pts.renderOrder = 18;
      pts.visible = false;   // revealed with the ghost shells
      G.flow.add(pts);
      boilFields.push({ pts, geo, m, seed, y0, R, dir });
    }
    field(EV_Y, EV_R * 0.82, 210, 1, 0.1);     // evaporator — droplets rise
    field(CD_Y, CD_R * 0.8, 165, -1, 0.085);   // condenser — condensate falls
  })();

  // ── flow tracers ───────────────────────────────────────────────────
  const tracers = [], guides = [];
  (function flows() {
    const dart = new THREE.ConeGeometry(0.05, 0.16, 12); dart.rotateX(Math.PI / 2);
    const tail = new THREE.CylinderGeometry(0.015, 0.005, 0.15, 8); tail.rotateX(Math.PI / 2); tail.translate(0, 0, -0.11);
    const bead = new THREE.SphereGeometry(0.045, 12, 10);
    const thru = { depthTest: false, depthWrite: false, transparent: true };
    const M = {
      chwWarm: new THREE.MeshBasicMaterial(Object.assign({ color: 0x8fb9e8, opacity: 0.96 }, thru)),
      chwCold: new THREE.MeshBasicMaterial(Object.assign({ color: 0x4fd2f0, opacity: 0.96 }, thru)),
      cdwCool: new THREE.MeshBasicMaterial(Object.assign({ color: 0xf0c24a, opacity: 0.96 }, thru)),
      cdwHot: new THREE.MeshBasicMaterial(Object.assign({ color: 0xef7d3a, opacity: 0.96 }, thru)),
      refGas: new THREE.MeshBasicMaterial(Object.assign({ color: 0xc48ff0, opacity: 0.9 }, thru)),
      refLiq: new THREE.MeshBasicMaterial(Object.assign({ color: 0x7ee0b8, opacity: 0.9 }, thru)),
      oil: new THREE.MeshBasicMaterial(Object.assign({ color: 0xe8c05a, opacity: 0.9 }, thru)),
      soft: new THREE.MeshBasicMaterial(Object.assign({ color: 0x9fd8f5, opacity: 0.42 }, thru)),
    };
    G.flow.renderOrder = 20;
    // any route passing through this box sits over the rotor cutaway
    G.comp.updateMatrixWorld(true);
    const COMP_BOX = new THREE.Box3();
    [rotorCase, rotorBoreA, rotorBoreB].forEach((o) => { if (o) COMP_BOX.expandByObject(o); });
    if (COMP_BOX.isEmpty()) COMP_BOX.setFromObject(G.comp);
    COMP_BOX.expandByScalar(0.06);
    const segBox = new THREE.Box3();
    const crossesComp = (v) => {
      for (let i = 0; i < v.length - 1; i++) {
        segBox.makeEmpty().expandByPoint(v[i]).expandByPoint(v[i + 1]);
        if (COMP_BOX.intersectsBox(segBox)) return true;
      }
      return v.length === 1 && COMP_BOX.containsPoint(v[0]);
    };

    // faint tube along each route so the darts read as flow inside a path
    function guide(pts, hex) {
      const v = pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
      const curve = new THREE.CatmullRomCurve3(v, false, 'catmullrom', 0);
      const geo = new THREE.TubeGeometry(curve, Math.max(40, v.length * 2), 0.055, 14, false);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: hex, transparent: true, opacity: 0.2, depthTest: false, depthWrite: false }));
      m.renderOrder = 19; G.flow.add(m);
      m.visible = false;     // guide lines retired with the tracers
      guides.push(m.material);
      if (crossesComp(v)) compGuides.push(m);
      return m;
    }

    function makePath(pts, n, matr, speed, shape) {
      const v = pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
      const seg = [], tot = []; let total = 0;
      for (let i = 0; i < v.length - 1; i++) { const d = v[i].distanceTo(v[i + 1]); seg.push(d); total += d; tot.push(total); }
      for (let k = 0; k < n; k++) {
        let m;
        if (shape === 'bead') m = new THREE.Mesh(bead, matr);
        else { m = new THREE.Group(); m.add(new THREE.Mesh(dart, matr)); m.add(new THREE.Mesh(tail, M.soft)); }
        m.renderOrder = 20; G.flow.add(m);
        const rec = { m, v, seg, tot, total, t: (k / n) * total, speed, aim: shape !== 'bead' };
        rec.inComp = crossesComp(v);
        tracers.push(rec);
        if (rec.inComp) compTracers.push(rec);
      }
    }

    const chwOut = PATH.chw[0], chwIn = PATH.chw[1];   // both floor → shell
    makePath(chwIn, 6, M.chwWarm, 1.0);                          // CHWR in
    makePath(chwOut.slice().reverse(), 6, M.chwCold, 1.0);       // CHWS out
    const cdwIn = PATH.cdw[0], cdwOut = PATH.cdw[1];   // both ceiling → shell
    makePath(cdwIn, 6, M.cdwCool, 1.05);                         // CDWS in
    makePath(cdwOut.slice().reverse(), 6, M.cdwHot, 1.05);       // CDWR out
  })();

  // ── RUN STATUS RIG — green pool of light under the machine, green rim
  //    light, and a lit base band. Sized to be read across the room, not
  //    the pinhead beacon that was there before.
  let statusBand = [], statusRim = null;
  // NOT a layer group — run status must survive every layer toggle
  const statusGroup = new THREE.Group(); statusGroup.name = 'status'; scene.add(statusGroup);
  (function statusRig() {
    // status bar across the top of the starter panel — the largest flat
    // surface facing the operator, so this is what gets read first
    const pz = EV_R + 0.62;
    {
      const m = new THREE.MeshBasicMaterial({ color: 0x2fd46a, transparent: true, opacity: 0.95 });
      const b = new THREE.Mesh(box(1.8, 0.075, 0.02), m);
      // cabinet spans y 0.84–1.96; sit the bar on its upper front face
      b.position.set(0.15, CD_Y + 0.3425, pz + 0.25);
      statusGroup.add(b); statusBand.push(m);
    }
    // and a matching band down each side of the cabinet
    [-0.92, 0.92].forEach((dx) => {
      const m = new THREE.MeshBasicMaterial({ color: 0x2fd46a, transparent: true, opacity: 0.95 });
      const b = new THREE.Mesh(box(0.05, 1.06, 0.02), m);
      b.position.set(0.15 + dx, CD_Y - 0.18, pz + 0.25);
      statusGroup.add(b); statusBand.push(m);
    });
    // lit band along the base rails (reads from the side views)
    [-0.62, 0.62].forEach((z) => {
      const m = new THREE.MeshBasicMaterial({ color: 0x2fd46a, transparent: true, opacity: 0.9 });
      const b = new THREE.Mesh(box(L + 0.46, 0.045, 0.02), m);
      b.position.set(0.05, 0.265, z + (z > 0 ? 0.075 : -0.075));
      statusGroup.add(b); statusBand.push(m);
    });
    // green rim light that only lifts the machine when it runs
    statusRim = new THREE.DirectionalLight(0x49e08a, 0);
    statusRim.position.set(-3, 2.4, -4); scene.add(statusRim);
  })();

  // ── state + UI ─────────────────────────────────────────────────────
  // cap = capacity %, supplied by the station only; it scales the animation and
  // is never shown as a figure or edited in the UI
  const S = { run: true, cap: 100, chws: 7.0, chwr: 12.2, cdws: 30.4, cdwr: 35.4, kwrt: 0.58, spin: 0, glow: 1 };
  // LIVE.on = true once the station pushes values; the demo drift stops then.
  const LIVE = { on: false, run: null, capacity: null, chws: null, chwr: null, cdws: null, cdwr: null, kwrt: null, alarm: null };
  const setTxt = (id, v) => { const e = $(id); if (e) e.textContent = v; };

  function paint() {
    setTxt('r-chws', S.chws.toFixed(1)); setTxt('r-chwr', S.chwr.toFixed(1));
    setTxt('r-cdws', S.cdws.toFixed(1)); setTxt('r-cdwr', S.cdwr.toFixed(1));
    setTxt('r-kwrt', S.kwrt.toFixed(2));
    const src = $('r-src');
    if (src) { src.textContent = LIVE.on ? 'LIVE · N4' : 'SIM'; src.className = 'src ' + (LIVE.on ? 'live' : 'sim'); }
    setTxt('r-dt', (S.chwr - S.chws).toFixed(1));
    const st = $('r-state');
    if (st) { st.textContent = S.run ? 'RUNNING' : 'STOPPED'; st.className = 'stt ' + (S.run ? 'on' : 'off'); }
    const led = $('led'); if (led) led.className = 'led ' + (S.run ? 'on' : 'off');
    $('btn-run').classList.toggle('active', S.run);
    $('btn-stop').classList.toggle('active', !S.run);
  }
  $('btn-run').onclick = () => { S.run = true; paint(); applyRunVisuals(); };
  $('btn-stop').onclick = () => { S.run = false; paint(); applyRunVisuals(); };


  document.querySelectorAll('[data-layer]').forEach((b) => b.addEventListener('click', () => {
    const g = G[b.dataset.layer]; if (!g) return;
    g.visible = !g.visible; b.classList.toggle('off', !g.visible);
  }));

  renderer.localClippingEnabled = true;
  // keeps z <= 0, so the near half of the rotor housing is cut away
  const rotorPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  let rotorCut = true;
  const rotorView = () => {
    const c = new THREE.Vector3(0.84, 2.0, 0);
    if (rotorCase) { scene.updateMatrixWorld(true); rotorCase.getWorldPosition(c); }
    // deliberately no camera move: the cut is the default state and the view
    // stays on the wide isometric so the whole machine is still readable
  };
  const setRotorCut = (on) => {
    rotorCut = !!on;
    // constant is set once the housing centre height is known
    rotorPlane.constant = rotorCase ? rotorCase.position.y + 0.02 : 0;
    [rotorCase, rotorBoreA, rotorBoreB].forEach((o) => {
      if (!o) return;
      o.material.clippingPlanes = rotorCut ? [rotorPlane] : null;
      o.material.side = rotorCut ? THREE.DoubleSide : THREE.FrontSide;
      o.material.needsUpdate = true;
    });
    rotorPorts.forEach((m) => { m.visible = rotorCut; });
    // fluid elsewhere keeps running; only the routes that would paint over the
    // exposed rotors step aside
    compTracers.forEach((p) => { p.m.visible = !rotorCut; });
    compGuides.forEach((m) => { m.visible = false; });
    [rotorM, rotorF].forEach((r) => { if (r) r.visible = rotorCut; });
    // the fabricated external fan has no place on a hermetic machine
    [fanHub, spinMark, markHub].forEach((o) => { if (o) o.visible = false; });
    if (spinDisc) spinDisc.visible = !rotorCut;
    const b = $('btn-rotor');
    if (b) b.classList.toggle('active', rotorCut);
    setTxt('rotor-note', rotorCut ? 'ผ่าเรือนโรเตอร์' : 'เรือนปิด');

  };
  if ($('btn-rotor')) $('btn-rotor').onclick = () => setRotorCut(!rotorCut);
  // cut is the shipped default: screw rotors visible and turning from startup
  rotorCut = false;

  const setTracerXray = (on) => {
    tracers.forEach((p) => p.m.traverse((o) => { if (o.material) o.material.depthTest = !on; }));
    guides.forEach((m) => { m.depthTest = !on; });
  };

  let ghost = false;
  const setGhost = (on) => {
    ghost = !!on;
    [G.evap, G.cond].forEach((g) => g.traverse((o) => {
      if (!o.isMesh) return;
      o.material.transparent = ghost; o.material.opacity = ghost ? 0.28 : 1;
      o.material.depthWrite = !ghost; o.material.needsUpdate = true;
    }));
    setTracerXray(ghost);
    boilFields.forEach((f) => { f.pts.visible = ghost; });
    $('btn-ghost').classList.toggle('active', ghost);
    setTxt('ghost-note', ghost ? 'มองทะลุเปลือก' : 'เปลือกทึบ');
  };
  $('btn-ghost').onclick = () => setGhost(!ghost);

  // one call keeps casing, rotors and refrigerant consistent with run state
  function applyRunVisuals() {
    setGhost(S.run);
    setRotorCut(S.run);
  }
  applyRunVisuals();

  // button id -> the name published on the API and accepted by setView()
  const VIEW_ALIAS = { 'v-panel': 'starter', 'v-comp': 'compressor' };
  const VIEWS = {
    'v-iso': [[-4.6, 2.6, 7.3], [0.55, 1.35, 0]],
    'v-panel': [[1.2, 1.9, 6.2], [0.3, 1.3, 0.4]],
    'v-comp': [[3.6, 3.0, 4.6], [1.0, 2.0, 0]],
    'v-side': [[0.9, 1.8, 8.8], [1.0, 1.1, 0]],
    'v-top': [[1.0, 9.4, 0.9], [1.0, 0.9, 0]],
    'v-rotor': [[-2.9, 3.35, 4.6], [0.84, 2.0, 0]],
  };
  let fly = null;
  Object.keys(VIEWS).forEach((id) => {
    const b = $(id); if (!b) return;
    b.onclick = () => {
      const [p, t] = VIEWS[id];
      fly = { p0: camera.position.clone(), t0: controls.target.clone(),
              p1: new THREE.Vector3(...p), t1: new THREE.Vector3(...t), k: 0 };
      document.querySelectorAll('.vb').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
    };
  });

  // ── PART CALLOUTS ───────────────────────────────────────────────────
  const tagHost = $('tags');
  // Each callout binds to one Niagara point. `pt` is the slot path the station
  // writes to via SilomChillerRTHD.setPoints({...}); `fmt` renders the value.
  const TAGS = [
    { id: 'oilSep', pt: 'OilSepPress', u: 'bar', d: 1, a: [0.47, CD_Y + CD_R + 0.62, 0.3], t: 'ถังแยกน้ำมัน', o: [-30, -128] },
    { id: 'comp', pt: 'CompRLA', u: '%RLA', d: 0, a: [1.12, CD_Y + CD_R + 0.32, 0], t: 'คอมเพรสเซอร์สกรู', o: [120, -96] },
    { id: 'cdwPipe', pt: 'CdwFlow', u: 'L/s', d: 0, a: [-2.6, CD_Y + 0.6, 0.24], alt: [[-2.28, CD_Y + 1.45, 0.24], [-1.9, CD_Y + 1.55, 0.24]], t: 'ท่อน้ำระบายความร้อน', o: [-30, -104] },
    { id: 'cond', pt: 'CondSatTemp', u: '°C', d: 1, a: [-0.4, CD_Y + 0.34, 0.4], t: 'Condenser', o: [-44, -44] },
    { id: 'evap', pt: 'EvapSatTemp', u: '°C', d: 1, a: [-1.2, EV_Y, 0.46], alt: [[-1.0, EV_Y + EV_R - 0.04, 0.3], [-0.2, EV_Y + EV_R - 0.04, 0.34]], t: 'Evaporator', o: [-34, 74] },
    { id: 'starter', pt: 'StarterAmps', u: 'A', d: 0, a: [0.15, CD_Y - 0.2, EV_R + 0.86], t: 'ตู้สตาร์ตเตอร์', o: [150, 30] },
    { id: 'chwPipe', pt: 'ChwFlow', u: 'L/s', d: 0, a: [2.5, EV_Y - 0.1, 0.26], alt: [[2.2, EV_Y + 0.18, 0.26]], t: 'ท่อน้ำเย็น', o: [58, 78] },
  ];
  TAGS.forEach((d) => {
    const line = document.createElement('div'); line.className = 'tagline';
    const el = document.createElement('div'); el.className = 'tag';
    el.innerHTML = '<i></i><span class="tn"></span><b class="tv"></b>';
    el.querySelector('.tn').textContent = d.t;
    tagHost.appendChild(line); tagHost.appendChild(el);
    d.el = el; d.line = line; d.val = el.querySelector('.tv');
    d.v = new THREE.Vector3(); d.value = null; d.fault = false;
  });
  function paintTagValues() {
    TAGS.forEach((d) => {
      if (d.value === null || d.value === undefined) { d.val.textContent = ''; d.el.classList.remove('has', 'flt'); return; }
      d.val.textContent = (typeof d.value === 'number' ? d.value.toFixed(d.d) : d.value) + (d.u ? ' ' + d.u : '');
      d.el.classList.add('has');
      d.el.classList.toggle('flt', !!d.fault);
    });
    // text changed → the cached half-size is stale and must be re-measured
    TAGS.forEach((d) => { d.hw = 0; });
  }
  let tagsOn = true;
  const tagBounds = { left: 292, bottom: 400, viewsL: 9e9, viewsB: 110, rects: [] };
  function measureTagBounds() {
    const hh = host.clientHeight;
    const rail = $('rail'), strip = $('strip'), views = $('views');
    tagBounds.left = (rail ? rail.getBoundingClientRect().right : 280) + 10;
    tagBounds.bottom = (strip ? strip.getBoundingClientRect().top : hh - 120) - 12;
    const vr = views ? views.getBoundingClientRect() : null;
    tagBounds.viewsL = vr ? vr.left - 8 : 9e9;
    tagBounds.viewsB = (vr ? vr.bottom : 110) + 8;
    // opaque chrome an anchor may end up behind — a leader pointing under one
    // of these points at nothing the user can see
    tagBounds.rects = ['#rail', '#strip', '#views', '#tb']
      .map((sel) => document.querySelector(sel))
      .filter(Boolean)
      .map((el) => el.getBoundingClientRect());
    TAGS.forEach((d) => { d.hw = 0; });
  }
  if ($('btn-tags')) $('btn-tags').onclick = () => {
    tagsOn = !tagsOn;
    tagHost.style.display = tagsOn ? '' : 'none';
    $('btn-tags').classList.toggle('active', tagsOn);
  };
  function placeTags() {
    if (!tagsOn || !tagHost) return;
    const w = host.clientWidth, hh = host.clientHeight;
    if (!w || !hh) return;
    // the band of screen the tags may occupy: right of the rail, above the
    // readout strip, below the header
    const B = tagBounds;
    const placed = [];
    TAGS.forEach((d) => {
      d.v.set(d.a[0], d.a[1], d.a[2]).project(camera);
      const clear = (p) => !B.rects.some((r) => p[0] > r.left && p[0] < r.right && p[1] > r.top && p[1] < r.bottom);
      let ax = (d.v.x * 0.5 + 0.5) * w, ay = (-d.v.y * 0.5 + 0.5) * hh;
      let ok = Number.isFinite(ax) && Number.isFinite(ay) && d.v.z <= 1 && clear([ax, ay]);
      // walk the alternate anchors until one lands somewhere the user can see
      if (!ok && d.alt) {
        for (const p of d.alt) {
          d.v.set(p[0], p[1], p[2]).project(camera);
          const bx = (d.v.x * 0.5 + 0.5) * w, by = (-d.v.y * 0.5 + 0.5) * hh;
          if (d.v.z <= 1 && clear([bx, by])) { ax = bx; ay = by; ok = true; break; }
        }
      }
      if (!ok) { d.el.style.opacity = 0; d.line.style.opacity = 0; return; }
      if (!d.hw) { const r = d.el.getBoundingClientRect(); d.hw = r.width / 2 || 44; d.hh = r.height / 2 || 11; }
      const halfW = d.hw, halfH = d.hh;
      let tx = ax + d.o[0], ty = ay + d.o[1];
      tx = Math.max(B.left + halfW, Math.min(w - 12 - halfW, tx));
      ty = Math.max(66 + halfH, Math.min(B.bottom - halfH, ty));
      if (tx + halfW > B.viewsL && ty - halfH < B.viewsB) ty = B.viewsB + halfH;
      // de-overlap against tags already placed this frame — bounded passes,
      // because a clamped tag can otherwise never resolve and would spin here
      for (let pass = 0; pass < 8; pass++) {
        let moved = false;
        for (let k = 0; k < placed.length; k++) {
          const p = placed[k];
          if (!(Math.abs(tx - p.x) < halfW + p.hw + 8 && Math.abs(ty - p.y) < halfH + p.hh + 6)) continue;
          // try all four escape directions; "down then left" alone deadlocks
          // when the strip blocks below and the control rail blocks the left
          const dy = halfH + p.hh + 8, dx = halfW + p.hw + 10;
          const away = ty >= p.y ? 1 : -1, side = tx >= p.x ? 1 : -1;
          const cands = [
            [tx, p.y + away * dy], [tx, p.y - away * dy],
            [p.x + side * dx, ty], [p.x - side * dx, ty],
            // diagonals, for when both straight axes are pinned at a clamp
            [p.x + side * dx, p.y + away * dy], [p.x + side * dx, p.y - away * dy],
            [p.x - side * dx, p.y + away * dy], [p.x - side * dx, p.y - away * dy],
          ];
          let best = null;
          for (const [cx, cy] of cands) {
            const nx = Math.max(B.left + halfW, Math.min(w - 12 - halfW, cx));
            const ny = Math.max(66 + halfH, Math.min(B.bottom - halfH, cy));
            if (Math.abs(nx - tx) < 0.5 && Math.abs(ny - ty) < 0.5) continue;
            const ox = Math.max(0, halfW + p.hw + 8 - Math.abs(nx - p.x));
            const oy = Math.max(0, halfH + p.hh + 6 - Math.abs(ny - p.y));
            const area = ox * oy;
            if (area === 0) { tx = nx; ty = ny; moved = true; best = null; break; }
            // remember the least-bad option in case every direction is pinned
            if (!best || area < best.area) best = { nx, ny, area };
          }
          if (best) { tx = best.nx; ty = best.ny; moved = true; }
        }
        if (!moved) break;
      }
      placed.push({ x: tx, y: ty, hw: halfW, hh: halfH });
      d.el.style.opacity = 1;
      d.line.style.opacity = 0.9;
      d.el.style.left = tx + 'px'; d.el.style.top = ty + 'px';
      const dx = ax - tx, dy = ay - ty;
      d.line.style.left = tx + 'px'; d.line.style.top = ty + 'px';
      d.line.style.width = Math.max(0, Math.hypot(dx, dy) - halfW * 0.5) + 'px';
      d.line.style.transform = 'rotate(' + Math.atan2(dy, dx) + 'rad)';
    });
  }

  // =====================================================================
  // NIAGARA N4 HOOK
  // BajaScript / PX writes into this object; nothing here polls or fetches,
  // so the same file works standalone (demo drift) and bound (live values).
  //
  //   SilomChillerRTHD.setLive({ run, load, chws, chwr, cdws, cdwr, kwrt })
  //   SilomChillerRTHD.setPoints({ CompRLA: 82, EvapSatTemp: 5.2, ... })
  //   SilomChillerRTHD.setPointFault('CompRLA', true)
  //   SilomChillerRTHD.setView('compressor')      // iso|starter|compressor|side|top
  //   SilomChillerRTHD.showTags(false)
  //   SilomChillerRTHD.clearLive()
  // =====================================================================
  const byPoint = {};
  TAGS.forEach((d) => { byPoint[d.pt] = d; });
  window.SilomChillerRTHD = {
    setLive(d) {
      Object.assign(LIVE, d); LIVE.on = true;
      if (typeof d.run === 'boolean') { S.run = d.run; applyRunVisuals(); }
      ['chws', 'chwr', 'cdws', 'cdwr', 'kwrt'].forEach((k) => {
        if (typeof d[k] === 'number') S[k] = d[k];
      });
      if (typeof d.capacity === 'number') S.cap = d.capacity;
      else if (typeof d.load === 'number') S.cap = d.load;   // accepted as an alias
      paint();
    },
    clearLive() { LIVE.on = false; Object.keys(LIVE).forEach((k) => { if (k !== 'on') LIVE[k] = null; }); },
    setPoints(o) {
      Object.keys(o).forEach((k) => { if (byPoint[k]) byPoint[k].value = o[k]; });
      paintTagValues();
    },
    setPointFault(pt, v) { if (byPoint[pt]) { byPoint[pt].fault = !!v; paintTagValues(); } },
    setRunning(v) { S.run = !!v; paint(); applyRunVisuals(); },
    setView(name) {
      const ALIAS = { compressor: 'comp', starter: 'panel', overview: 'iso', isometric: 'iso', plan: 'top' };
      const k = String(name).toLowerCase().replace(/^v-/, '');
      const b = $('v-' + (ALIAS[k] || k));
      if (b) { b.click(); return true; }
      return false;
    },
    showTags(v) { const b = $('btn-tags'); if (b && !!v !== tagsOn) b.click(); },
    isLive() { return LIVE.on; },
    get points() { const o = {}; TAGS.forEach((d) => { o[d.pt] = d.value; }); return o; },
    get state() { return { run: S.run, capacity: S.cap, chws: S.chws, chwr: S.chwr, cdws: S.cdws, cdwr: S.cdwr, kwrt: S.kwrt }; },
    get views() { return Object.keys(VIEWS).map((id) => VIEW_ALIAS[id] || id.slice(2)); },
  };

  let last = performance.now(), drift = 0;
  function frame(now) {
    try { step(now); } catch (e) { if (!frame.err) { frame.err = 1; console.error('frame', e); } }
    requestAnimationFrame(frame);
  }
  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (fly) {
      fly.k = Math.min(1, fly.k + dt * 1.6);
      const e = 1 - Math.pow(1 - fly.k, 3);
      camera.position.lerpVectors(fly.p0, fly.p1, e);
      controls.target.lerpVectors(fly.t0, fly.t1, e);
      if (fly.k >= 1) fly = null;
    }
    const rate = (0.35 + (S.cap / 100) * 0.95) * S.glow;
    guides.forEach((g) => { g.opacity = 0.07 + S.glow * 0.16; });
    boilFields.forEach((f) => {
      f.m.opacity = 0.88 * S.glow;
      if (S.glow < 0.02) return;
      const arr = f.geo.attributes.position.array;
      const rate = dt * (0.22 + (S.cap / 100) * 0.5);
      f.seed.forEach((b, i) => {
        b.ph += rate * b.sp;
        if (b.ph > 1) b.ph -= 1;
        // vertical travel, bounded by the barrel wall at this chord
        const half = Math.sqrt(Math.max(0, f.R * f.R - b.z * b.z)) * 0.94;
        const t = f.dir > 0 ? b.ph : 1 - b.ph;
        const wob = Math.sin(b.w + b.ph * 12.6) * 0.035;
        arr[i * 3] = b.x + wob;
        arr[i * 3 + 1] = f.y0 - half + t * half * 2;
        arr[i * 3 + 2] = b.z + wob * 0.6;
      });
      f.geo.attributes.position.needsUpdate = true;
    });

    tracers.forEach((p) => {
      p.m.visible = S.glow > 0.04;
      if (!p.m.visible) return;
      p.t = (p.t + dt * rate * p.speed * 0.5) % p.total;
      let i = 0; while (i < p.tot.length - 1 && p.t > p.tot[i]) i++;
      const before = i === 0 ? 0 : p.tot[i - 1];
      const local = p.seg[i] ? (p.t - before) / p.seg[i] : 0;
      p.m.position.lerpVectors(p.v[i], p.v[i + 1] || p.v[i], local);
      if (p.aim && p.v[i + 1]) p.m.lookAt(p.v[i + 1]);
    });
    // status animation — everything below reads "the machine is running"
    S.glow += ((S.run ? 1 : 0) - S.glow) * Math.min(1, dt * 2.2);   // smooth spin-up / coast-down
    const beat = (Math.sin(now * 0.0042) * 0.5 + 0.5);
    if (beaconMat) {
      beaconMat.emissiveIntensity = S.run ? 0.55 + beat * 1.15 : 0.05;
      beaconMat.color.setHex(S.run ? 0x2f9e54 : 0x4a5258);
      beaconMat.emissive.setHex(S.run ? 0x2f9e54 : 0x000000);
    }
    // the big, room-readable cues
    const pulse = 0.72 + beat * 0.28;
    statusBand.forEach((m) => {
      m.opacity = 0.12 + S.glow * 0.8 * pulse;
      m.color.setHex(S.run ? 0x2fd46a : 0x8a3b30);
    });
    if (statusRim) { statusRim.intensity = S.glow * 0.3; statusRim.color.setHex(S.run ? 0x49e08a : 0x8a3b30); }
    // rotating assembly glows green while it turns, greys out when it stops
    const hot = S.run ? 0x2fd46a : 0x555b5f;
    if (bladeMat) { bladeMat.color.setHex(hot); bladeMat.emissive.setHex(S.run ? 0x2fd46a : 0x000000); bladeMat.emissiveIntensity = 0.35 + S.glow * 0.95; }
    if (guardMat) { guardMat.color.setHex(hot); guardMat.emissive.setHex(S.run ? 0x2fd46a : 0x000000); guardMat.emissiveIntensity = 0.25 + S.glow * 0.7; }
    if (spinMarkMat) { spinMarkMat.color.setHex(hot); spinMarkMat.emissive.setHex(S.run ? 0x2fd46a : 0x000000); spinMarkMat.emissiveIntensity = 0.2 + S.glow * 0.7; }
    if (spinDisc) spinDisc.material.opacity = S.glow * (0.1 + (S.cap / 100) * 0.26);
    rotorPorts.forEach((m) => { m.emissiveIntensity = 0.1 + S.glow * 0.55; });
    rotorMats.forEach((m, i) => {
      m.emissiveIntensity = 0.04 + 0.62 * S.glow;
      m.color.setHex(0x9aa39c).lerp(new THREE.Color(i ? 0x27c05f : 0x2fd46a), S.glow);
    });
    if (ledRun) ledRun.emissiveIntensity = S.run ? 1.2 : 0.04;
    if (hmiMat) hmiMat.emissiveIntensity = S.run ? 0.8 + beat * 0.25 : 0.12;
    dischargeMats.forEach((m) => {
      m.emissive.setHex(0x8a2f14);
      m.emissiveIntensity = S.glow * (0.1 + (S.cap / 100) * 0.3);
    });
    if (S.run || S.glow > 0.02) {
      S.spin += dt * (2.4 + S.cap / 10) * S.glow;
      // barrel, fan and stripe stay put — a hermetic RTHD shows nothing turning
      // outside; the screw rotors in the cut are the only moving parts

      // male drives female; 4:6 lobes means the female turns at two-thirds speed
      if (rotorM) rotorM.rotation.x = S.spin * 3.4;
      if (rotorF) rotorF.rotation.x = -S.spin * 3.4 * (4 / 6);
      // running vibration: sub-millimetre, enough to read as alive
      const v = S.glow * 0.0016 * (0.6 + S.cap / 100);
      G.comp.position.y = Math.sin(now * 0.055) * v;
      G.comp.position.z = Math.cos(now * 0.071) * v * 0.6;
    }
    if (!LIVE.on && !S.run) {
      // no flow: both circuits settle toward a common standing temperature
      const k = Math.min(1, dt * 0.55), amb = 30.6;
      const before = S.chws + S.chwr + S.cdws + S.cdwr;
      S.chws += (amb - S.chws) * k; S.chwr += (amb - S.chwr) * k;
      S.cdws += (amb - S.cdws) * k; S.cdwr += (amb - S.cdwr) * k;
      S.kwrt += (0 - S.kwrt) * k;
      if (Math.abs(S.chws + S.chwr + S.cdws + S.cdwr - before) > 0.004) paint();
    }
    if (S.run) {
      drift += dt;
      if (drift > 1.4 && !LIVE.on) {
        drift = 0;
        const l = S.cap / 100;
        S.chws = 6.9 + (Math.random() - 0.5) * 0.14;
        S.chwr = S.chws + 4.0 + l * 2.4 + (Math.random() - 0.5) * 0.18;
        S.cdws = 30.0 + l * 0.9 + (Math.random() - 0.5) * 0.2;
        S.cdwr = S.cdws + 3.4 + l * 1.9 + (Math.random() - 0.5) * 0.2;
        S.kwrt = 0.50 + l * 0.15 + (Math.random() - 0.5) * 0.02;
        paint();
      }
    }
    controls.update();
    renderer.render(scene, camera);
    try { placeTags(); } catch (e) { if (!frame.warned) { frame.warned = 1; console.error('placeTags', e); } }
  }
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    // a zero measure at script time would set camera.aspect = NaN, poisoning
    // every project() call and collapsing the callouts off-screen
    if (!w || !h) return;
    camera.aspect = w / h;
    const rail = $('ctl');
    const railR = rail ? rail.getBoundingClientRect().right : 0;
    if (railR > 8 && railR < w * 0.6) camera.setViewOffset(w, h, -railR / 2, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  function relayout() {
    resize(); measureTagBounds();
    // draw once so a hidden or resized page still shows a correct still image
    renderer.render(scene, camera);
    try { placeTags(); } catch (e) { /* layout only; never block the redraw */ }
  }
  addEventListener('resize', relayout);
  if (window.ResizeObserver) new ResizeObserver(relayout).observe(host);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    last = performance.now();   // avoid a huge dt on the first frame back
    relayout();
    requestAnimationFrame(frame);
  });
  relayout(); paint(); requestAnimationFrame(frame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureTagBounds);

  (function clock() {
    const t = $('tb-time'), d = $('tb-date');
    function tick() {
      const n = new Date();
      if (t) t.textContent = n.toLocaleTimeString('en-GB');
      if (d) d.textContent = n.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    tick(); setInterval(tick, 1000);
  })();
})();
