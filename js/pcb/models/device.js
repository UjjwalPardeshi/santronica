/*
 * Rugged field transmitter: a die-cast housing with a bevelled front lid (glass window over a
 * segment LCD, stainless nameplate, four flush screws in counterbores), two M20 cable glands
 * underneath, a rubber antenna on top and wall-mount lugs at the back.
 * Explode slides the lid up and back so it clears the opening, and lifts the board into it.
 *
 * Model space in mm. Front (window) = +Y, top = -Z.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';

const BEVEL = 1.5;
const BODY_Y = [-30, 20];        // housing tube: back face to lid seat
const LID_Y = [20, 30];          // lid: seat to front face
const LID_SLIDE = [0, 14, -36];  // lid displacement at explode 1 (x, y, z): up, and back over the antenna side
const PCB_LIFT = 24;             // board moves forward into the opening at explode 1
const TOP_Z = -45, BOTTOM_Z = 45;
const GLAND_X = 32;
const DEVICE_Y = -5;             // centre of the housing depth
const WINDOW = { w: 80, h: 32, cz: -14 };
const PLATE = { w: 80, h: 16, cz: 16 };
const SCREW = { x: 55, z: 35 };
const LCD = { bg: '#C5CEC2', ink: '#1C231F', ghost: '#B1BAAD' };
const COAT = 0xa3abb4;
const MONO = '"Geist Mono", ui-monospace, Menlo, monospace';
const SANS = '"Geist", "Helvetica Neue", Arial, sans-serif';
const ANTENNA = [[4.4, 0], [4.2, 2], [3.9, 8], [3.3, 14], [2.7, 20], [2.1, 26], [1.6, 30], [1.1, 32.5], [0.6, 33.5], [0.01, 34]];
const GLAND_DOME = [[7.0, 0], [6.8, 1], [6.2, 3], [5.0, 4.6], [3.4, 5.6], [0.01, 6]];
const DIGIT_SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
const CHIPS = [[-30, -10], [-12, 8], [20, -14], [34, 12], [-40, 18], [8, -24], [-4, 20]];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); return c; };

// Painted canvases are shared by every instance at the same resolution: only the first build paints.
const paintCache = new Map();
const painted = (key, make) => {
  if (!paintCache.has(key)) paintCache.set(key, make());
  return paintCache.get(key);
};

/* ------------------------------------------------------------ shapes */
// Rounded rectangle on `p`, shape space: x = X, y = -Z (so extrudeY maps it onto the XZ plane).
function rrPath(p, w, h, r, cx, cy) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  p.moveTo(x0 + r, y0);
  p.lineTo(x1 - r, y0); p.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  p.lineTo(x1, y1 - r); p.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  p.lineTo(x0 + r, y1); p.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  p.lineTo(x0, y0 + r); p.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return p;
}

/** Extrudes a shape (x = X, y = -Z) along +Y from yStart to yEnd, with rounded (bevelled) edges. */
function extrudeY(shape, [yStart, yEnd], bevel = BEVEL) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: yEnd - yStart - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelOffset: 0, bevelSegments: 3, curveSegments: 10,
  });
  g.rotateX(-Math.PI / 2);          // extrusion -> +Y, shape y -> -Z
  g.translate(0, yStart + bevel, 0);
  return g;
}

/** Flat plane facing +Y with its canvas top toward -Z (the device top). */
function faceUp(w, h) {
  const g = new THREE.PlaneGeometry(w, h);
  g.rotateX(-Math.PI / 2);
  return g;
}

/* ------------------------------------------------------------ canvas painting */
function fillPoly(g, pts, color) {
  g.fillStyle = color; g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath(); g.fill();
}

/** Seven-segment polygon for segment `s` ('a'..'g') in a cell at (x, y) of size w x h, bar thickness t. */
function segPoly(s, x, y, w, h, t) {
  const ht = t / 2, hh = h / 2;
  const H = (x0, x1, y0) => [[x0 + ht, y0], [x1 - ht, y0], [x1, y0 + ht], [x1 - ht, y0 + t], [x0 + ht, y0 + t], [x0, y0 + ht]];
  const V = (x0, y0, y1) => [[x0, y0 + ht], [x0 + ht, y0], [x0 + t, y0 + ht], [x0 + t, y1 - ht], [x0 + ht, y1], [x0, y1 - ht]];
  switch (s) {
    case 'a': return H(x, x + w, y);
    case 'g': return H(x, x + w, y + hh - ht);
    case 'd': return H(x, x + w, y + h - t);
    case 'f': return V(x, y, y + hh);
    case 'b': return V(x + w - t, y, y + hh);
    case 'e': return V(x, y + hh, y + h);
    default:  return V(x + w - t, y + hh, y + h); // 'c'
  }
}

