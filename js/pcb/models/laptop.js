/*
 * Thin aluminium laptop, lid open ~110 deg, showing a web app on a 16:10 screen.
 * Built in base-centred millimetres, then shifted into `inner` so the hull's bounding-box
 * centre sits at the origin. The site only ever transforms `group`.
 *
 * Orientation: base lies in XZ (keyboard faces +Y), hinge along the back edge (-Z), the screen
 * faces +Z at pose rx=0.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';

const BASE = { w: 304, d: 212, h: 14, r: 3.2 };
const LID = { w: 304, len: 212, t: 6, r: 2.2 };
const SCREEN = { w: 292, h: 182.5, zTop: 205, zBottom: 22.5 }; // lid-local z, 0 = hinge
const DECK_Y = BASE.h / 2;
const TRAY_LIFT = 0.2; // mm; keeps the keyboard tray clear of the deck in the depth buffer at small sizes
const FOOT_H = 1.2;
const HINGE = new THREE.Vector3(0, DECK_Y, -BASE.d / 2);
const OPEN = THREE.MathUtils.degToRad(-110); // rotates lid +Z up and back, screen normal to (0, sin20, cos20)

// Lid-local depth stack (mm, toward the viewer from the shell face at y = 0):
// bezel frame at -0.25, camera lens at -0.4, glass screen at -0.6. Separated by >= 0.25 mm so
// neither plane z-fights the shell or each other at grazing angles.
const BEZEL_Y = -0.25, LENS_Y = -0.4, SCREEN_Y = -0.6;

// Keycaps sit on one fixed 18 mm pitch. Every row sums to 15 units, so rows stay aligned
// without stretching: 1u letter keys are all exactly 18 mm pitch.
const KEY = { pitch: 18, size: 16.2, h: 1.4, x0: -135, row0: -91, rowStep: 18 };
const KEY_ROWS = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],                     // number row
  [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1.5],                       // Tab row
  [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],                        // Caps row
  [2.25, 1, 1, 1, 1, 1, 1, 1, 3, 2.75],                              // Shift row
  [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],                  // bottom row
];
const TRAY = { w: 276, d: 100, z: -54, r: 3 };
const PAD = { w: 146, d: 88, z: 52, r: 7 };

/* ------------------------------------------------------------ palette + fonts */
const C = {
  desk: '#E7EAEE', white: '#FFFFFF', surf: '#F6F7F8', ink: '#121417', muted: '#5E656D',
  graph: '#2A2F36', silver: '#C9CFD6', bar: '#C9CFD6', hair: 'rgba(18,20,23,0.12)', hair2: 'rgba(18,20,23,0.08)',
};
const SANS = '"Geist", "Helvetica Neue", Arial, sans-serif';
const MONO = '"Geist Mono", ui-monospace, Menlo, Consolas, monospace';
// Logical px on the 1280 x 800 screen. Nothing is set below 22 px, which is about 7.5 CSS px
// when the screen is shown at ~450 px wide. Anything smaller is unreadable on a phone.
const font = (w, px, fam = SANS) => `${w} ${px}px ${fam}`;
const T = 22;      // body, labels, table cells, micro figures

/* ------------------------------------------------------------ geometry helpers */
function roundRectShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Flat patch lying on the XZ plane facing +Y (or -Y when `down`), centred at (0, y, z). */
function flatPatch(shape, y, z, down = false) {
  const g = new THREE.ShapeGeometry(shape, 12);
  g.rotateX(down ? Math.PI / 2 : -Math.PI / 2);
  g.translate(0, y, z);
  return g;
}

