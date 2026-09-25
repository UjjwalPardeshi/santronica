/*
 * 3D component library. Builds instanced "kinds" (shared geometry + material)
 * and one instance record per visible piece, all in board-model space:
 * the board lies in X–Z, component side +Y, board top surface at y = 0.8 mm.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { PARTS, footprint, xf } from './layout.js';

const TOP = 0.8;
const V = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const deg = (d) => (d * Math.PI) / 180;

function mat4(x, y, z, rotY = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(V.set(x, y, z), Q.setFromAxisAngle(UP, deg(rotY)), S.set(sx, sy, sz));
}
/** Part frame: board (x, y) -> model (x, TOP, -y), rotated CCW by part.rot about +Y. */
const partFrame = (p) => mat4(p.x, TOP, -p.y, p.rot || 0);
/** Local offset inside a part: board-local (lx, ly), height h above the board top. */
const at = (lx, ly, h, rotY = 0, sx = 1, sy = 1, sz = 1) => mat4(lx, h, -ly, rotY, sx, sy, sz);

/* ------------------------------------------------------------- materials */
function std(color, roughness, metalness = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}
export function createMaterials() {
  return {
    epoxy: std(0x1a1a1c, 0.58),
    tin: std(0xcfd2d5, 0.32, 1),
    solder: std(0xcfd2d4, 0.16, 1),
    gold: std(0xe6bd62, 0.2, 1),
    nickel: std(0xc4c8cc, 0.3, 1),
    alu: std(0xc9cdd1, 0.34, 1),
    ceramic: std(0xffffff, 0.55),
    plastic: std(0x121213, 0.45),
    term: std(0x2c6cc0, 0.42),
    ferrite: std(0x2c2d30, 0.72),
    beige: std(0xd8cfbd, 0.6),
    ledBody: std(0xefebe2, 0.35),
    lens: std(0xffffff, 0.12, 0, { transparent: true, opacity: 0.92 }),
    modPcb: std(0xffffff, 0.42),
    dark: std(0x070707, 0.85),
    marks: std(0xffffff, 0.6, 0, { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    ecapTop: std(0xffffff, 0.35, 0, { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  };
}

/* ------------------------------------------------------------ geometries */
/** Gull-wing lead pointing +X from a body edge at x = 0; foot rests on y = 0. */
function gullWing({ t, yTop, shoulder, drop, foot, width }) {
  const s = new THREE.Shape();
  const x1 = shoulder, x2 = shoulder + drop, x3 = x2 + foot;
  s.moveTo(-0.05, yTop + t / 2);
  s.lineTo(x1, yTop + t / 2);
  s.quadraticCurveTo(x1 + t * 0.6, yTop + t / 2, x1 + t * 0.7, yTop);
  s.lineTo(x2 - t * 0.2, t * 1.2);
  s.quadraticCurveTo(x2, t, x2 + t, t);
  s.lineTo(x3, t);
  s.lineTo(x3, 0);
  s.lineTo(x2 + t * 0.2, 0);
  s.quadraticCurveTo(x2 - t * 0.9, 0, x2 - t * 0.9, t * 0.8);
  s.lineTo(x1 - t * 0.2, yTop - t / 2);
  s.lineTo(-0.05, yTop - t / 2);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -width / 2);
  return g;
}

/** Solder fillet: a wedge rising from the pad (x in [0,1]) to the termination face (x = 0). */
function wedge() {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(1, 0); s.quadraticCurveTo(0.25, 0.25, 0, 1); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 5 });
  g.translate(0, 0, -0.5);
  return g;
}

function stadium(w, h) {
  const r = h / 2, s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -r); s.lineTo(w / 2 - r, -r); s.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-w / 2 + r, r); s.absarc(-w / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  return s;
}

function usbShell() {
  const outer = stadium(8.94, 3.26), inner = stadium(8.34, 2.66);
  outer.holes.push(new THREE.Path(inner.getPoints(24).reverse()));
  const g = new THREE.ExtrudeGeometry(outer, { depth: 7.35, bevelEnabled: false, curveSegments: 16 });
  g.rotateY(Math.PI / 2);          // extrusion axis -> +X (opening at x = 0 faces -X)
  g.translate(-3.475, 1.63, 0);
  return g;
}
function usbBack() {
  const g = new THREE.ShapeGeometry(stadium(8.94, 3.26), 16);
  g.rotateY(Math.PI / 2);
  g.translate(3.875, 1.63, 0);
  return g;
}

function ecapCan() {
  const pts = [[0, 5.9], [2.5, 5.9], [2.95, 5.84], [3.12, 5.66], [3.15, 5.3], [3.15, 4.75], [2.98, 4.6], [3.15, 4.45], [3.15, 1.2], [3.05, 1.02], [0, 1.02]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, 48);
}