function drawDigit(g, ch, x, y, w, h, t, lit, ghost) {
  for (const s of 'abcdefg') fillPoly(g, segPoly(s, x, y, w, h, t), ghost);
  for (const s of DIGIT_SEGS[ch] ?? '') fillPoly(g, segPoly(s, x, y, w, h, t), lit);
}

function paintLcd(W) {
  const u = W / 1024, H = Math.round(W / 2.6), c = canvas(W, H), g = c.getContext('2d');
  const k = (v) => v * u;
  g.fillStyle = LCD.bg; g.fillRect(0, 0, W, H);
  g.textBaseline = 'alphabetic';
  g.fillStyle = LCD.ink;
  g.font = `500 ${k(46)}px ${MONO}`; g.fillText('TEMPERATURE', k(60), k(84));
  g.textAlign = 'right'; g.font = `600 ${k(44)}px ${SANS}`; g.fillText('SNT-EX1', W - k(60), k(84)); g.textAlign = 'left';

  const DY = k(104), DH = k(196), DW = k(112), DT = k(20);
  const slots = [['2', 60], ['3', 206], ['6', 374]];
  for (const [, x] of slots) drawDigit(g, '8', k(x), DY, DW, DH, DT, LCD.ghost, LCD.ghost);
  for (const [ch, x] of slots) drawDigit(g, ch, k(x), DY, DW, DH, DT, LCD.ink, LCD.ghost);
  g.fillStyle = LCD.ink; g.beginPath(); g.arc(k(346), DY + DH - k(11), k(11), 0, Math.PI * 2); g.fill();

  g.fillStyle = LCD.ink;
  g.font = `500 ${k(128)}px ${MONO}`; g.fillText('°C', k(520), DY + DH);
  g.font = `500 ${k(46)}px ${MONO}`;
  g.fillText('MIN', k(730), k(150)); g.fillText('21.2', k(830), k(150));
  g.fillText('MAX', k(730), k(214)); g.fillText('24.9', k(830), k(214));

  // 10-segment bar graph, 6 lit for 23.6 on a -40..+70 range
  for (let i = 0; i < 10; i++) {
    g.fillStyle = i < 6 ? LCD.ink : LCD.ghost;
    g.fillRect(k(60 + i * 36), k(330), k(26), k(30));
  }
  g.fillStyle = LCD.ink;
  g.textAlign = 'right'; g.font = `500 ${k(40)}px ${MONO}`;
  g.fillText('RANGE  -40 .. +70 °C', W - k(60), k(354)); g.textAlign = 'left';
  return c;
}

function paintPlate(W) {
  const u = W / 1280, H = Math.round(W / 5), c = canvas(W, H), g = c.getContext('2d');
  const k = (v) => v * u;
  g.fillStyle = '#B4BCC5'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(18,20,23,0.36)'; g.lineWidth = k(3);
  g.strokeRect(k(22), k(22), W - k(44), H - k(44));
  g.fillStyle = '#15191D'; g.textBaseline = 'alphabetic';
  g.font = `600 ${k(64)}px ${SANS}`; g.letterSpacing = `${k(3)}px`;
  g.fillText('SANTRONICA SNT-EX1', k(70), k(96));
  g.letterSpacing = '0px';
  g.font = `500 ${k(40)}px ${MONO}`; g.fillText('Ex ia IIC T4 Ga', k(70), k(160));
  g.textAlign = 'right'; g.font = `600 ${k(40)}px ${MONO}`; g.fillText('IP66', W - k(70), k(160)); g.textAlign = 'left';
  g.font = `500 ${k(38)}px ${MONO}`; g.fillText('-40 °C ≤ Ta ≤ +70 °C', k(70), k(222));
  return c;
}