/* ------------------------------------------------------------ screen UI */
function paintScreen(canvas) {
  const c = canvas.getContext('2d');
  const k = canvas.width / 1280;
  c.setTransform(k, 0, 0, k, 0, 0);
  c.textBaseline = 'middle';

  const path = (x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
  const fillC = (col) => { c.fillStyle = col; c.fill(); };
  const edge = (col = C.hair) => { c.strokeStyle = col; c.lineWidth = 1.6; c.stroke(); };
  const txt = (s, x, y, o = {}) => {
    c.font = o.f || font(400, T); c.fillStyle = o.col || C.ink;
    c.textAlign = o.align || 'left'; c.fillText(s, x, y);
  };
  const card = (x, y, w, h, r = 22) => { path(x, y, w, h, r); fillC(C.white); path(x, y, w, h, r); edge(); };
  const pill = (x, y, w, h, col, border = false) => { path(x, y, w, h, h / 2); fillC(col); if (border) { path(x, y, w, h, h / 2); edge(); } };
  const line = (x1, y1, x2, y2, col = C.hair2, lw = 1.4) => {
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = col; c.lineWidth = lw; c.stroke();
  };
  const dot = (x, y, r, col) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); fillC(col); };

  /* window on a desk tone */
  c.fillStyle = C.desk; c.fillRect(0, 0, 1280, 800);
  path(14, 14, 1252, 772, 22); fillC(C.white);
  c.save();
  path(14, 14, 1252, 772, 22); c.clip();

  /* browser chrome: three window dots, one tab, URL pill */
  c.fillStyle = C.surf; c.fillRect(14, 14, 1252, 56);
  line(14, 70, 1266, 70, C.hair, 1.6);
  [52, 74, 96].forEach((x) => dot(x, 42, 7, C.silver));
  pill(128, 22, 232, 40, C.white, true);
  txt('Overview', 150, 42, { f: font(500, T), col: C.ink });
  pill(420, 20, 440, 44, C.white, true);
  txt('app.yourproduct.com', 640, 42, { f: font(500, T, MONO), col: '#3C434B', align: 'center' });

  /* sidebar */
  c.fillStyle = C.white; c.fillRect(14, 71, 220, 715);
  line(234, 71, 234, 786, C.hair2, 1.4);
  path(40, 98, 40, 40, 12); fillC(C.graph);
  c.beginPath(); c.arc(60, 118, 9, 0, Math.PI * 2); c.strokeStyle = C.white; c.lineWidth = 3; c.stroke();
  dot(60, 118, 3, C.white);
  txt('Product', 94, 118, { f: font(600, 26), col: C.ink });

  const nav = [['Dashboard', 'grid'], ['Devices', 'device'], ['Orders', 'list'], ['Customers', 'people'], ['Automations', 'bolt'], ['Settings', 'gear']];
  nav.forEach(([label, icon], i) => {
    const y = 196 + i * 58, active = i === 0;
    if (active) { path(24, y - 23, 202, 46, 23); fillC(C.graph); }
    const ic = active ? C.white : C.muted;
    c.strokeStyle = ic; c.fillStyle = ic; c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round';
    const ix = 52;
    if (icon === 'grid') {
      [[-6, -6], [2, -6], [-6, 2], [2, 2]].forEach(([dx, dy]) => { path(ix + dx, y + dy, 6, 6, 1.5); c.stroke(); });
    } else if (icon === 'device') {
      path(ix - 6, y - 10, 12, 20, 3); c.stroke();
    } else if (icon === 'list') {
      [-6, 0, 6].forEach((dy) => line(ix - 7, y + dy, ix + 7, y + dy, ic, 2));
    } else if (icon === 'people') {
      c.beginPath(); c.arc(ix, y - 4, 4.4, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(ix, y + 11, 7.5, Math.PI, 0); c.stroke();
    } else if (icon === 'bolt') {
      c.beginPath(); c.moveTo(ix + 3, y - 9); c.lineTo(ix - 4, y + 1); c.lineTo(ix + 1, y + 1); c.lineTo(ix - 3, y + 9); c.stroke();
    } else {
      c.beginPath(); c.arc(ix, y, 6.5, 0, Math.PI * 2); c.stroke();
      dot(ix, y, 2.4, ic);
    }
    txt(label, 82, y, { f: font(500, T), col: active ? C.white : C.ink });
  });

  /* main column */
  c.fillStyle = C.surf; c.fillRect(235, 71, 1031, 715);
  txt('Overview', 270, 124, { f: font(600, 40), col: C.ink });
  pill(966, 98, 196, 52, C.white, true);
  txt('Last 30 days', 1064, 124, { f: font(500, T), col: C.ink, align: 'center' });
  dot(1206, 124, 26, C.silver);
  txt('JL', 1206, 125, { f: font(600, T), col: C.ink, align: 'center' });

  /* KPI row */
  const kpis = [['Revenue', '$48.2k', '12%'], ['Active devices', '1,284', '6%'], ['Orders', '326', '8%'], ['Automations run', '9,410', '21%']];
  kpis.forEach(([label, value, delta], i) => {
    const x = 270 + i * 245, y = 168, w = 225, h = 140;
    card(x, y, w, h, 22);
    txt(label, x + 22, y + 38, { f: font(500, T), col: C.muted });
    txt(value, x + 22, y + 86, { f: font(600, 46), col: C.ink });
    c.beginPath(); c.moveTo(x + 22, y + 124); c.lineTo(x + 31, y + 113); c.lineTo(x + 40, y + 124); c.closePath();
    fillC(C.ink);
    txt(delta, x + 50, y + 119, { f: font(500, T, MONO), col: C.ink });
  });

  /* revenue chart */
  card(270, 332, 500, 428, 22);
  txt('Revenue', 300, 374, { f: font(600, 26), col: C.ink });
  [580, 460].forEach((y) => line(300, y, 738, y, C.hair2, 1.4));
  const vals = [22, 25, 23, 30, 34, 38, 42, 48.2];
  const base = 700, slot = 438 / vals.length, bw = 30;
  vals.forEach((v, i) => {
    const h = (v / 50) * 300, x = 300 + i * slot + (slot - bw) / 2, cx = x + bw / 2, last = i === vals.length - 1;
    c.beginPath(); c.roundRect(x, base - h, bw, h, [7, 7, 0, 0]); fillC(last ? C.graph : C.bar);
    if (last) {
      path(cx - 52, base - h - 52, 104, 38, 19); fillC(C.graph);
      txt('$48.2k', cx, base - h - 33, { f: font(500, T, MONO), col: C.white, align: 'center' });
    }
    txt(`W${41 + i}`, cx, 738, { f: font(400, T, MONO), col: C.muted, align: 'center' });
  });

  /* recent orders table: 4 rows, 3 columns */
  card(790, 332, 440, 232, 22);
  txt('Recent orders', 820, 374, { f: font(600, 26), col: C.ink });
  const rows = [['Acme Labs', 'Paid', '$1,240'], ['Northwind', 'Pending', '$860'], ['Helix Labs', 'Paid', '$3,410'], ['Vector Tools', 'Paid', '$420']];
  rows.forEach(([who, status, total], i) => {
    const y = 418 + i * 38;
    txt(who, 820, y, { f: font(500, T), col: C.ink });
    const paid = status === 'Paid';
    pill(968, y - 16, 104, 32, paid ? C.graph : C.silver);
    txt(status, 1020, y, { f: font(500, T), col: paid ? C.white : C.ink, align: 'center' });
    txt(total, 1200, y, { f: font(500, T, MONO), col: C.ink, align: 'right' });
    if (i < rows.length - 1) line(820, y + 19, 1200, y + 19, C.hair2, 1.4);
  });

  /* AI assistant chat card, bottom-right corner */
  card(790, 580, 440, 180, 22);
  path(976, 598, 230, 40, 20); fillC(C.graph);
  txt('Summarise orders', 996, 618, { f: font(500, T), col: C.white });
  path(810, 650, 280, 40, 20); fillC(C.surf); path(810, 650, 280, 40, 20); edge();
  txt('326 orders, up 8%', 830, 670, { f: font(400, T), col: C.ink });
  path(810, 706, 396, 40, 20); fillC(C.white); path(810, 706, 396, 40, 20); edge();
  txt('Ask anything…', 830, 726, { f: font(400, T), col: C.muted });
  dot(1170, 726, 16, C.graph);
  c.beginPath(); c.moveTo(1163, 726); c.lineTo(1176, 726); c.moveTo(1171, 720); c.lineTo(1176, 726); c.lineTo(1171, 732);
  c.strokeStyle = C.white; c.lineWidth = 2.2; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();

  c.restore();
}

