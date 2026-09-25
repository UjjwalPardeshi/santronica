/*
 * Board design data — the single source of truth for the 3D parts (parts.js)
 * and the procedural copper/mask/silkscreen textures (textures.js).
 *
 * Units: millimetres. Board coordinates: origin at the board centre, +x right,
 * +y up (as seen from the component side). Part rotation `rot` is in degrees,
 * counter-clockwise in board coordinates.
 */

export const BOARD = {
  w: 100, h: 64, t: 1.6, corner: 3,
  holes: [[-45.5, 27.5], [45.5, 27.5], [-45.5, -27.5], [45.5, -27.5]],
  drill: 3.2, ring: 6.2,
};

const rad = (d) => (d * Math.PI) / 180;

/** Part-local point -> board coordinates. */
export function xf(p, lx, ly) {
  const a = rad(p.rot || 0), c = Math.cos(a), s = Math.sin(a);
  return [p.x + lx * c - ly * s, p.y + lx * s + ly * c];
}

/* ------------------------------------------------------------------ parts */
// type, designator, position, rotation, optional marking / value
export const PARTS = [
  { id: 'U1', type: 'lqfp64', x: -6, y: 2, rot: 0, mark: ['SNT32', 'H743 VIT6', '2438 A'] },
  { id: 'U2', type: 'soic8', x: 8.5, y: 15.5, rot: 0, mark: ['25Q64', 'JVSIQ'] },
  { id: 'U3', type: 'soic8', x: -29, y: 12, rot: 0, mark: ['CH340', 'E2431'] },
  { id: 'U4', type: 'soic8', x: -37, y: -12, rot: 90, mark: ['MP2359', 'A24'] },
  { id: 'U5', type: 'qfn32', x: 10, y: -7, rot: 0, mark: ['PHY', '8720'] },
  { id: 'U6', type: 'soic8', x: 39, y: -5, rot: 90, mark: ['ISO7721', '24W'] },
  { id: 'U7', type: 'sot23_5', x: -19.5, y: -15, rot: 0 },
  { id: 'D1', type: 'sot23', x: -38.5, y: 19.3, rot: 0 },
  { id: 'Q1', type: 'sot23', x: -15.5, y: 20.5, rot: 0 },
  { id: 'Q2', type: 'sot23', x: -11.5, y: 20.5, rot: 0 },
  { id: 'Y1', type: 'xtal5032', x: -6, y: 12.8, rot: 0 },
  { id: 'L1', type: 'ind6060', x: -27.5, y: -12.5, rot: 0 },
  { id: 'C1', type: 'ecap63', x: -45, y: -16, rot: 90 },
  { id: 'C2', type: 'ecap63', x: -20.5, y: -25.2, rot: 0 },
  { id: 'J1', type: 'usbc', x: -46.6, y: 14, rot: 0 },
  { id: 'J2', type: 'term2', x: -36, y: -27.2, rot: 0 },
  { id: 'J3', type: 'hdr2x10', x: 22, y: -26, rot: 0 },
  { id: 'M1', type: 'rfmod', x: 32, y: 19.25, rot: 0 },
  { id: 'SW1', type: 'tact', x: -1.5, y: -25.2, rot: 0 },
  { id: 'D5', type: 'led0603', x: 0.5, y: 27.6, rot: 0, color: 0x3ddc84 },
  { id: 'D6', type: 'led0603', x: 3.7, y: 27.6, rot: 0, color: 0xffb020 },
  { id: 'D7', type: 'led0603', x: 6.9, y: 27.6, rot: 0, color: 0x00b4d8 },
  // Intrinsic-safety barrier channel: zener clamps, current-limit resistors, fuse
  { id: 'D2', type: 'sod123', x: 25.5, y: -1, rot: 0 },
  { id: 'D3', type: 'sod123', x: 25.5, y: -5, rot: 0 },
  { id: 'D4', type: 'sod123', x: 25.5, y: -9, rot: 0 },
  { id: 'R1', type: 'r1206', x: 31.5, y: -1, rot: 0 },
  { id: 'R2', type: 'r1206', x: 31.5, y: -5, rot: 0 },
  { id: 'R3', type: 'r1206', x: 31.5, y: -9, rot: 0 },
  { id: 'F1', type: 'r1206', x: 45, y: -1, rot: 90, fuse: true },
];