function paintPcb(W) {
  const u = W / 1024, H = Math.round(W * 70 / 108), c = canvas(W, H), g = c.getContext('2d');
  let seed = 11;
  const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.fillStyle = '#17392A'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#B8975A'; g.lineWidth = 3 * u; g.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    let x = r() * W, y = r() * H;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      if (r() < 0.5) x = Math.min(W - 8 * u, Math.max(8 * u, x + (r() - 0.5) * W * 0.35));
      else y = Math.min(H - 8 * u, Math.max(8 * u, y + (r() - 0.5) * H * 0.35));
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 60; i++) {
    const x = r() * W, y = r() * H;
    g.fillStyle = '#C9A35E'; g.beginPath(); g.arc(x, y, 7 * u, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0A1F16'; g.beginPath(); g.arc(x, y, 3.4 * u, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#16181B';
  for (const [x, y] of [[0.18, 0.3], [0.5, 0.55], [0.74, 0.25], [0.3, 0.8]]) g.fillRect(x * W, y * H, 90 * u, 54 * u);
  g.strokeStyle = '#E8E6DC'; g.lineWidth = 2 * u;
  for (const [x, y] of [[0.18, 0.3], [0.5, 0.55], [0.74, 0.25], [0.3, 0.8]]) g.strokeRect(x * W - 4 * u, y * H - 4 * u, 98 * u, 62 * u);
  g.fillStyle = '#E8E6DC'; g.font = `500 ${28 * u}px ${MONO}`;
  g.fillText('SNT-EX1  REV B', 60 * u, H - 50 * u);
  return c;
}

/** Flat diagonal glass reflections on a transparent canvas (alpha only). */
function paintGlass() {
  const W = 512, H = 200, c = canvas(W, H), g = c.getContext('2d');
  const band = (pts, a) => fillPoly(g, pts.map(([x, y]) => [x * W, y * H]), `rgba(255,255,255,${a})`);
  band([[0.50, 0], [0.58, 0], [0.34, 1], [0.26, 1]], 0.2);
  band([[0.66, 0], [0.69, 0], [0.47, 1], [0.44, 1]], 0.09);
  return c;
}

/* ------------------------------------------------------------ geometry helpers */
const _m = new THREE.Matrix4(), _b = new THREE.Box3();

/** Union of the geometry bounds of every mesh under `obj` (instances included), in obj's parent space. */
function boxOf(obj) {
  obj.updateMatrixWorld(true);
  const out = new THREE.Box3();
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const gb = o.geometry.boundingBox ?? (o.geometry.computeBoundingBox(), o.geometry.boundingBox);
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, _m);
        _b.copy(gb).applyMatrix4(_m.premultiply(o.matrixWorld));
        out.union(_b);
      }
    } else {
      out.union(_b.copy(gb).applyMatrix4(o.matrixWorld));
    }
  });
  return out;
}

function instanced(geo, mat, positions, { cast = true, receive = true } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, positions.length);
  positions.forEach(([x, y, z], i) => mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, z)));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = cast; mesh.receiveShadow = receive;
  return mesh;
}

/* ------------------------------------------------------------ model */
export class DeviceModel {
  constructor({ texRes = 2048, anisotropy = 8 } = {}) {
    this.group = new THREE.Group();          // scaled/rotated by the site
    this.lastExplode = -1;
    this._mats = [];
    this._texs = [];

    const tex = (c, srgb = true) => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = anisotropy;
      this._texs.push(t);
      return t;
    };
    const mat = (cls, opts) => { const m = new cls(opts); this._mats.push(m); return m; };
    const std = (opts) => mat(THREE.MeshStandardMaterial, opts);
    const phys = (opts) => mat(THREE.MeshPhysicalMaterial, opts);

    const lcdTex = tex(painted(`lcd${texRes}`, () => paintLcd(texRes / 2)));
    const plateTex = tex(painted(`plate${texRes}`, () => paintPlate(Math.round(texRes * 0.625))));
    const pcbTex = tex(painted(`pcb${texRes}`, () => paintPcb(texRes / 2)));
    const glassTex = tex(painted('glass', paintGlass));