export function createGeometries() {
  return {
    lqfp: new RoundedBoxGeometry(10, 1.4, 10, 2, 0.22),
    soic: new RoundedBoxGeometry(4.9, 1.45, 3.9, 2, 0.18),
    qfn: new RoundedBoxGeometry(5, 0.85, 5, 2, 0.06),
    sot: new RoundedBoxGeometry(2.9, 1.0, 1.3, 2, 0.12),
    sot5: new RoundedBoxGeometry(2.9, 1.0, 1.6, 2, 0.12),
    sod: new RoundedBoxGeometry(2.7, 1.05, 1.6, 2, 0.16),
    leadQfp: gullWing({ t: 0.15, yTop: 0.72, shoulder: 0.18, drop: 0.37, foot: 0.45, width: 0.22 }),
    leadSoic: gullWing({ t: 0.2, yTop: 0.82, shoulder: 0.2, drop: 0.38, foot: 0.47, width: 0.42 }),
    leadSot: gullWing({ t: 0.13, yTop: 0.5, shoulder: 0.08, drop: 0.2, foot: 0.27, width: 0.4 }),
    box: new THREE.BoxGeometry(1, 1, 1),
    fillet: wedge(),
    xtalLid: new RoundedBoxGeometry(4.5, 0.75, 2.7, 2, 0.14),
    inductor: new RoundedBoxGeometry(6, 3, 6, 3, 0.6),
    ecapBase: new RoundedBoxGeometry(6.6, 1.0, 6.6, 2, 0.35),
    ecapCan: ecapCan(),
    disc: new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2),
    usbShell: usbShell(),
    usbBack: usbBack(),
    hdrBody: new RoundedBoxGeometry(25.4, 2.5, 5.08, 2, 0.18),
    termBody: new RoundedBoxGeometry(10.16, 10, 8, 3, 0.35),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 28),
    can: new RoundedBoxGeometry(16, 2.2, 17.6, 2, 0.28),
    modPcb: new THREE.BoxGeometry(18, 0.8, 25.5),
    plane: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    plate: new RoundedBoxGeometry(5.4, 0.25, 5.4, 2, 0.1),
    tube: new THREE.CylinderGeometry(1, 1, 1, 32, 1, true),
    cone: new THREE.ConeGeometry(1, 1, 20),
  };
}

/* ------------------------------------------------------------ instancing */
// Explode heights (mm) per part family: bigger parts lift higher, like an exploded product view.
const LIFT = { lqfp64: 26, soic8: 18, qfn32: 17, sot23: 13, sot23_5: 13, sod123: 13, xtal5032: 19, ind6060: 24, ecap63: 32, usbc: 21, term2: 30, hdr2x10: 27, rfmod: 17, tact: 20, led0603: 12, r1206: 13, chip0402: 10, chip0603: 11, chip1206: 13 };
const CAP_COLORS = [0xb89d72, 0xa8875c, 0xc2ad86, 0x9c8a6e, 0x8d7a60];

/** Mark cells in the 4x4 marking atlas (index -> part id). */
export const MARK_CELLS = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'L1', 'Y1', 'M1'];