// Passives: [designator, package, x, y, rot, kind] (kind: c = ceramic cap, r = resistor)
const PASSIVES = [
  // U1 decoupling / support
  ['C3', '0402', -16.4, 1.3, 90, 'c', 'u'], ['C4', '0402', -17.8, -0.6, 0, 'c', 'l'], ['C5', '0402', -16.4, -2.6, 90, 'c', 'd'],
  ['C6', '0402', 2.3, -2.9, 90, 'c', 'd'], ['C7', '0402', 2.6, 7.7, 90, 'c', 'u'],
  ['C8', '0402', -9.6, -7.6, 0, 'c', 'l'], ['C9', '0402', -8.0, -7.6, 0, 'c'],
  ['C10', '0402', -10.8, 10.2, 0, 'c', 'l'], ['C11', '0402', -0.4, 9.2, 0, 'c', 'r'],
  ['C12', '0402', -10.1, 12.8, 90, 'c', 'u'], ['C13', '0402', -1.9, 13.4, 90, 'c', 'u'],
  // U2 / U3 / U5
  ['C14', '0402', 12.6, 15.5, 90, 'c', 'u'], ['R4', '0402', 4.4, 15.5, 90, 'r', 'u'],
  ['C15', '0402', -24.4, 12, 90, 'c', 'u'], ['C16', '0402', -33.6, 12, 90, 'c', 'd'],
  ['R5', '0402', -41.4, 19.8, 0, 'r'], ['R6', '0402', -41.4, 8.2, 0, 'r'],
  ['C17', '0402', 4.4, -7, 90, 'c', 'd'], ['C18', '0402', 15.6, -7, 90, 'c', 'd'], ['C19', '0402', 10, -12.4, 0, 'c', 'r'],
  ['R7', '0402', 15.0, -2.6, 90, 'r', 'u'], ['R8', '0402', 16.4, -2.6, 90, 'r', 'u'],
  // RF module
  ['C20', '0402', 28.5, 4.4, 0, 'c', 'l'], ['C21', '0402', 33.5, 4.4, 0, 'c', 'l'], ['C22', '0603', 38, 4.4, 0, 'c', 'r'],
  // power
  ['C23', '1206', -27.5, -18.6, 0, 'c'], ['C24', '1206', -29.2, -6.4, 0, 'c', 'l'],
  ['R9', '0603', -33.2, -17.6, 90, 'r'], ['R10', '0603', -31.6, -17.6, 90, 'r'],
  ['C25', '0603', -16.6, -15, 90, 'c', 'u'], ['C26', '0603', -22.4, -15, 90, 'c', 'u'],
  ['C27', '0603', -40.6, -5.2, 90, 'c', 'u'],
  // IS barrier
  ['C28', '0603', 36.4, -9.8, 0, 'c', 'l'], ['C29', '0603', 41.6, -9.8, 0, 'c', 'r'],
  // LED resistors + misc
  ['R11', '0402', 0.5, 25.2, 90, 'r'], ['R12', '0402', 3.7, 25.2, 90, 'r'], ['R13', '0402', 6.9, 25.2, 90, 'r'],
  ['R14', '0402', -15.5, 17.4, 90, 'r'], ['R15', '0402', -11.5, 17.4, 90, 'r'],
  ['R16', '0402', -4.4, -21.4, 90, 'r', 'u'], ['C30', '0402', 1.6, -22.6, 90, 'c', 'd'],
];
// Series-termination resistors on the J3 bus, one per header column
for (let k = 0; k < 10; k++) PASSIVES.push([`RN${k + 1}`, '0603', 22 + (k - 4.5) * 2.54, -21.4, 90, 'r']);

for (const [id, pkg, x, y, rot, kind, stub] of PASSIVES) PARTS.push({ id, type: `chip${pkg}`, pkg, x, y, rot, kind, stub });

/* ------------------------------------------------------------- footprints */
// Every footprint returns part-local pads { x, y, w, h, shape, th, drill }, a body
// rectangle (for silkscreen + baked occlusion) and the body height in mm.
const CHIP = { '0402': [1.0, 0.5, 0.35, 0.5, 0.55, 0.48], '0603': [1.6, 0.8, 0.45, 0.8, 0.9, 0.8], '1206': [3.2, 1.6, 0.55, 1.1, 1.7, 1.5] };

