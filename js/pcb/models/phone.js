/*
 * Smartphone: bevelled satin-aluminium frame, flat glass front with a painted companion-app
 * screen, glass back with a two-lens camera plateau. Lies in the XZ plane, screen +Y,
 * top edge -Z. Explode floats the front glass off the frame and the back parts off the body.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';

const W = 71.5, H = 147, T = 7.8;   // body, mm
const R = 10;                       // plan corner radius of the body
const BEVEL = 0.9;                  // frame edge rounding
const GLASS_INSET = 0.5;            // glass outline sits this far inside the frame outline
const GLASS_W = W - 2 * GLASS_INSET, GLASS_H = H - 2 * GLASS_INSET, GLASS_R = R - GLASS_INSET;
const GLASS_BEVEL = 0.2;
const BEZEL_MM = 1.5;               // screen border inside the glass outline
const PLATEAU = { size: 30, r: 7, h: 1.3 };
const LENS_R = 6.2, LENS_GLASS_R = 4.9;

// Logical screen space, 390 units wide, matched to the glass aspect ratio.
const LW = 390, LH = 808;
const MM = LW / GLASS_W;                 // logical units per mm
const INSET = BEZEL_MM * MM;             // bezel width
const SCREEN_R = (GLASS_R - BEZEL_MM) * MM;  // concentric with the glass corner

const C = {
  bezel: '#0b0c0e', bg: '#F6F7F8', card: '#FFFFFF', ink: '#121417', muted: '#5E656D',
  hair: 'rgba(18,20,23,0.10)', graphite: '#2A2F36', silver: '#C9CFD6',
};
const SANS = '"Geist", "Helvetica Neue", Arial, sans-serif';
const MONO = '"Geist Mono", ui-monospace, "SFMono-Regular", Menlo, monospace';
// Smallest logical text size: about 10-11 px at hero height, still legible at 450 px.
const MONO_LABEL = 16;

/* ------------------------------------------------------------ 2D painting */

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function label(ctx, s, x, y, { font, color = C.ink, align = 'left', base = 'middle', ls = 0 } = {}) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.letterSpacing = `${ls}px`;
  ctx.fillText(s, x, y);
  ctx.letterSpacing = '0px';
}

function card(ctx, x, y, w, h, r = 22) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = C.card;
  ctx.fill();
  ctx.strokeStyle = 'rgba(18,20,23,0.06)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function hairline(ctx, x0, x1, y) {
  ctx.fillStyle = C.hair;
  ctx.fillRect(x0, y, x1 - x0, 1);
}