    const coat = phys({ color: COAT, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.4 });
    const stainless = std({ color: 0xd9dde2, metalness: 1, roughness: 0.3 });
    const nickel = std({ color: 0xb8bec6, metalness: 1, roughness: 0.35 });
    const rubber = std({ color: 0x2b3036, roughness: 0.55 });
    const socket = std({ color: 0x111316, roughness: 0.6 });
    const counterbore = std({ color: 0x0c0e10, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const chip = std({ color: 0x191c20, roughness: 0.5 });
    const pcb = std({ map: pcbTex, roughness: 0.5 });
    const lcd = std({ map: lcdTex, emissiveMap: lcdTex, emissive: 0xffffff, emissiveIntensity: 0.22, roughness: 0.5, envMapIntensity: 0.5 });
    const plate = std({ map: plateTex, metalness: 0.1, roughness: 0.55, envMapIntensity: 0.6 });
    const glass = phys({ color: 0xffffff, map: glassTex, transparent: true, depthWrite: false, roughness: 0.05, metalness: 0, envMapIntensity: 0.6 });

    // Housing: open-front tube, closed back plate, two wall-mount lugs behind the back face.
    const bodyShape = rrPath(new THREE.Shape(), 127, 87, 7, 0, 0);
    bodyShape.holes.push(rrPath(new THREE.Path(), 117, 77, 4, 0, 0));
    const tube = new THREE.Mesh(extrudeY(bodyShape, BODY_Y), coat);
    const back = new THREE.Mesh(new RoundedBoxGeometry(127, 4, 87, 3, 6), coat);
    back.position.set(0, -28, 0);
    const lugs = [-1, 1].map((sign) => {
      const s = rrPath(new THREE.Shape(), 22, 40, 6, sign * 63, 0);
      s.holes.push(new THREE.Path().absarc(sign * 63, 0, 3.2, 0, Math.PI * 2, true));
      return new THREE.Mesh(extrudeY(s, [-34, -30], 0.8), coat);
    });
    const shell = new THREE.Group();
    shell.add(tube, back, ...lugs);
    for (const m of [tube, back, ...lugs]) { m.castShadow = true; m.receiveShadow = true; }

    // Front lid: window cut-out, LCD behind glass, nameplate, four flush screws in counterbores.
    const lidShape = rrPath(new THREE.Shape(), 121, 81, 6, 0, 0);
    lidShape.holes.push(rrPath(new THREE.Path(), WINDOW.w, WINDOW.h, 3, 0, -WINDOW.cz));
    const lidMesh = new THREE.Mesh(extrudeY(lidShape, LID_Y), coat);
    lidMesh.castShadow = lidMesh.receiveShadow = true;
    const lcdMesh = new THREE.Mesh(faceUp(78, 30), lcd);
    lcdMesh.position.set(0, 24, WINDOW.cz);
    const glassMesh = new THREE.Mesh(faceUp(79, 31), glass);
    glassMesh.position.set(0, 29.6, WINDOW.cz);
    glassMesh.renderOrder = 2;
    const plateMesh = new THREE.Mesh(faceUp(PLATE.w, PLATE.h), plate);
    plateMesh.position.set(0, 30.25, PLATE.cz);
    plateMesh.receiveShadow = true;
    const screwPos = [[-SCREW.x, -SCREW.z], [SCREW.x, -SCREW.z], [-SCREW.x, SCREW.z], [SCREW.x, SCREW.z]];
    // Head top sits 0.04 above the lid face (flush); a dark ring around it reads as a counterbore.
    const heads = instanced(new THREE.CylinderGeometry(2.6, 2.6, 0.4, 28), stainless, screwPos.map(([x, z]) => [x, 29.84, z]));
    const rings = instanced(new THREE.RingGeometry(2.7, 3.3, 32).rotateX(-Math.PI / 2), counterbore, screwPos.map(([x, z]) => [x, 30.05, z]), { cast: false, receive: false });
    const sockets = instanced(new THREE.CylinderGeometry(1.1, 1.1, 0.5, 6), socket, screwPos.map(([x, z]) => [x, 30.1, z]), { cast: false });
    const lidGroup = new THREE.Group();
    lidGroup.add(lidMesh, lcdMesh, glassMesh, plateMesh, heads, rings, sockets);

    // Electronics inside the housing (seen when the lid lifts).
    const pcbMesh = new THREE.Mesh(new THREE.BoxGeometry(108, 1.6, 70), pcb);
    pcbMesh.position.set(0, -22.2, 0);
    pcbMesh.receiveShadow = true;
    const standoffs = instanced(new THREE.CylinderGeometry(2, 2, 3, 14), nickel, [[-48, -24.5, -28], [48, -24.5, -28], [-48, -24.5, 28], [48, -24.5, 28]]);
    const chips = instanced(new THREE.BoxGeometry(7, 2, 7), chip, CHIPS.map(([x, z]) => [x, -20.4, z]));
    const pcbGroup = new THREE.Group();
    pcbGroup.add(pcbMesh, standoffs, chips);

    // Antenna on top: nickel boss and a rubber whip.
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 4, 24).rotateX(Math.PI / 2), nickel);
    boss.position.set(0, DEVICE_Y, TOP_Z - 2);
    const whip = new THREE.Mesh(new THREE.LatheGeometry(ANTENNA.map(([r, y]) => new THREE.Vector2(r, y)), 28).rotateX(-Math.PI / 2), rubber);
    whip.position.set(0, DEVICE_Y, TOP_Z - 4);
    boss.castShadow = whip.castShadow = true;
    const antGroup = new THREE.Group();
    antGroup.add(boss, whip);