function row(n, pitch, fn) {
  const out = [];
  for (let k = 0; k < n; k++) out.push(fn(k, (k - (n - 1) / 2) * pitch));
  return out;
}

export const FOOTPRINTS = {
  lqfp64: () => ({
    body: [10, 10], h: 1.6, pin1: [-4.2, 4.2],
    pads: [
      ...row(16, 0.5, (k, o) => ({ x: -5.75, y: -o, w: 1.5, h: 0.28 })),   // pins 1-16  (left, top->bottom)
      ...row(16, 0.5, (k, o) => ({ x: o, y: -5.75, w: 0.28, h: 1.5 })),    // pins 17-32 (bottom, left->right)
      ...row(16, 0.5, (k, o) => ({ x: 5.75, y: o, w: 1.5, h: 0.28 })),     // pins 33-48 (right, bottom->top)
      ...row(16, 0.5, (k, o) => ({ x: -o, y: 5.75, w: 0.28, h: 1.5 })),    // pins 49-64 (top, right->left)
    ],
  }),
  soic8: () => ({
    body: [4.9, 3.9], h: 1.6, pin1: [-1.9, -1.2],
    pads: [
      ...row(4, 1.27, (k, o) => ({ x: o, y: -2.7, w: 0.6, h: 1.55 })),
      ...row(4, 1.27, (k, o) => ({ x: -o, y: 2.7, w: 0.6, h: 1.55 })),
    ],
  }),
  qfn32: () => ({
    body: [5, 5], h: 0.9, pin1: [-2.0, 2.0],
    pads: [
      ...row(8, 0.5, (k, o) => ({ x: -2.4, y: -o, w: 0.8, h: 0.25 })),
      ...row(8, 0.5, (k, o) => ({ x: o, y: -2.4, w: 0.25, h: 0.8 })),
      ...row(8, 0.5, (k, o) => ({ x: 2.4, y: o, w: 0.8, h: 0.25 })),
      ...row(8, 0.5, (k, o) => ({ x: -o, y: 2.4, w: 0.25, h: 0.8 })),
      { x: 0, y: 0, w: 3.3, h: 3.3, epad: true },
    ],
  }),
  sot23: () => ({ body: [2.9, 1.3], h: 1.1, pads: [{ x: -0.95, y: -1.1, w: 0.6, h: 1.0 }, { x: 0.95, y: -1.1, w: 0.6, h: 1.0 }, { x: 0, y: 1.1, w: 0.6, h: 1.0 }] }),
  sot23_5: () => ({ body: [2.9, 1.6], h: 1.1, pads: [...row(3, 0.95, (k, o) => ({ x: o, y: -1.25, w: 0.6, h: 1.0 })), { x: 0.95, y: 1.25, w: 0.6, h: 1.0 }, { x: -0.95, y: 1.25, w: 0.6, h: 1.0 }] }),
  sod123: () => ({ body: [2.7, 1.6], h: 1.1, cathode: true, pads: [{ x: -1.65, y: 0, w: 0.9, h: 1.2 }, { x: 1.65, y: 0, w: 0.9, h: 1.2 }] }),
  xtal5032: () => ({ body: [5, 3.2], h: 1.1, pads: [{ x: -1.85, y: -1.05, w: 1.4, h: 1.1 }, { x: 1.85, y: -1.05, w: 1.4, h: 1.1 }, { x: 1.85, y: 1.05, w: 1.4, h: 1.1 }, { x: -1.85, y: 1.05, w: 1.4, h: 1.1 }] }),
  ind6060: () => ({ body: [6, 6], h: 3.0, pads: [{ x: -2.35, y: 0, w: 1.8, h: 5.2 }, { x: 2.35, y: 0, w: 1.8, h: 5.2 }] }),
  ecap63: () => ({ body: [6.6, 6.6], h: 5.8, polarity: true, pads: [{ x: -2.6, y: 0, w: 3.2, h: 1.6 }, { x: 2.6, y: 0, w: 3.2, h: 1.6 }] }),
  usbc: () => ({
    body: [7.35, 8.94], h: 3.26, bodyOffset: [0.2, 0],
    pads: [
      ...row(12, 0.5, (k, o) => ({ x: 3.6, y: o, w: 1.1, h: 0.3 })),
      { x: 2.4, y: 4.32, w: 1.8, h: 1.0, th: true, drill: 0.6, slot: true }, { x: 2.4, y: -4.32, w: 1.8, h: 1.0, th: true, drill: 0.6, slot: true },
      { x: -1.6, y: 4.32, w: 2.2, h: 1.0, th: true, drill: 0.6, slot: true }, { x: -1.6, y: -4.32, w: 2.2, h: 1.0, th: true, drill: 0.6, slot: true },
    ],
  }),
  term2: () => ({ body: [10.16, 8.0], h: 10.0, pads: row(2, 5.08, (k, o) => ({ x: o, y: 1.0, w: 2.4, h: 2.4, shape: 'round', th: true, drill: 1.3, sq: k === 0 })) }),
  hdr2x10: () => ({
    body: [25.4, 5.08], h: 2.5,
    pads: [
      ...row(10, 2.54, (k, o) => ({ x: o, y: 1.27, w: 1.7, h: 1.7, shape: 'round', th: true, drill: 1.0, sq: k === 0 })),
      ...row(10, 2.54, (k, o) => ({ x: o, y: -1.27, w: 1.7, h: 1.7, shape: 'round', th: true, drill: 1.0 })),
    ],
  }),
  rfmod: () => ({
    body: [18, 25.5], h: 3.1,
    pads: [
      ...row(12, 1.27, (k, o) => ({ x: -9, y: o - 4.6, w: 1.6, h: 0.9, castle: true })),
      ...row(12, 1.27, (k, o) => ({ x: 9, y: o - 4.6, w: 1.6, h: 0.9, castle: true })),
      ...row(8, 1.27, (k, o) => ({ x: o, y: -12.75, w: 0.9, h: 1.6, castle: true })),
    ],
  }),
  tact: () => ({ body: [5.2, 5.2], h: 1.6, pads: [{ x: -3.0, y: 1.85, w: 1.0, h: 0.8 }, { x: 3.0, y: 1.85, w: 1.0, h: 0.8 }, { x: -3.0, y: -1.85, w: 1.0, h: 0.8 }, { x: 3.0, y: -1.85, w: 1.0, h: 0.8 }] }),
  led0603: () => ({ body: [1.6, 0.8], h: 0.6, polarityDot: true, pads: [{ x: -0.8, y: 0, w: 0.8, h: 0.9 }, { x: 0.8, y: 0, w: 0.8, h: 0.9 }] }),
};
for (const pkg of Object.keys(CHIP)) {
  const [bw, bh, ht, pw, ph, px] = CHIP[pkg];
  FOOTPRINTS[`chip${pkg}`] = (p) => ({ body: [bw, bh], h: p.kind === 'c' && pkg !== '0402' ? ht * 1.6 : ht, pads: [{ x: -px, y: 0, w: pw, h: ph }, { x: px, y: 0, w: pw, h: ph }] });
}
FOOTPRINTS.r1206 = (p) => ({ body: [3.2, 1.6], h: 0.6, fuse: !!p.fuse, pads: [{ x: -1.5, y: 0, w: 1.1, h: 1.7 }, { x: 1.5, y: 0, w: 1.1, h: 1.7 }] });