function drawStatus(ctx) {
  label(ctx, '10:24', 46, 31, { font: `600 17px ${SANS}`, color: C.ink });
  ctx.fillStyle = C.ink;
  [4, 7, 10, 13].forEach((h, i) => ctx.fillRect(296 + i * 5, 37 - h, 3.2, h));
  ctx.beginPath();
  ctx.moveTo(333, 37);
  ctx.arc(333, 37, 12, -Math.PI * 0.75, -Math.PI * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(18,20,23,0.45)';
  ctx.lineWidth = 1.3;
  rr(ctx, 346.5, 25.5, 22, 11, 3.2);
  ctx.stroke();
  ctx.fillStyle = C.ink;
  rr(ctx, 348.5, 27.5, 15, 7, 1.6);
  ctx.fill();
  ctx.fillStyle = 'rgba(18,20,23,0.45)';
  ctx.fillRect(369.5, 29.5, 1.8, 4);
  // Punch-hole camera
  ctx.fillStyle = C.bezel;
  ctx.beginPath();
  ctx.arc(195, 31, 7.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawHeader(ctx) {
  label(ctx, 'SANTRONICA CONNECT', 32, 70, { font: `600 ${MONO_LABEL}px ${MONO}`, color: C.muted, ls: 0.8 });
  label(ctx, 'Gateway SNT-RF24', 32, 102, { font: `600 26px ${SANS}`, color: C.ink, ls: -0.3 });
  rr(ctx, 280, 86, 82, 32, 16);
  ctx.fillStyle = C.card;
  ctx.fill();
  ctx.strokeStyle = 'rgba(18,20,23,0.14)';
  ctx.stroke();
  ctx.fillStyle = C.graphite;
  ctx.beginPath();
  ctx.arc(298, 102, 3.8, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, 'Online', 309, 102, { font: `600 15px ${SANS}`, color: C.ink });
}

function drawReading(ctx) {
  card(ctx, 16, 126, 358, 120);
  label(ctx, 'Temperature', 34, 152, { font: `500 18px ${SANS}`, color: C.muted });
  label(ctx, 'Updated just now', 356, 152, { font: `600 ${MONO_LABEL}px ${MONO}`, color: C.muted, align: 'right' });
  const num = '23.6';
  label(ctx, num, 32, 222, { font: `600 58px ${SANS}`, color: C.ink, base: 'alphabetic', ls: -1.2 });
  ctx.font = `600 58px ${SANS}`;
  ctx.letterSpacing = '-1.2px';
  const nw = ctx.measureText(num).width;
  ctx.letterSpacing = '0px';
  label(ctx, '°C', 36 + nw, 222, { font: `500 26px ${SANS}`, color: C.muted, base: 'alphabetic' });
}

function chartValues() {
  const N = 48, v = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    v.push(23.0 + 1.3 * Math.sin(t * Math.PI * 1.9 + 0.7) + 0.35 * Math.sin(t * Math.PI * 6.2));
  }
  v[N - 1] = 23.6;
  return v;
}

function drawChart(ctx) {
  card(ctx, 16, 260, 358, 232);
  const v = chartValues();
  const lo = Math.min(...v), hi = Math.max(...v);
  label(ctx, '24 h', 34, 286, { font: `500 18px ${SANS}`, color: C.muted });
  label(ctx, `MIN ${lo.toFixed(1)}  MAX ${hi.toFixed(1)}`, 356, 286, { font: `600 ${MONO_LABEL}px ${MONO}`, color: C.muted, align: 'right' });

  const top = 320, bottom = 424, x0 = 34, x1 = 354;
  const pLo = lo - 0.25, pHi = hi + 0.25;
  const yOf = (val) => bottom - ((val - pLo) / (pHi - pLo)) * (bottom - top);
  for (const gy of [top, (top + bottom) / 2, bottom]) hairline(ctx, x0, x1, gy);

  ctx.beginPath();
  v.forEach((val, i) => {
    const x = x0 + (i / (v.length - 1)) * (x1 - x0), y = yOf(val);
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  });
  ctx.strokeStyle = C.graphite;
  ctx.lineWidth = 3.4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  const ex = x1, ey = yOf(v[v.length - 1]);
  ctx.fillStyle = C.card;
  ctx.beginPath(); ctx.arc(ex, ey, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.graphite;
  ctx.beginPath(); ctx.arc(ex, ey, 3.8, 0, Math.PI * 2); ctx.fill();

  const ticks = [['00', x0, 'left'], ['12', (x0 + x1) / 2, 'center'], ['24', x1, 'right']];
  for (const [t, x, align] of ticks) label(ctx, t, x, 466, { font: `600 ${MONO_LABEL}px ${MONO}`, color: C.muted, align });
}

function chevron(ctx, x, y) {
  ctx.beginPath();
  ctx.moveTo(x - 2.5, y - 4.5); ctx.lineTo(x + 2, y); ctx.lineTo(x - 2.5, y + 4.5);
  ctx.strokeStyle = C.muted; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke();
}

function toggle(ctx, x, y, on) {
  rr(ctx, x, y - 11, 36, 22, 11);
  ctx.fillStyle = on ? C.graphite : C.silver;
  ctx.fill();
  ctx.fillStyle = C.card;
  ctx.beginPath();
  ctx.arc(on ? x + 25 : x + 11, y, 8.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawList(ctx) {
  card(ctx, 16, 506, 358, 178);
  const rows = [['Pressure', '1.02 bar'], ['Battery', '87 %'], ['Signal', '-61 dBm'], ['Auto-sync', null]];
  rows.forEach(([name, value], i) => {
    const cy = 536 + i * 40;
    label(ctx, name, 34, cy, { font: `500 18px ${SANS}`, color: C.ink });
    if (value) {
      label(ctx, value, 326, cy, { font: `600 ${MONO_LABEL}px ${MONO}`, color: C.muted, align: 'right' });
      chevron(ctx, 350, cy);
    } else {
      toggle(ctx, 320, cy, true);
    }
    if (i < rows.length - 1) hairline(ctx, 34, 354, cy + 20);
  });
}

function icon(ctx, kind, cx, cy, color) {
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (kind === 'home') {
    ctx.moveTo(cx - 7, cy + 0.5); ctx.lineTo(cx, cy - 6.5); ctx.lineTo(cx + 7, cy + 0.5);
    ctx.moveTo(cx - 5, cy - 0.5); ctx.lineTo(cx - 5, cy + 6.5); ctx.lineTo(cx + 5, cy + 6.5); ctx.lineTo(cx + 5, cy - 0.5);
    ctx.stroke();
  } else if (kind === 'chart') {
    ctx.fillRect(cx - 7, cy + 0.5, 3.4, 6); ctx.fillRect(cx - 1.7, cy - 3, 3.4, 9.5); ctx.fillRect(cx + 3.6, cy - 6.5, 3.4, 13);
  } else if (kind === 'sliders') {
    ctx.moveTo(cx - 7, cy - 5); ctx.lineTo(cx + 7, cy - 5);
    ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy);
    ctx.moveTo(cx - 7, cy + 5); ctx.lineTo(cx + 7, cy + 5);
    ctx.stroke();
    [[cx - 3, cy - 5], [cx + 3, cy], [cx - 1, cy + 5]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill(); });
  } else {
    ctx.arc(cx, cy - 3, 3.8, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy + 8, 6.5, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  }
}

function drawTabs(ctx) {
  rr(ctx, 46, 706, 298, 52, 26);
  ctx.fillStyle = C.card;
  ctx.fill();
  ctx.strokeStyle = 'rgba(18,20,23,0.12)';
  ctx.stroke();
  const kinds = ['home', 'chart', 'sliders', 'profile'];
  kinds.forEach((kind, i) => {
    const cx = 46 + 74.5 * (i + 0.5), cy = 732;
    if (i === 0) {
      ctx.fillStyle = C.graphite;
      ctx.beginPath(); ctx.arc(cx, cy, 19, 0, Math.PI * 2); ctx.fill();
      icon(ctx, kind, cx, cy, C.card);
    } else {
      icon(ctx, kind, cx, cy, C.muted);
    }
  });
  ctx.fillStyle = 'rgba(18,20,23,0.85)';
  rr(ctx, 135, 784, 120, 4.5, 2.25);
  ctx.fill();
}

function paintScreen(ctx) {
  ctx.fillStyle = C.bezel;
  ctx.fillRect(0, 0, LW, LH);
  rr(ctx, INSET, INSET, LW - 2 * INSET, LH - 2 * INSET, SCREEN_R);
  ctx.fillStyle = C.bg;
  ctx.fill();
  ctx.save();
  ctx.clip();
  drawStatus(ctx);
  drawHeader(ctx);
  drawReading(ctx);
  drawChart(ctx);
  drawList(ctx);
  drawTabs(ctx);
  ctx.restore();
}

function makeScreenTexture(texRes, anisotropy) {
  const h = texRes, w = Math.round((texRes * LW) / LH);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const s = h / LH;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  paintScreen(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

/* ------------------------------------------------------------- geometry */

function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = w / 2, y = h / 2, k = r;
  s.moveTo(-x + k, -y);
  s.lineTo(x - k, -y); s.absarc(x - k, -y + k, k, -Math.PI / 2, 0, false);
  s.lineTo(x, y - k); s.absarc(x - k, y - k, k, 0, Math.PI / 2, false);
  s.lineTo(-x + k, y); s.absarc(-x + k, y - k, k, Math.PI / 2, Math.PI, false);
  s.lineTo(-x, -y + k); s.absarc(-x + k, -y + k, k, Math.PI, Math.PI * 1.5, false);
  return s;
}

/* Rounded-rect slab in model orientation: outline in XZ, thickness along Y, centred on yc.
 * The outline is the footprint including the bevel (w x h, corner radius r). */
function slab(w, h, r, depth, bevel, yc, segs = 4) {
  const g = new THREE.ExtrudeGeometry(rrShape(w - 2 * bevel, h - 2 * bevel, r - bevel), {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: 0, bevelSegments: segs, curveSegments: 14,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, yc - depth / 2, 0);
  return g;
}

/* Front-glass UVs: the screen texture spans the glass outline, top edge at -Z. */
function planarUV(g, w, h) {
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (-p.getZ(i) + h / 2) / h);
  uv.needsUpdate = true;
}

/* Merge indexed geometries that share one material into a single BufferGeometry. */
function mergeGeometries(list) {
  const counts = list.map((g) => (g.index ? g.index.count : g.attributes.position.count));
  let nv = 0, ni = 0;
  for (let k = 0; k < list.length; k++) { nv += list[k].attributes.position.count; ni += counts[k]; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  list.forEach((g, k) => {
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    uv.set(g.attributes.uv.array, vo * 2);
    const ix = g.index;
    for (let i = 0; i < counts[k]; i++) idx[io + i] = (ix ? ix.getX(i) : i) + vo;
    vo += g.attributes.position.count;
    io += counts[k];
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingBox();
  return out;
}

/* Hull ring generators: each returns flat [x, y, z, ...] points for a part's box, lifted by dy.
 * Rounded outlines sample their arcs (0, 45, 90 deg per corner) so the hull follows the real
 * silhouette instead of the box corners; circular parts sample a circle. */
const boxRing = (box, dy) => {
  const pts = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y + dy, box.max.y + dy]) for (const z of [box.min.z, box.max.z]) pts.push(x, y, z);
  return pts;
};

function roundedRing(r) {
  return (box, dy) => {
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    const hw = (box.max.x - box.min.x) / 2, hh = (box.max.z - box.min.z) / 2;
    const yLo = box.min.y + dy, yHi = box.max.y + dy;
    const pts = [];
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      const a0 = sx > 0 ? (sz > 0 ? 0 : -Math.PI / 2) : (sz > 0 ? Math.PI / 2 : Math.PI);
      for (let k = 0; k <= 2; k++) {
        const a = a0 + (k * Math.PI) / 4;
        const x = cx + sx * (hw - r) + r * Math.cos(a), z = cz + sz * (hh - r) + r * Math.sin(a);
        pts.push(x, yLo, z, x, yHi, z);
      }
    }
    return pts;
  };
}

function circleRing(segs = 8) {
  return (box, dy) => {
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    const rad = (box.max.x - box.min.x) / 2;
    const yLo = box.min.y + dy, yHi = box.max.y + dy;
    const pts = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const x = cx + rad * Math.cos(a), z = cz + rad * Math.sin(a);
      pts.push(x, yLo, z, x, yHi, z);
    }
    return pts;
  };
}

const _lensMat = new THREE.Matrix4();

/* ----------------------------------------------------------------- model */

export class PhoneModel {
  constructor({ texRes = 2048, anisotropy = 8 } = {}) {
    this.group = new THREE.Group();   // transformed by the site
    this.body = new THREE.Group();    // centred on the hull by the constructor
    this.group.add(this.body);
    this.lastExplode = -1;
    this.geos = [];
    this.mats = [];
    this.texs = [];
    this.insts = [];
    this.parts = [];

    const track = (x, list) => { list.push(x); return x; };
    const geo = (g) => track(g, this.geos);
    const mat = (m) => track(m, this.mats);

    this.screenTex = track(makeScreenTexture(texRes, anisotropy), this.texs);

    const mFrame = mat(new THREE.MeshPhysicalMaterial({
      color: 0xb3bac3, metalness: 1, roughness: 0.3, envMapIntensity: 1.5, clearcoat: 0.2, clearcoatRoughness: 0.4,
    }));
    const mGlassF = mat(new THREE.MeshPhysicalMaterial({
      color: 0x7d7d7d, map: this.screenTex, emissiveMap: this.screenTex, emissive: 0xffffff, emissiveIntensity: 1.0,
      roughness: 0.1, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.25,
    }));
    const mGlassB = mat(new THREE.MeshPhysicalMaterial({ color: 0x313640, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 }));
    const mLensGlass = mat(new THREE.MeshPhysicalMaterial({ color: 0x0a1018, roughness: 0.05, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02 }));
    const mFlash = mat(new THREE.MeshStandardMaterial({ color: 0xe9e4d6, roughness: 0.35 }));
    const mDark = mat(new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.6 }));

    const boxOf = (g, x, y, z) => {
      g.computeBoundingBox();
      return g.boundingBox.clone().translate(new THREE.Vector3(x, y, z));
    };

    // A single mesh. `ring` maps its box to hull points; `lift` is the explode travel in mm.
    const add = (g, m, x, y, z, { lift = 0, cast = true, recv = true, ring = boxRing } = {}) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = cast;
      mesh.receiveShadow = recv;
      mesh.frustumCulled = false;
      this.body.add(mesh);
      this.parts.push({ box: boxOf(g, x, y, z), y0: y, lift, ring, apply: (yy) => { mesh.position.y = yy; } });
      return mesh;
    };

    // Several copies of one geometry drawn in a single InstancedMesh.
    const addInst = (g, m, xs, y, zs, { lift = 0, cast = true, recv = true, ring = boxRing } = {}) => {
      const im = new THREE.InstancedMesh(g, m, xs.length);
      im.castShadow = cast;
      im.receiveShadow = recv;
      im.frustumCulled = false;
      this.body.add(im);
      this.insts.push(im);
      xs.forEach((x, i) => {
        const z = zs[i];
        const apply = (yy) => {
          im.setMatrixAt(i, _lensMat.makeTranslation(x, yy, z));
          im.instanceMatrix.needsUpdate = true;
        };
        apply(y);
        this.parts.push({ box: boxOf(g, x, y, z), y0: y, lift, ring, apply });
      });
      return im;
    };

    // Frame: bevelled satin aluminium band, full footprint W x H.
    add(geo(slab(W, H, R, T - 2 * BEVEL, BEVEL, 0, 6)), mFrame, 0, 0, 0, { ring: roundedRing(R) });

    // Front glass: flat, slightly proud of the frame, painted screen on top.
    const gF = geo(slab(GLASS_W, GLASS_H, GLASS_R, 0.75, GLASS_BEVEL, T / 2 - 0.325, 3));
    planarUV(gF, GLASS_W, GLASS_H);
    add(gF, mGlassF, 0, 0, 0, { lift: 3.5, cast: false, ring: roundedRing(GLASS_R) });

    // Back glass plus the camera plateau, its two lenses and the flash. The plateau sits on the
    // +X side, top edge up when viewed from the back.
    const backY = -T / 2 + 0.325;
    add(geo(slab(GLASS_W, GLASS_H, GLASS_R, 0.75, GLASS_BEVEL, backY, 3)), mGlassB, 0, 0, 0, {
      lift: -1.6, cast: false, ring: roundedRing(GLASS_R),
    });
    const pl = { x: W / 2 - 4 - PLATEAU.size / 2, z: -H / 2 + 4 + PLATEAU.size / 2 };
    const plateauY = -T / 2 - 0.25 - PLATEAU.h / 2;
    add(geo(slab(PLATEAU.size, PLATEAU.size, PLATEAU.r, PLATEAU.h - 0.6, 0.3, plateauY, 4)), mFrame, pl.x, 0, pl.z, {
      lift: -1.6, ring: roundedRing(PLATEAU.r),
    });
    const plateauTop = plateauY - PLATEAU.h / 2;
    const lensXs = [pl.x + 5.2, pl.x - 5.2], lensZs = [pl.z - 5.2, pl.z + 5.2];
    addInst(geo(new THREE.CylinderGeometry(LENS_R, LENS_R, 0.9, 56)), mFrame, lensXs, plateauTop - 0.45, lensZs, {
      lift: -1.6, ring: circleRing(12),
    });
    addInst(geo(new THREE.CylinderGeometry(LENS_GLASS_R, LENS_GLASS_R, 0.2, 48)), mLensGlass, lensXs, plateauTop - 0.9, lensZs, {
      lift: -1.6, cast: false, ring: circleRing(12),
    });
    add(geo(new THREE.CylinderGeometry(1.4, 1.4, 0.3, 24)), mFlash, pl.x - 7.5, plateauTop - 0.15, pl.z - 7.5, {
      lift: -1.6, cast: false, ring: circleRing(8),
    });

    // Side keys: volume (left) and power (right), merged into one mesh. Each key keeps its own
    // hull box, and the merged mesh does not move on explode.
    const keySpecs = [[-W / 2 - 0.2, -H / 2 + 36, 7.5], [-W / 2 - 0.2, -H / 2 + 48, 7.5], [W / 2 + 0.2, -H / 2 + 40, 12]];
    const keyGeos = keySpecs.map(([x, z, len]) => {
      const g = new RoundedBoxGeometry(0.9, 2.0, len, 2, 0.4);
      g.translate(x, 0.6, z);
      g.computeBoundingBox();
      return g;
    });
    const keyMesh = new THREE.Mesh(geo(mergeGeometries(keyGeos)), mFrame);
    keyMesh.castShadow = true;
    keyMesh.receiveShadow = true;
    keyMesh.frustumCulled = false;
    this.body.add(keyMesh);
    for (const g of keyGeos) this.parts.push({ box: g.boundingBox.clone(), y0: 0, lift: 0, ring: boxRing, apply: () => {} });
    keyGeos.forEach((g) => g.dispose());

    // Bottom port recess.
    add(geo(new RoundedBoxGeometry(11, 2.4, 1.4, 2, 1.0)), mDark, 0, 0, H / 2 - 0.5, { cast: false, recv: false });

    // Centre the hull on the origin: the offset applies to the whole body group.
    const raw = this._hullRaw(0);
    let lo = Infinity, hi = -Infinity;
    for (let i = 1; i < raw.length; i += 3) { lo = Math.min(lo, raw[i]); hi = Math.max(hi, raw[i]); }
    this.body.position.y = -(lo + hi) / 2;
    const pts0 = this.hull(0);
    let rad = 0;
    for (let i = 0; i < pts0.length; i += 3) rad = Math.max(rad, Math.hypot(pts0[i], pts0[i + 1], pts0[i + 2]));
    this.radius = rad;
    this.setExplode(0);
  }

  /** Raw hull points in body space (before the centring offset). */
  _hullRaw(explode) {
    const pts = [];
    for (const p of this.parts) {
      const ring = p.ring(p.box, p.lift * explode);
      for (let i = 0; i < ring.length; i++) pts.push(ring[i]);
    }
    return pts;
  }

  /** Points (model-space mm, flat [x, y, z, ...]) enclosing the phone at this explode amount. */
  hull(explode = 0) {
    const raw = this._hullRaw(explode), oy = this.body.position.y;
    for (let i = 1; i < raw.length; i += 3) raw[i] += oy;
    return raw;
  }

  /** 0 = assembled, 1 = glass lifted 3.5 mm and back parts dropped 1.6 mm. Cheap no-op when unchanged. */
  setExplode(e) {
    e = Math.min(1, Math.max(0, e));
    if (Math.abs(e - this.lastExplode) < 1e-4) return;
    this.lastExplode = e;
    for (const p of this.parts) p.apply(p.y0 + p.lift * e);
  }

  dispose() {
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
    this.texs.forEach((t) => t.dispose());
    this.insts.forEach((im) => im.dispose());
    this.group.clear();
  }
}