    // Two M20 cable glands on the bottom face: hex lock nut, dome cap, cable sleeve.
    const gx = [-GLAND_X, GLAND_X].map((x) => [x, DEVICE_Y, 0]);
    const nuts = instanced(new THREE.CylinderGeometry(7.5, 7.5, 5, 6).rotateX(Math.PI / 2), nickel, gx.map(([x, y]) => [x, y, BOTTOM_Z + 2.5]));
    const domes = instanced(new THREE.LatheGeometry(GLAND_DOME.map(([r, y]) => new THREE.Vector2(r, y)), 28).rotateX(Math.PI / 2), nickel, gx.map(([x, y]) => [x, y, BOTTOM_Z + 5]));
    const sleeves = instanced(new THREE.CylinderGeometry(3.6, 3.6, 8, 20).rotateX(Math.PI / 2), rubber, gx.map(([x, y]) => [x, y, BOTTOM_Z + 10]));
    const glandGroup = new THREE.Group();
    glandGroup.add(nuts, domes, sleeves);

    // Assemble in raw space (every part at explode 0), take one tight box per part, then re-centre.
    this.root = new THREE.Group();
    this.lidGroup = lidGroup;
    this.pcbGroup = pcbGroup;
    this.root.add(shell, lidGroup, pcbGroup, antGroup, glandGroup);
    this.group.add(this.root);
    this.root.traverse((o) => { o.frustumCulled = false; });

    // Each part: its box at explode 0 and the displacement it takes at explode 1.
    this.parts = [
      { box: boxOf(tube), slide: [0, 0, 0] },
      { box: boxOf(back), slide: [0, 0, 0] },
      { box: boxOf(lugs[0]), slide: [0, 0, 0] },
      { box: boxOf(lugs[1]), slide: [0, 0, 0] },
      { box: boxOf(lidGroup), slide: LID_SLIDE },
      { box: boxOf(pcbGroup), slide: [0, PCB_LIFT, 0] },
      { box: boxOf(antGroup), slide: [0, 0, 0] },
      { box: boxOf(glandGroup), slide: [0, 0, 0] },
    ];
    const all = new THREE.Box3();
    for (const p of this.parts) all.union(p.box);
    this.center = all.getCenter(new THREE.Vector3());
    this.root.position.copy(this.center).negate();
    const corners = this.hull(0);
    let r2 = 0;
    for (let i = 0; i < corners.length; i += 3) r2 = Math.max(r2, corners[i] ** 2 + corners[i + 1] ** 2 + corners[i + 2] ** 2);
    this.radius = Math.sqrt(r2);
    this.setExplode(0);
  }

  /** Flat [x, y, z, ...] corners of every part's box at this explode amount, in centred model space. */
  hull(explode = 0) {
    const e = clamp01(explode), c = this.center, pts = [];
    for (const { box, slide } of this.parts) {
      const dx = slide[0] * e, dy = slide[1] * e, dz = slide[2] * e;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        pts.push(x + dx - c.x, y + dy - c.y, z + dz - c.z);
      }
    }
    return pts;
  }

  /** 0 = closed, 1 = lid slid clear of the opening and the board lifted into it. Cheap no-op when unchanged. */
  setExplode(e) {
    const v = clamp01(e);
    if (Math.abs(v - this.lastExplode) < 1e-4) return;
    this.lastExplode = v;
    this.lidGroup.position.set(LID_SLIDE[0] * v, LID_SLIDE[1] * v, LID_SLIDE[2] * v);
    this.pcbGroup.position.set(0, PCB_LIFT * v, 0);
  }

  dispose() {
    this.group.traverse((o) => { o.geometry?.dispose(); });
    for (const m of this._mats) m.dispose();
    for (const t of this._texs) t.dispose();
    this._mats = []; this._texs = [];
  }
}