export function footprint(p) {
  if (!p._fp) p._fp = FOOTPRINTS[p.type](p);
  return p._fp;
}

export const partById = (id) => PARTS.find((p) => p.id === id);

/** Board-space pad centre (and its outward end along the pad's long axis). */
export function padAt(id, i) {
  const p = partById(id), pad = footprint(p).pads[i];
  const [x, y] = xf(p, pad.x, pad.y);
  return { x, y, pad, part: p };
}

/* ---------------------------------------------------------------- routing */
export const TRACES = [];   // { pts: [[x, y], ...], w, layer: 'top' | 'bottom' }
export const VIAS = [];     // { x, y, d, drill, tented }

const tr = (pts, w = 0.2, layer = 'top') => TRACES.push({ pts, w, layer });
const via = (x, y, d = 0.6, tented = true) => VIAS.push({ x, y, d, drill: d * 0.5, tented });

// B1 — U1 right side -> RF module castellations (12 lanes, 45° fan with uniform spacing)
for (let i = 0; i < 12; i++) {
  const s = padAt('U1', 32 + 2 + i), e = padAt('M1', i);
  const x0 = s.x + 0.75, xe = e.x - 0.8, dy = e.y - s.y, x1 = xe - 1.0 - dy;
  tr([[x0, s.y], [x1, s.y], [x1 + dy, e.y], [xe, e.y]]);
}
// B2 — U1 bottom -> series resistors RN1..10 -> J3 top row (bus with two 45° bends)
for (let i = 0; i < 10; i++) {
  const s = padAt('U1', 16 + 6 + i);
  const rn = partById(`RN${i + 1}`);
  const hx = rn.x, yLane = -18.4 + i * 0.55, yA = yLane + 3.0, D = 2.0;
  tr([[s.x, s.y - 0.75], [s.x, yA], [s.x + 3.0, yLane], [hx - D, yLane], [hx, yLane - D], [hx, rn.y + 0.8]]);
  const hp = padAt('J3', i);
  tr([[hx, rn.y - 0.8], [hx, hp.y + 0.6]]);
}
// B3 — U1 top -> flash U2 bottom row (4 lanes)
for (let i = 0; i < 4; i++) {
  const s = padAt('U1', 48 + i), e = padAt('U2', 3 - i);
  const yh = 10.0 + i * 0.5, ye = e.y - 0.78 - 0.25, D = ye - yh;
  tr([[s.x, s.y + 0.75], [s.x, yh - 0.8], [s.x + 0.8, yh], [e.x - D, yh], [e.x, ye], [e.x, e.y - 0.78]]);
}
// Crystal
{
  const a = padAt('U1', 48 + 10), b = padAt('U1', 48 + 6), ya = padAt('Y1', 0), yb = padAt('Y1', 1);
  tr([[a.x, a.y + 0.75], [a.x, ya.y - 1.0], [ya.x, ya.y - 0.55]]);
  tr([[b.x, b.y + 0.75], [b.x, 9.6], [yb.x - 0.6, 9.6 + 0.9], [yb.x, yb.y - 0.55]]);
}
// B4 — U1 left -> U3 bottom row (4 lanes, left then up)
for (let i = 0; i < 4; i++) {
  const s = padAt('U1', i), e = padAt('U3', 3 - i);
  const ye = e.y - 0.78 - 0.1, d = ye - s.y, xt = e.x + d;
  tr([[s.x - 0.75, s.y], [xt, s.y], [e.x, ye], [e.x, e.y - 0.78]]);
}
// USB data pair -> U3 top row
{
  const dp = padAt('J1', 5), dn = padAt('J1', 6), u = [padAt('U3', 7), padAt('U3', 6)];
  const xs = dp.x + 0.55;
  tr([[xs, dn.y], [-35.5, dn.y], [-33, dn.y + 2.5], [u[1].x, dn.y + 2.5], [u[1].x, u[1].y + 0.78]], 0.22);
  tr([[xs, dp.y], [-35.0, dp.y], [-32.5, dp.y + 2.5], [u[0].x, dp.y + 2.5], [u[0].x, u[0].y + 0.78]], 0.22);
  const d1 = padAt('D1', 0), d2 = padAt('D1', 1);
  tr([[d1.x, d1.y - 0.5], [d1.x, dn.y]]);
  tr([[d2.x, d2.y - 0.5], [d2.x, 17.2]]); via(d2.x, 17.2);
  const r5 = padAt('R5', 1), r6 = padAt('R6', 1), c1 = padAt('J1', 4), c2 = padAt('J1', 7);
  tr([[c1.x + 0.55, c1.y], [-42.4, c1.y], [-42.4, r6.y + 0.8], [r6.x, r6.y]]);
  tr([[c2.x + 0.55, c2.y], [-42.0, c2.y], [-42.0, r5.y - 0.8], [r5.x, r5.y]]);
}
// Power: USB VBUS -> buck U4, terminal J2 -> C1/U4, U4 -> L1 -> C23/C24 -> LDO U7 -> C2
{
  const vb = padAt('J1', 1), u4 = padAt('U4', 4);
  tr([[vb.x + 0.55, vb.y], [-43.1, vb.y], [-43.1, -8.6], [-41.6, -10.1], [u4.x - 0.78, u4.y]], 0.8);
  const t1 = padAt('J2', 0), t2 = padAt('J2', 1);
  tr([[t1.x, t1.y], [t1.x, -22.3], [-41.24, -19.6], [-44.2, -19.6]], 1.0);
  tr([[t2.x, t2.y], [t2.x, -21.5], [-30.4, -21.5], [-28.6, -19.7]], 1.0);
  const sw = padAt('U4', 1), l1 = padAt('L1', 0), l2 = padAt('L1', 1), u7 = padAt('U7', 0), c2 = padAt('C2', 1);
  tr([[sw.x + 0.78, sw.y], [l1.x, sw.y], [l1.x, l1.y]], 0.9);
  tr([[l2.x, l2.y], [-23.2, l2.y], [-23.2, -9.6], [-20.4, -6.8], [-12.9, -6.8]], 0.8);
  tr([[l2.x, l2.y], [l2.x, -17.2], [u7.x - 0.95, -17.2], [u7.x - 0.95, u7.y - 0.5]], 0.6);
  tr([[u7.x + 0.95, u7.y - 0.5], [u7.x + 0.95, -20.2], [c2.x + 0.4, -20.2], [c2.x + 0.4, c2.y + 0.8]], 0.6);
}
// LEDs -> resistors -> MCU-side vias; transistor stubs
for (const [led, r] of [['D5', 'R11'], ['D6', 'R12'], ['D7', 'R13']]) {
  const a = padAt(led, 0), b = padAt(r, 1), c = padAt(r, 0);
  tr([[a.x, a.y], [a.x - 0.2, a.y], [b.x, b.y + 0.3]]);
  tr([[c.x, c.y], [c.x, c.y - 1.4]]); via(c.x, c.y - 1.4);
}
for (const q of ['Q1', 'Q2']) {
  const g = padAt(q, 2), r = padAt(q === 'Q1' ? 'R14' : 'R15', 1);
  tr([[g.x, g.y], [g.x, r.y + 0.3]]);
  const d = padAt(q, 0); tr([[d.x, d.y - 0.5], [d.x, d.y - 1.6]]); via(d.x, d.y - 1.6);
}