/* ------------------------------------------------------------ model */
export class LaptopModel {
  constructor({ texRes = 2048, anisotropy = 8 } = {}) {
    this.group = new THREE.Group();   // transformed by the site
    this.inner = new THREE.Group();   // shifted so the hull centre is the origin
    this.group.add(this.inner);
    this.lastExplode = -1;
    this.owned = [];

    const alu = this.track(new THREE.MeshPhysicalMaterial({ color: 0x9ea5ae, metalness: 1, roughness: 0.44, clearcoat: 0.2, clearcoatRoughness: 0.35 }));
    const plastic = this.track(new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.5 }));
    const rubber = this.track(new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.9 }));
    // The tray and trackpad are flat patches just above the deck. Drawn small (the hero composite),
    // 0.03 mm is below depth-buffer precision, so the tray sits TRAY_LIFT above the deck (the keys
    // stand on it) and the trackpad, which nothing stands on, uses a polygon offset.
    const tray = this.track(new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.7 }));
    const keyMat = this.track(new THREE.MeshPhysicalMaterial({ color: 0x2c3138, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.4 }));
    const glass = this.track(new THREE.MeshPhysicalMaterial({ color: 0x1d2127, roughness: 0.35, clearcoat: 0.3, clearcoatRoughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    const bezelMat = this.track(new THREE.MeshPhysicalMaterial({ color: 0x0b0c0e, roughness: 0.12, clearcoat: 0.6, clearcoatRoughness: 0.05 }));
    const lensMat = this.track(new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.08, metalness: 0.2 }));

    // Base: rounded aluminium block, keyboard tray, trackpad, side ports, feet
    const base = new THREE.Mesh(this.geo(new RoundedBoxGeometry(BASE.w, BASE.h, BASE.d, 4, BASE.r)), alu);
    base.castShadow = base.receiveShadow = true;
    const trayMesh = new THREE.Mesh(this.geo(flatPatch(roundRectShape(TRAY.w, TRAY.d, TRAY.r), DECK_Y + TRAY_LIFT, TRAY.z)), tray);
    // Recessed parts don't receive shadows: at composite scale the shadow map is too coarse for
    // surfaces a millimetre below the deck and they break up into stair-step acne.
    trayMesh.receiveShadow = false;
    const padMesh = new THREE.Mesh(this.geo(flatPatch(roundRectShape(PAD.w, PAD.d, PAD.r), DECK_Y + 0.04, PAD.z)), glass);
    padMesh.receiveShadow = false;

    const keys = this.buildKeys(keyMat);
    const ports = this.buildPorts(plastic);
    const feet = this.buildFeet(rubber);

    const hingeGeo = this.geo(new THREE.CylinderGeometry(2.3, 2.3, BASE.w - 18, 20).rotateZ(Math.PI / 2));
    const hinge = new THREE.Mesh(hingeGeo, plastic);
    hinge.position.copy(HINGE);
    hinge.castShadow = true;

    this.inner.add(base, trayMesh, padMesh, keys, ports, feet, hinge);

    // Lid: pivots about the hinge. Lid-local: y = 0 is the shell's front face, +Z points away from hinge.
    this.lid = new THREE.Group();
    this.lid.position.copy(HINGE);
    this.lid.rotation.x = OPEN;
    const shell = new THREE.Mesh(this.geo(new RoundedBoxGeometry(LID.w, LID.t, LID.len, 3, LID.r).translate(0, LID.t / 2, LID.len / 2)), alu);
    shell.castShadow = true;
    const bezel = new THREE.Mesh(this.geo(flatPatch(roundRectShape(LID.w - 4, LID.len - 4, 1.6), BEZEL_Y, LID.len / 2, true)), bezelMat);
    const zMid = (SCREEN.zTop + SCREEN.zBottom) / 2;
    const screenGeo = this.geo(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h).rotateX(Math.PI / 2).translate(0, SCREEN_Y, zMid));

    const texW = texRes, texH = Math.round(texRes / 1.6);
    const canvas = document.createElement('canvas');
    canvas.width = texW; canvas.height = texH;
    paintScreen(canvas);
    const tex = this.track(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    tex.generateMipmaps = true;
    // The panel is self-lit UI, so it skips the scene tone curve: the palette lands on screen
    // as drawn (surfaces #F6F7F8, cards #FFFFFF) instead of compressing into grey. A low-gloss
    // clearcoat keeps a faint glass reflection without lifting the whites.
    const screenMat = this.track(new THREE.MeshPhysicalMaterial({
      color: 0x0e0e0e, map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.0,
      roughness: 0.15, clearcoat: 0.15, clearcoatRoughness: 0.15, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
    }));
    const screen = new THREE.Mesh(screenGeo, screenMat);
    const cam = new THREE.Mesh(this.geo(new THREE.CircleGeometry(0.85, 24).rotateX(Math.PI / 2).translate(0, LENS_Y, LID.len - 3.5)), lensMat);
    this.lid.add(shell, bezel, screen, cam);
    this.inner.add(this.lid);

    // Hull: corners of the base box and of the lid box at the open pose, centred on the origin
    this.lid.updateMatrix();
    const raw = [];
    const v = new THREE.Vector3();
    const addBox = (x0, x1, y0, y1, z0, z1, m) => {
      for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) {
        v.set(x, y, z); if (m) v.applyMatrix4(m); raw.push(v.x, v.y, v.z);
      }
    };
    addBox(-BASE.w / 2, BASE.w / 2, -DECK_Y - FOOT_H, DECK_Y, -BASE.d / 2, BASE.d / 2, null);
    addBox(-LID.w / 2, LID.w / 2, 0, LID.t, 0, LID.len, this.lid.matrix);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < raw.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], raw[i + a]); hi[a] = Math.max(hi[a], raw[i + a]); }
    this.offset = new THREE.Vector3(-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -(lo[2] + hi[2]) / 2);
    this.inner.position.copy(this.offset);
    this.hullPts = [];
    for (let i = 0; i < raw.length; i += 3) this.hullPts.push(raw[i] + this.offset.x, raw[i + 1] + this.offset.y, raw[i + 2] + this.offset.z);
    let r2 = 0;
    for (let i = 0; i < this.hullPts.length; i += 3) r2 = Math.max(r2, this.hullPts[i] ** 2 + this.hullPts[i + 1] ** 2 + this.hullPts[i + 2] ** 2);
    this.radius = Math.sqrt(r2);

    this.group.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  }

  track(m) { this.owned.push(m); return m; }
  geo(g) { this.owned.push(g); return g; }

  buildKeys(mat) {
    const count = KEY_ROWS.reduce((n, r) => n + r.length, 0);
    const geo = this.geo(new RoundedBoxGeometry(1, 1, 1, 2, 0.12));
    const keys = new THREE.InstancedMesh(geo, mat, count);
    keys.castShadow = true;
    keys.receiveShadow = false;
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3(), q = new THREE.Quaternion();
    let i = 0;
    KEY_ROWS.forEach((row, r) => {
      const z = KEY.row0 + r * KEY.rowStep;
      let x = KEY.x0;
      for (const u of row) {
        const w = u * KEY.pitch;
        p.set(x + w / 2, DECK_Y + TRAY_LIFT + KEY.h / 2, z);
        s.set(w - (KEY.pitch - KEY.size), KEY.h, KEY.size);
        keys.setMatrixAt(i++, m.compose(p, q, s));
        x += w;
      }
    });
    keys.instanceMatrix.needsUpdate = true;
    return keys;
  }

  buildPorts(mat) {
    const slot = this.geo(new THREE.ShapeGeometry(roundRectShape(8, 2.6, 1.3), 6));
    const ports = new THREE.InstancedMesh(slot, mat, 4);
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), q = new THREE.Quaternion();
    const spots = [[BASE.w / 2 + 0.03, -74, Math.PI / 2], [BASE.w / 2 + 0.03, -56, Math.PI / 2], [BASE.w / 2 + 0.03, -38, Math.PI / 2], [-BASE.w / 2 - 0.03, -66, -Math.PI / 2]];
    spots.forEach(([x, z, ry], i) => {
      p.set(x, 0, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
      ports.setMatrixAt(i, m.compose(p, q, s));
    });
    return ports;
  }

  buildFeet(mat) {
    const g = this.geo(new THREE.CylinderGeometry(4.2, 4.2, FOOT_H, 18));
    const feet = new THREE.InstancedMesh(g, mat, 4);
    const m = new THREE.Matrix4(), p = new THREE.Vector3();
    [[-120, -76], [120, -76], [-120, 76], [120, 76]].forEach(([x, z], i) => {
      p.set(x, -DECK_Y - FOOT_H / 2, z);
      feet.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z));
    });
    return feet;
  }

  /** Flat [x, y, z, ...] corners of the base and of the open lid, mm, centred on the origin. */
  hull(explode = 0) { return this.hullPts.slice(); }

  /** The lid opens at a fixed angle; explode is a no-op. */
  setExplode(e) {
    if (Math.abs(e - this.lastExplode) < 1e-4) return;
    this.lastExplode = e;
  }

  dispose() {
    this.group.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
    });
    for (const o of this.owned) {
      if (o.isTexture) o.dispose();
      else if (o.isMaterial) {
        for (const k of ['map', 'emissiveMap']) o[k]?.dispose?.();
        o.dispose();
      } else o.dispose?.();
    }
    this.owned.length = 0;
  }
}