export function buildInstances() {
  const list = [];   // { kind, m, part, liftMul, color, cell }
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  PARTS.forEach((p, part) => {
    const F = partFrame(p), fp = footprint(p);
    const add = (kind, local, extra = {}) => list.push({ kind, m: F.clone().multiply(local), part, liftMul: 1, ...extra });
    const leads = (kind, bw, bh) => {
      for (const pad of fp.pads) {
        if (pad.epad) continue;
        if (Math.abs(pad.x) > bw / 2) add(kind, at(Math.sign(pad.x) * bw / 2, pad.y, 0, pad.x > 0 ? 0 : 180));
        else add(kind, at(pad.x, Math.sign(pad.y) * bh / 2, 0, pad.y > 0 ? 90 : -90));
      }
    };
    const mark = (w, d, h) => { const cell = MARK_CELLS.indexOf(p.id); if (cell >= 0) add('marks', at(0, 0, h + 0.02, 0, w, 1, d), { cell }); };

    switch (p.type) {
      case 'lqfp64': add('lqfp', at(0, 0, 0.8)); leads('leadQfp', 10, 10); mark(10, 10, 1.5); break;
      case 'soic8': add('soic', at(0, 0, 0.88)); leads('leadSoic', 4.9, 3.9); mark(4.9, 3.9, 1.605); break;
      case 'qfn32': add('qfn', at(0, 0, 0.45)); mark(5, 5, 0.875); break;
      case 'sot23': add('sot', at(0, 0, 0.6)); leads('leadSot', 2.9, 1.3); break;
      case 'sot23_5': add('sot5', at(0, 0, 0.6)); leads('leadSot', 2.9, 1.6); break;
      case 'sod123':
        add('sod', at(0, 0, 0.58));
        add('tin', at(-1.45, 0, 0.1, 0, 0.5, 0.12, 0.9)); add('tin', at(1.45, 0, 0.1, 0, 0.5, 0.12, 0.9));
        add('dark', at(-0.95, 0, 1.105, 0, 0.3, 0.01, 1.5));
        break;
      case 'xtal5032':
        add('beige', at(0, 0, 0.2, 0, 5, 0.35, 3.2)); add('xtalLid', at(0, 0, 0.72)); mark(4.5, 2.7, 1.1);
        break;
      case 'ind6060':
        add('inductor', at(0, 0, 1.52));
        add('tin', at(-2.55, 0, 0.12, 0, 0.9, 0.24, 4.6)); add('tin', at(2.55, 0, 0.12, 0, 0.9, 0.24, 4.6));
        mark(6, 6, 3.02);
        break;
      case 'ecap63':
        add('ecapBase', at(0, 0, 0.52)); add('ecapCan', at(0, 0, 0, 0));
        add('ecapTop', at(0, 0, 5.94, 0, 2.5, 1, 2.5));
        add('tin', at(-2.9, 0, 0.1, 0, 2.2, 0.18, 1.0)); add('tin', at(2.9, 0, 0.1, 0, 2.2, 0.18, 1.0));
        break;
      case 'usbc':
        add('usbShell', at(0, 0, 0)); add('usbBack', at(0, 0, 0));
        add('dark', at(-1.0, 0, 1.63, 0, 4.6, 0.72, 6.7));
        add('gold', at(-1.4, 0, 1.63, 0, 3.4, 0.74, 5.6));
        break;
      case 'term2':
        add('termBody', at(0, 0, 5.0));
        for (const sx of [-2.54, 2.54]) {
          add('dark', at(sx, -4.0, 3.4, 0, 3.4, 3.0, 0.06));
          add('dark', at(sx, 1.0, 10.02, 0, 3.0, 0.04, 3.0));
          add('nickelCyl', at(sx, 1.0, 10.02, 0, 1.2, 0.3, 1.2));
          add('dark', at(sx, 1.0, 10.18, 45, 2.0, 0.04, 0.3));
          add('solderCone', at(sx, 1.0, -2.0, 0, 1.05, 0.8, 1.05), { flip: true });
        }
        break;
      case 'hdr2x10':
        add('hdrBody', at(0, 0, 1.25));
        for (const pad of fp.pads) {
          add('pin', at(pad.x, pad.y, 2.3, 0, 0.64, 12.4, 0.64));
          add('solderCone', at(pad.x, pad.y, -2.0, 0, 0.9, 0.7, 0.9), { flip: true });
        }
        break;
      case 'rfmod':
        add('modPcb', at(0, 0, 0.42)); add('modTop', at(0, 0, 0.825, 0, 18, 1, 25.5));
        add('can', at(0, -3.4, 1.95), { liftMul: 1.8 }); mark(16, 17.6, 3.052);
        break;
      case 'tact':
        add('plastic', at(0, 0, 0.42, 0, 5.2, 0.84, 5.2)); add('plate', at(0, 0, 0.96));
        add('plasticCyl', at(0, 0, 1.4, 0, 1.65, 0.7, 1.65));
        for (const pad of fp.pads) add('tin', at(pad.x * 0.93, pad.y, 0.1, 0, 0.8, 0.2, 0.6));
        break;
      case 'led0603':
        add('ledBody', at(0, 0, 0.2, 0, 1.6, 0.36, 0.8));
        add('tin', at(-0.72, 0, 0.21, 0, 0.18, 0.4, 0.82)); add('tin', at(0.72, 0, 0.21, 0, 0.18, 0.4, 0.82));
        add('lens', at(0, 0, 0.5, 0, 1.1, 0.26, 0.66), { color: p.color });
        break;
      default: {
        // Chip passives (0402 / 0603 / 1206, resistors, capacitors, fuse)
        const [bw, bh] = fp.body, h = fp.h, tl = Math.min(0.35, bw * 0.24);
        const body = p.kind === 'r' || p.type === 'r1206' ? (p.fuse ? 0x2a4f8f : 0x161616) : CAP_COLORS[Math.floor(rnd() * CAP_COLORS.length)];
        add('ceramic', at(0, 0, h / 2 + 0.04, 0, bw - tl * 1.2, h, bh), { color: body });
        for (const sx of [-1, 1]) {
          add('tin', at(sx * (bw / 2 - tl / 2), 0, h / 2 + 0.04, 0, tl, h + 0.02, bh + 0.02));
          add('fillet', at(sx * bw / 2, 0, 0.02, sx > 0 ? 0 : 180, Math.max(0.22, bw * 0.2), h * 0.62, bh * 0.92));
        }
      }
    }
  });

  // Plated mounting-hole barrels (not part of any component)
  return list;
}

/** Explode lift for a part: centre-first ripple with smooth per-part easing. */
export function partLiftTable() {
  const maxD = Math.hypot(50, 32);
  return PARTS.map((p) => ({ h: LIFT[p.type] || 8, delay: 0.32 * (Math.hypot(p.x, p.y) / maxD) }));
}

export const PART_XF = xf;