// Dog-bone fan-outs: short stubs with vias from the remaining fine-pitch pins
function dogbone(id, idx, len, alt = 0.9) {
  idx.forEach((i, n) => {
    const p = padAt(id, i), part = p.part, pad = p.pad;
    const horiz = pad.w > pad.h;
    const [cx, cy] = xf(part, 0, 0);
    const dx = Math.sign(p.x - cx) * (horiz ? 1 : 0), dy = Math.sign(p.y - cy) * (horiz ? 0 : 1);
    const L = len + (n % 2) * alt, half = Math.max(pad.w, pad.h) / 2;
    const x0 = p.x + dx * half, y0 = p.y + dy * half, x1 = p.x + dx * (half + L), y1 = p.y + dy * (half + L);
    tr([[x0, y0], [x1, y1]], 0.16);
    via(x1, y1, 0.5);
  });
}
dogbone('U1', [8, 9, 10, 11, 12, 13, 14, 15], 1.0);
dogbone('U1', [16, 17, 18, 19], 0.8);
dogbone('U1', [32, 33, 46, 47], 1.0);
dogbone('U1', [53, 55, 56, 57, 60, 61, 62], 0.9);
dogbone('U5', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31], 0.7);
dogbone('U2', [4, 5, 6, 7], 0.8);
dogbone('U3', [4, 5], 0.8);
// IS barrier channels: zener clamp -> current-limit resistor -> isolator (wide traces, generous creepage)
{
  const ends = [padAt('U6', 4), padAt('U6', 6), padAt('U6', 7)];
  [-1, -5, -9].forEach((y, i) => {
    const u = ends[i], xe = u.x - 0.78, dy = u.y - y, xk = xe - 0.3 - Math.abs(dy);
    tr([[33.05, y], [xk, y], [xe - 0.3, u.y], [xe, u.y]], 0.4);
    tr([[29.45, y], [27.6, y]], 0.5);
    tr([[23.4, y], [21.9, y], [21.4, y - 0.5]], 0.5); via(21.4, y - 0.5, 0.7);
  });
  tr([[45, 1.4], [45, 2.7]], 0.5); via(45, 2.7, 0.8);
  const u3 = padAt('U6', 3); tr([[45, -3.35], [44.5, -3.1], [u3.x + 0.78, u3.y]], 0.4);
  dogbone('U6', [0, 1, 2], 0.8);
}
// Header bottom row + RF module right/bottom edges to stitching vias
for (let k = 0; k < 10; k++) { const p = padAt('J3', 10 + k); tr([[p.x, p.y - 0.85], [p.x, p.y - 2.2]], 0.3); via(p.x, p.y - 2.2); }
for (let k = 0; k < 12; k++) { const p = padAt('M1', 12 + k); tr([[p.x + 0.8, p.y], [p.x + 1.9, p.y]], 0.25); via(p.x + 1.9, p.y, 0.5); }
for (let k = 0; k < 8; k++) { const p = padAt('M1', 24 + k); tr([[p.x, p.y - 0.8], [p.x, p.y - 1.7]], 0.25); via(p.x, p.y - 1.7, 0.5); }
// Passive stubs: a short trace from the named side's pad to a stitching via
for (const p of PARTS.filter((q) => q.stub)) {
  const fp = footprint(p), dir = { l: [-1, 0], r: [1, 0], u: [0, 1], d: [0, -1] }[p.stub];
  const pads = fp.pads.map((pd) => xf(p, pd.x, pd.y));
  const a = pads.reduce((best, c) => (c[0] * dir[0] + c[1] * dir[1] > best[0] * dir[0] + best[1] * dir[1] ? c : best));
  const L = p.pkg === '0402' ? 0.9 : 1.2;
  tr([[a[0], a[1]], [a[0] + dir[0] * L, a[1] + dir[1] * L]], 0.2);
  via(a[0] + dir[0] * (L + 0.25), a[1] + dir[1] * (L + 0.25), 0.5);
}

/* ------------------------------------------------------ keepouts / regions */
export const KEEPOUTS = [
  // copper keepout under the module antenna (module overhangs the top edge)
  { x0: 23, y0: 25.6, x1: 41, y1: 32 },
];
// Islands of a second copper net (e.g. 3V3), outlined by isolation gaps.
export const ISLANDS = [
  [[-25.4, -21.8], [-14.6, -21.8], [-12.6, -19.8], [-12.6, -9.2], [-25.4, -9.2]],
  [[21.2, -11.8], [47.2, -11.8], [47.2, 2.9], [21.2, 2.9]],
];
// Dashed silkscreen boundary for the intrinsic-safety barrier section
export const IS_REGION = { x0: 20.6, y0: -12.4, x1: 47.8, y1: 3.6, label: 'IS BARRIER' };

export const SILK_TEXT = [
  { t: 'SANTRONICA', x: -27.5, y: 27.2, size: 2.3, weight: 700, spacing: 0.34, align: 'left' },
  { t: 'SNT-100  REV A', x: -27.5, y: 24.2, size: 1.2, weight: 600, spacing: 0.12, align: 'left' },
  { t: 'USB', x: -41.6, y: 23.2, size: 1.1 },
  { t: 'RST', x: -1.5, y: -28.6, size: 1.0 },
  { t: 'PWR', x: 0.5, y: 29.4, size: 0.8 }, { t: 'LINK', x: 3.7, y: 29.4, size: 0.8 }, { t: 'RUN', x: 6.9, y: 29.4, size: 0.8 },
  { t: '24V', x: -38.5, y: -21.2, size: 0.9 }, { t: 'GND', x: -33.4, y: -21.2, size: 0.9 },
  { t: '1', x: 9.0, y: -25.0, size: 0.9 }, { t: '20', x: 35.2, y: -27.3, size: 0.9 },
  { t: 'RF', x: 32, y: 7.2, size: 0 },
  { t: '2026', x: 44.2, y: 7.0, size: 0.9 },
];
export const TEST_POINTS = [
  { id: 'TP1', x: -20, y: 3 }, { id: 'TP2', x: -20, y: 0 }, { id: 'TP3', x: 4.6, y: -20.6 },
  { id: 'TP4', x: 7.2, y: -20.6 }, { id: 'TP5', x: 17.5, y: 3.4 },
];
export const FIDUCIALS = [[-37.8, 28.8], [47.2, -14.8], [-12.2, -29.6]];
export const LABEL = { x: 14.4, y: 26.6, w: 6.4, h: 6.4 }; // DataMatrix sticker
export const LOGO = { x: -37.4, y: 25.8, size: 5.2 };

/* --------------------------------------------------------- occupancy grid */
// Used to scatter ground-stitching vias only where nothing else lives.
export function buildOccupancy(cell = 0.5) {
  const W = Math.ceil(BOARD.w / cell), H = Math.ceil(BOARD.h / cell);
  const g = new Uint8Array(W * H);
  const mark = (x0, y0, x1, y1) => {
    const i0 = Math.max(0, Math.floor((x0 + 50) / cell)), i1 = Math.min(W - 1, Math.floor((x1 + 50) / cell));
    const j0 = Math.max(0, Math.floor((y0 + 32) / cell)), j1 = Math.min(H - 1, Math.floor((y1 + 32) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) g[j * W + i] = 1;
  };
  for (const p of PARTS) {
    const fp = footprint(p);
    const [bw, bh] = fp.body, m = 0.9;
    const corners = [[-bw / 2 - m, -bh / 2 - m], [bw / 2 + m, bh / 2 + m], [-bw / 2 - m, bh / 2 + m], [bw / 2 + m, -bh / 2 - m]].map(([a, b]) => xf(p, a, b));
    const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
    mark(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    for (const pad of fp.pads) {
      const [x, y] = xf(p, pad.x, pad.y), r = Math.max(pad.w, pad.h) / 2 + 0.5;
      mark(x - r, y - r, x + r, y + r);
    }
  }
  for (const t of TRACES) {
    for (let k = 1; k < t.pts.length; k++) {
      const [ax, ay] = t.pts[k - 1], [bx, by] = t.pts[k];
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) / (cell * 0.5)) + 1, r = t.w / 2 + 0.55;
      for (let s = 0; s <= n; s++) { const x = ax + ((bx - ax) * s) / n, y = ay + ((by - ay) * s) / n; mark(x - r, y - r, x + r, y + r); }
    }
  }
  for (const v of VIAS) mark(v.x - 0.9, v.y - 0.9, v.x + 0.9, v.y + 0.9);
  for (const [hx, hy] of BOARD.holes) mark(hx - 4.4, hy - 4.4, hx + 4.4, hy + 4.4);
  for (const k of KEEPOUTS) mark(k.x0 - 0.6, k.y0 - 0.6, k.x1 + 0.6, k.y1 + 0.6);
  for (const t of TEST_POINTS) mark(t.x - 1.6, t.y - 1.6, t.x + 1.6, t.y + 1.6);
  for (const [fx, fy] of FIDUCIALS) mark(fx - 1.6, fy - 1.6, fx + 1.6, fy + 1.6);
  mark(LABEL.x - LABEL.w / 2 - 0.6, LABEL.y - LABEL.h / 2 - 0.6, LABEL.x + LABEL.w / 2 + 0.6, LABEL.y + LABEL.h / 2 + 0.6);
  mark(LOGO.x - 3.2, LOGO.y - 3.2, -14, 29.6);
  mark(IS_REGION.x0 - 0.3, IS_REGION.y0 - 0.3, IS_REGION.x1 + 0.3, IS_REGION.y1 + 0.3);
  return { g, W, H, cell, free: (x, y) => { const i = Math.floor((x + 50) / cell), j = Math.floor((y + 32) / cell); return i >= 0 && j >= 0 && i < W && j < H && !g[j * W + i]; } };
}

// Ground stitching: a perimeter fence plus a sparse field in open copper.
{
  const occ = buildOccupancy();
  const put = (x, y) => { if (occ.free(x - 0.5, y) && occ.free(x + 0.5, y) && occ.free(x, y - 0.5) && occ.free(x, y + 0.5)) { via(x, y, 0.6); VIAS[VIAS.length - 1].gnd = true; } };
  for (let x = -47; x <= 47; x += 2.4) { put(x, 30.4); put(x, -30.4); }
  for (let y = -28; y <= 28; y += 2.4) { put(-48.4, y); put(48.4, y); }
  for (let y = -26; y <= 26; y += 3.2) for (let x = -44 + ((y / 3.2) % 2 ? 1.6 : 0); x <= 44; x += 3.2) put(x, y);
}
