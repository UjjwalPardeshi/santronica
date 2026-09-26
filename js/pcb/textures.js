/*
 * Procedural board textures, painted on 2D canvases from layout.js:
 *   color  — solder mask over laminate / copper, ENIG pads, silkscreen, label
 *   rmb    — R: bump height, G: roughness, B: metalness (one texture, three maps)
 *   ao     — baked contact occlusion under components (fades out when exploded)
 * The same painter runs once per channel with a different "ink" table, so every
 * channel lines up pixel-for-pixel.
 */
import * as THREE from 'three';
import { BOARD, PARTS, footprint, xf, TRACES, VIAS, KEEPOUTS, ISLANDS, IS_REGION, SILK_TEXT, TEST_POINTS, FIDUCIALS, LABEL } from './layout.js';

const FONT = '"Inter", "Helvetica Neue", Arial, sans-serif';

export const PALETTES = {
  green: { lam: '#04200f', cu: '#0a3b22', trace: '#0d4529', ring: '#125536', hole: '#021409', silk: '#eeeee6', gold: '#d6ad58', fid: '#0d2a1d' },
  navy: { lam: '#0a1526', cu: '#11264a', trace: '#15305a', ring: '#1b3b6b', hole: '#060d18', silk: '#eef0f4', gold: '#d6ad58', fid: '#0b1422' },
  black: { lam: '#0b0c0e', cu: '#16181c', trace: '#1c1f24', ring: '#23272d', hole: '#050506', silk: '#f2f2ee', gold: '#d6ad58', fid: '#101113' },
};

// Per-channel inks. `null` means "skip this layer in this channel".
function inks(channel, pal) {
  if (channel === 'color') return { ...pal, label: '#f4f2ea', labelInk: '#1b1b1b', bare: '#2d3b2f' };
  if (channel === 'bump') return { lam: '#5a5a5a', cu: '#8c8c8c', trace: '#9a9a9a', ring: '#9a9a9a', hole: '#444444', silk: '#c8c8c8', gold: '#b4b4b4', fid: '#5a5a5a', label: '#dcdcdc', labelInk: '#dcdcdc', bare: '#505050' };
  if (channel === 'rough') return { lam: '#6b6b6b', cu: '#666666', trace: '#666666', ring: '#666666', hole: '#999999', silk: '#cfcfcf', gold: '#474747', fid: '#6b6b6b', label: '#e6e6e6', labelInk: '#cccccc', bare: '#bdbdbd' };
  return { lam: '#000000', cu: '#000000', trace: '#000000', ring: '#000000', hole: '#000000', silk: '#000000', gold: '#ffffff', fid: '#000000', label: '#000000', labelInk: '#000000', bare: '#000000' };
}

/* ---------------------------------------------------------------- helpers */
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

class Painter {
  constructor(ctx, s, mirror) {
    this.ctx = ctx; this.s = s; this.mirror = mirror;
  }
  X(x) { return ((this.mirror ? -x : x) + BOARD.w / 2) * this.s; }
  Y(y) { return (BOARD.h / 2 - y) * this.s; }
  L(mm) { return mm * this.s; }
  rect(x, y, w, h, rotDeg, fill, radius = 0) {
    const c = this.ctx;
    c.save();
    c.translate(this.X(x), this.Y(y));
    c.rotate(((this.mirror ? 1 : -1) * rotDeg * Math.PI) / 180);
    c.fillStyle = fill;
    c.beginPath();
    if (radius > 0 && c.roundRect) c.roundRect(-this.L(w) / 2, -this.L(h) / 2, this.L(w), this.L(h), this.L(radius));
    else c.rect(-this.L(w) / 2, -this.L(h) / 2, this.L(w), this.L(h));
    c.fill();
    c.restore();
  }
  circle(x, y, r, fill) {
    const c = this.ctx;
    c.fillStyle = fill; c.beginPath(); c.arc(this.X(x), this.Y(y), this.L(r), 0, Math.PI * 2); c.fill();
  }
  ring(x, y, r, w, stroke) {
    const c = this.ctx;
    c.strokeStyle = stroke; c.lineWidth = this.L(w); c.beginPath(); c.arc(this.X(x), this.Y(y), this.L(r), 0, Math.PI * 2); c.stroke();
  }
  poly(pts, stroke, width, fill) {
    const c = this.ctx;
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(this.X(x), this.Y(y)) : c.moveTo(this.X(x), this.Y(y))));
    if (fill) { c.closePath(); c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = this.L(width); c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
  }
  text(t, x, y, size, fill, { weight = 600, align = 'center', spacing = 0.06 } = {}) {
    const c = this.ctx;
    c.save();
    c.fillStyle = fill;
    c.font = `${weight} ${this.L(size)}px ${FONT}`;
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    const letters = [...t], sp = this.L(size * spacing);
    const width = letters.reduce((w, ch) => w + c.measureText(ch).width + sp, -sp);
    let px = this.X(x) - (align === 'center' ? width / 2 : 0);
    if (align === 'left' && this.mirror) px = this.X(x) - width; // keep left-aligned blocks inside the board when mirrored
    for (const ch of letters) { c.fillText(ch, px, this.Y(y)); px += c.measureText(ch).width + sp; }
    c.restore();
  }
}

function roundedBoardPath(P, inset) {
  const { w, h, corner } = BOARD, c = P.ctx;
  const x0 = P.X(-w / 2 + inset), x1 = P.X(w / 2 - inset), y0 = P.Y(h / 2 - inset), y1 = P.Y(-h / 2 + inset);
  const r = P.L(Math.max(0.2, corner - inset));
  c.beginPath();
  if (c.roundRect) c.roundRect(Math.min(x0, x1), y0, Math.abs(x1 - x0), y1 - y0, r);
  else c.rect(Math.min(x0, x1), y0, Math.abs(x1 - x0), y1 - y0);
}

function padsOf(p) {
  const fp = footprint(p);
  return fp.pads.map((pad) => { const [x, y] = xf(p, pad.x, pad.y); return { ...pad, bx: x, by: y, rot: p.rot || 0 }; });
}

/* ------------------------------------------------------------ silkscreen */
function silkOutline(P, p, ink, lw) {
  const fp = footprint(p), [bw, bh] = fp.body, m = 0.3;
  const corner = (lx, ly) => xf(p, lx, ly);
  const seg = (a, b) => P.poly([corner(...a), corner(...b)], ink, lw);
  if (p.type === 'lqfp64' || p.type === 'qfn32') {
    const e = bw / 2 + (p.type === 'lqfp64' ? 0.35 : 0.3), k = p.type === 'lqfp64' ? 0.9 : 0.6;
    for (const [sx, sy] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
      seg([sx * e, sy * e], [sx * (e - k), sy * e]); seg([sx * e, sy * e], [sx * e, sy * (e - k)]);
    }
    const [dx, dy] = corner(-e - 0.6, e + 0.6); P.circle(dx, dy, 0.32, ink);
    return;
  }
  if (p.type === 'soic8' || p.type === 'sot23' || p.type === 'sot23_5') {
    const ex = bw / 2 + 0.15, ey = bh / 2 - 0.1;
    seg([-ex, -ey], [-ex, ey]); seg([ex, -ey], [ex, ey]);
    if (p.type === 'soic8') { const [dx, dy] = corner(-ex - 0.55, -bh / 2 - 1.3); P.circle(dx, dy, 0.28, ink); }
    return;
  }
  if (p.type === 'chip0402' || p.type === 'hdr2x10' || p.type === 'rfmod') {
    if (p.type === 'hdr2x10') {
      const ex = bw / 2 + 0.25, ey = bh / 2 + 0.25;
      P.poly([corner(-ex, -ey), corner(ex, -ey), corner(ex, ey), corner(-ex, ey), corner(-ex, -ey)], ink, lw);
    }
    if (p.type === 'rfmod') {
      const ex = bw / 2 + 0.9, ey = bh / 2 + 0.2;
      seg([-ex, -ey], [ex, -ey]); seg([-ex, -ey], [-ex, ey - 7]); seg([ex, -ey], [ex, ey - 7]);
    }
    return;
  }
  const ex = bw / 2 + m, ey = bh / 2 + m;
  const pts = [corner(-ex, -ey), corner(ex, -ey), corner(ex, ey), corner(-ex, ey), corner(-ex, -ey)];
  if (p.type === 'ecap63') {
    const ch = 1.4;
    const q = [corner(-ex + ch, -ey), corner(ex, -ey), corner(ex, ey), corner(-ex + ch, ey), corner(-ex, ey - ch), corner(-ex, -ey + ch), corner(-ex + ch, -ey)];
    P.poly(q, ink, lw);
    const [px, py] = corner(ex + 1.2, ey + 0.2); P.text('+', px, py, 1.4, ink, { weight: 700 });
    return;
  }
  if (p.type === 'chip0603' || p.type === 'chip1206' || p.type === 'r1206' || p.type === 'led0603') {
    // Short segments on the long sides only — pads interrupt the outline on real boards.
    seg([-bw / 2 + 0.1, ey], [bw / 2 - 0.1, ey]); seg([-bw / 2 + 0.1, -ey], [bw / 2 - 0.1, -ey]);
    if (p.type === 'led0603') { const [dx, dy] = corner(-bw / 2 - 1.0, 0); P.circle(dx, dy, 0.22, ink); }
    return;
  }
  if (p.type === 'sod123') { P.poly(pts, ink, lw); const a = corner(-bw / 2 - 0.2, -ey), b = corner(-bw / 2 - 0.2, ey); P.poly([a, b], ink, lw * 2.2); return; }
  P.poly(pts, ink, lw);
}

const DESIGNATED = new Set(['lqfp64', 'soic8', 'qfn32', 'xtal5032', 'ind6060', 'ecap63', 'usbc', 'term2', 'hdr2x10', 'rfmod', 'tact', 'sot23', 'sot23_5', 'sod123', 'r1206', 'led0603']);
function designator(P, p, ink) {
  if (!DESIGNATED.has(p.type)) return;
  const fp = footprint(p), [bw, bh] = fp.body;
  const off = { usbc: [0.5, 6.2], term2: [-7.2, 2.6], hdr2x10: [-15.2, 0], rfmod: [-10.4, 11.4], led0603: [0, 0], ecap63: [0, 4.6], sod123: [0, 1.6] }[p.type];
  if (p.type === 'led0603') return;
  const [x, y] = off ? xf(p, off[0], off[1]) : xf(p, 0, bh / 2 + (p.type === 'lqfp64' ? 2.1 : p.type === 'soic8' ? 2.6 : 1.35));
  P.text(p.id, x, y, p.type === 'lqfp64' || p.type === 'rfmod' ? 1.25 : 0.95, ink, { weight: 600 });
}

function dataMatrix(P, ink, paper, x, y, w, h) {
  P.rect(x, y, w, h, 0, paper, 0.4);
  const n = 14, cell = (h * 0.62) / n, x0 = x - w / 2 + 0.6, y0 = y + (n * cell) / 2;
  let seed = 11;
  const rnd = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const edge = i === 0 || j === n - 1, timing = (j === 0 && i % 2 === 0) || (i === n - 1 && j % 2 === 1);
    if (edge || timing || (i > 0 && j < n - 1 && rnd() > 0.52)) P.rect(x0 + (i + 0.5) * cell, y0 - (j + 0.5) * cell, cell * 1.02, cell * 1.02, 0, ink);
  }
  P.text('SNT-100', x + 0.2, y - h / 2 + 0.75, 0.62, ink, { weight: 700, align: 'center' });
}

/* ------------------------------------------------------------- top side */
function paintTop(P, ink) {
  const c = P.ctx, cw = c.canvas.width, ch = c.canvas.height;
  c.fillStyle = ink.lam; c.fillRect(0, 0, cw, ch);

  // Copper pour with isolation from edges, holes and the antenna keepout
  roundedBoardPath(P, 0.5); c.fillStyle = ink.cu; c.fill();
  for (const [hx, hy] of BOARD.holes) P.circle(hx, hy, BOARD.ring / 2 + 0.5, ink.lam);
  for (const k of KEEPOUTS) P.rect((k.x0 + k.x1) / 2, (k.y0 + k.y1) / 2, k.x1 - k.x0, k.y1 - k.y0, 0, ink.lam);
  for (const isl of ISLANDS) P.poly([...isl, isl[0]], ink.lam, 0.5);

  const pads = PARTS.flatMap((p) => padsOf(p).map((pd) => ({ ...pd, part: p })));
  // Clearances
  for (const t of TRACES.filter((q) => q.layer === 'top')) P.poly(t.pts, ink.lam, t.w + 0.55);
  for (const pd of pads) {
    if (pd.shape === 'round') P.circle(pd.bx, pd.by, pd.w / 2 + 0.35, ink.lam);
    else P.rect(pd.bx, pd.by, pd.w + 0.6, pd.h + 0.6, pd.rot, ink.lam, 0.2);
  }
  for (const v of VIAS) if (!v.gnd) P.circle(v.x, v.y, v.d / 2 + 0.3, ink.lam);
  for (const t of TEST_POINTS) P.circle(t.x, t.y, 1.05, ink.lam);

  // Traces (copper under mask reads slightly lighter than the pour)
  for (const t of TRACES.filter((q) => q.layer === 'top')) P.poly(t.pts, ink.trace, t.w);
  // Vias — tented: a raised copper ring with a filled dimple
  for (const v of VIAS) { P.circle(v.x, v.y, v.d / 2, ink.ring); P.circle(v.x, v.y, v.drill / 2, ink.hole); }

  // Silkscreen (drawn before pads so pads clip it, like the real mask-defined print)
  const lw = 0.15;
  for (const p of PARTS) { silkOutline(P, p, ink.silk, lw); designator(P, p, ink.silk); }
  const r = IS_REGION;
  c.save(); c.setLineDash([P.L(0.9), P.L(0.6)]);
  P.poly([[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1], [r.x0, r.y0]], ink.silk, 0.18);
  c.restore();
  P.text(r.label, r.x0 + 0.8, r.y1 - 0.95, 0.95, ink.silk, { weight: 700, align: 'left', spacing: 0.16 });
  for (const t of SILK_TEXT) if (t.size) P.text(t.t, t.x, t.y, t.size, ink.silk, { weight: t.weight || 600, align: t.align || 'center', spacing: t.spacing ?? 0.06 });
  for (const t of TEST_POINTS) P.text(t.id, t.x, t.y - 1.6, 0.8, ink.silk);

  // Exposed ENIG copper
  for (const pd of pads) {
    if (pd.shape === 'round') {
      if (pd.sq) P.rect(pd.bx, pd.by, pd.w, pd.h, pd.rot, ink.gold, 0.1); else P.circle(pd.bx, pd.by, pd.w / 2, ink.gold);
      P.circle(pd.bx, pd.by, pd.drill / 2, ink.hole);
    } else if (pd.slot) {
      P.rect(pd.bx, pd.by, pd.w, pd.h, pd.rot, ink.gold, pd.h / 2);
      P.rect(pd.bx, pd.by, pd.w - 0.5, pd.drill, pd.rot, ink.hole, pd.drill / 2);
    } else {
      P.rect(pd.bx, pd.by, pd.w, pd.h, pd.rot, ink.gold, Math.min(pd.w, pd.h) * 0.18);
    }
  }
  for (const t of TEST_POINTS) P.circle(t.x, t.y, 0.65, ink.gold);
  for (const [fx, fy] of FIDUCIALS) { P.circle(fx, fy, 1.0, ink.bare); P.circle(fx, fy, 0.5, ink.gold); }
  for (const [hx, hy] of BOARD.holes) { P.circle(hx, hy, BOARD.ring / 2, ink.gold); P.circle(hx, hy, BOARD.drill / 2, ink.hole); }

  // Production label sticker
  dataMatrix(P, ink.labelInk, ink.label, LABEL.x, LABEL.y, LABEL.w, LABEL.h);
}

/* ---------------------------------------------------------- bottom side */
function paintBottom(P, ink) {
  const c = P.ctx, cw = c.canvas.width, ch = c.canvas.height;
  c.fillStyle = ink.lam; c.fillRect(0, 0, cw, ch);
  roundedBoardPath(P, 0.5); c.fillStyle = ink.cu; c.fill();
  for (const [hx, hy] of BOARD.holes) P.circle(hx, hy, BOARD.ring / 2 + 0.5, ink.lam);

  const th = PARTS.flatMap((p) => padsOf(p).filter((pd) => pd.th).map((pd) => ({ ...pd, part: p })));
  // Bottom-layer buses and artwork are authored in *view* coordinates (as seen when the
  // board is flipped); V() converts them to board coordinates for the mirrored painter.
  const V = (pts) => pts.map(([x, y]) => [-x, y]);
  const buses = [
    { from: [-44, 23], dirs: [[1, 0, 15], [1, -1, 5], [1, 0, 12]], n: 7 },
    { from: [6, 25], dirs: [[1, 0, 12], [1, -1, 6], [0, -1, 7]], n: 6 },
    { from: [-41, -11.5], dirs: [[1, 0, 13], [1, -1, 4], [1, 0, 16]], n: 6 },
    { from: [10, -13], dirs: [[1, 0, 10], [1, 1, 3], [1, 0, 12]], n: 5 },
  ];
  const busPaths = [];
  for (const b of buses) {
    for (let i = 0; i < b.n; i++) {
      let x = b.from[0], y = b.from[1] - i * 0.55; const pts = [[x, y]];
      for (const [dx, dy, L] of b.dirs) { x += dx * L; y += dy * L; pts.push([x, y]); }
      busPaths.push(V(pts));
    }
  }
  for (const pts of busPaths) P.poly(pts, ink.lam, 0.75);
  for (const pd of th) P.circle(pd.bx, pd.by, Math.max(pd.w, pd.h) / 2 + 0.4, ink.lam);
  for (const v of VIAS) if (!v.gnd) P.circle(v.x, v.y, v.d / 2 + 0.3, ink.lam);
  for (const pts of busPaths) P.poly(pts, ink.trace, 0.2);
  const inText = (v) => Math.abs(-v.x) < 27 && v.y > -9 && v.y < 19;
  for (const v of VIAS) { if (inText(v)) continue; P.circle(v.x, v.y, v.d / 2, ink.ring); P.circle(v.x, v.y, v.drill / 2, ink.hole); }

  // Silkscreen identity, centred like a product's underside
  P.text('SANTRONICA', 0, 3.2, 4.6, ink.silk, { weight: 700, spacing: 0.3 });
  P.text('ELECTRONICS & INTRINSIC SAFETY DESIGN', 0, -1.6, 1.25, ink.silk, { weight: 600, spacing: 0.16 });
  P.text('SNT-100  ·  REV A  ·  4 LAYER  ·  1.6 MM  ·  ENIG', 0, -4.6, 0.95, ink.silk, { weight: 600, spacing: 0.12 });
  dataMatrix(P, ink.labelInk, ink.label, -36, 16, 8, 8);

  for (const pd of th) {
    if (pd.slot) { P.rect(pd.bx, pd.by, pd.w, pd.h, pd.rot, ink.gold, pd.h / 2); P.rect(pd.bx, pd.by, pd.w - 0.5, pd.drill, pd.rot, ink.hole, pd.drill / 2); continue; }
    if (pd.sq) P.rect(pd.bx, pd.by, pd.w, pd.h, pd.rot, ink.gold, 0.1); else P.circle(pd.bx, pd.by, pd.w / 2, ink.gold);
    P.circle(pd.bx, pd.by, pd.drill / 2, ink.hole);
  }
  for (const [hx, hy] of BOARD.holes) { P.circle(hx, hy, BOARD.ring / 2, ink.gold); P.circle(hx, hy, BOARD.drill / 2, ink.hole); }
}

/* ------------------------------------------------------------- assembly */
let noiseTile = null;
/** Subtle film grain from a small tiled noise pattern (no full-canvas readback). */
function grain(ctx, amount) {
  if (!noiseTile) {
    noiseTile = makeCanvas(128, 128);
    const n = noiseTile.getContext('2d'), img = n.createImageData(128, 128), d = img.data;
    let seed = 3;
    for (let i = 0; i < d.length; i += 4) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const v = 128 + ((seed >> 16) / 32768 - 0.5) * 255;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    n.putImageData(img, 0, 0);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = amount / 40;
  ctx.fillStyle = ctx.createPattern(noiseTile, 'repeat');
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

function channelCanvas(paint, channel, pal, w, h, mirror) {
  const cv = makeCanvas(w, h), ctx = cv.getContext('2d');
  const P = new Painter(ctx, w / BOARD.w, mirror);
  paint(P, inks(channel, pal));
  return cv;
}

/** Merge three grayscale canvases into R (bump), G (roughness), B (metalness) with GPU compositing. */
function packRMB(bump, rough, metal) {
  const w = bump.width, h = bump.height, out = makeCanvas(w, h), octx = out.getContext('2d');
  const tint = (src, color) => {
    const c = src.getContext('2d');
    c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = color; c.fillRect(0, 0, w, h); c.restore();
    return src;
  };
  octx.fillStyle = '#000'; octx.fillRect(0, 0, w, h);
  octx.globalCompositeOperation = 'lighter';
  octx.drawImage(tint(bump, '#ff0000'), 0, 0);
  octx.drawImage(tint(rough, '#00ff00'), 0, 0);
  octx.drawImage(tint(metal, '#0000ff'), 0, 0);
  octx.globalCompositeOperation = 'source-over';
  return out;
}

function softBlur(canvas, px) {
  if (px <= 0) return canvas;
  const out = makeCanvas(canvas.width, canvas.height), ctx = out.getContext('2d');
  if ('filter' in ctx) { ctx.filter = `blur(${px}px)`; ctx.drawImage(canvas, 0, 0); ctx.filter = 'none'; return out; }
  return canvas;
}

function paintAO(w, h) {
  const cv = makeCanvas(w, h), ctx = cv.getContext('2d'), P = new Painter(ctx, w / BOARD.w, false);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
  for (const p of PARTS) {
    const fp = footprint(p), [bw, bh] = fp.body, tall = Math.min(1, fp.h / 6);
    // Stacked translucent rounded rects approximate a soft contact shadow everywhere (no canvas filter needed).
    const steps = 6, spread = 0.35 + tall * 2.2, alpha = 0.16 + tall * 0.1;
    for (let k = steps; k >= 0; k--) {
      const g = (k / steps) * spread;
      ctx.globalAlpha = alpha / (1 + k * 0.6);
      const [x, y] = xf(p, (fp.bodyOffset || [0, 0])[0], (fp.bodyOffset || [0, 0])[1]);
      P.rect(x, y, bw + g * 2, bh + g * 2, p.rot || 0, '#000000', 0.3 + g);
    }
  }
  ctx.globalAlpha = 1;
  return softBlur(cv, 2);
}

function toTexture(canvas, srgb, anisotropy) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

/** Build all board textures. `res` = canvas width in px for the top side. */
export function buildBoardTextures({ res = 2048, palette = 'green', anisotropy = 8 } = {}) {
  const pal = PALETTES[palette] || PALETTES.green;
  const w = res, h = Math.round((res * BOARD.h) / BOARD.w);
  const top = {}, bottom = {};

  const colorTop = channelCanvas(paintTop, 'color', pal, w, h, false);
  grain(colorTop.getContext('2d'), 7);
  top.color = toTexture(colorTop, true, anisotropy);
  const bumpTop = softBlur(channelCanvas(paintTop, 'bump', pal, w, h, false), res / 1400);
  top.rmb = toTexture(packRMB(bumpTop, channelCanvas(paintTop, 'rough', pal, w, h, false), channelCanvas(paintTop, 'metal', pal, w, h, false)), false, anisotropy);
  top.ao = toTexture(paintAO(Math.round(w / 2), Math.round(h / 2)), false, 1);

  const bw = Math.round(res * 0.5), bh = Math.round((bw * BOARD.h) / BOARD.w);
  const colorBot = channelCanvas(paintBottom, 'color', pal, bw, bh, true);
  grain(colorBot.getContext('2d'), 6);
  bottom.color = toTexture(colorBot, true, anisotropy);
  const bumpBot = softBlur(channelCanvas(paintBottom, 'bump', pal, bw, bh, true), res / 2800);
  bottom.rmb = toTexture(packRMB(bumpBot, channelCanvas(paintBottom, 'rough', pal, bw, bh, true), channelCanvas(paintBottom, 'metal', pal, bw, bh, true)), false, anisotropy);

  return { top, bottom, palette: pal };
}

/* ------------------------------------------------- small decal textures */
export function buildEdgeTexture(palette = 'green') {
  const pal = PALETTES[palette] || PALETTES.green;
  const cv = makeCanvas(64, 64), ctx = cv.getContext('2d');
  ctx.fillStyle = '#b9b27c'; ctx.fillRect(0, 0, 64, 64);           // FR-4 glass/epoxy core
  for (let y = 0; y < 64; y += 3) { ctx.fillStyle = y % 6 ? 'rgba(90,86,50,0.10)' : 'rgba(255,250,210,0.10)'; ctx.fillRect(0, y, 64, 1); }
  ctx.fillStyle = pal.cu; ctx.fillRect(0, 0, 64, 5); ctx.fillRect(0, 59, 64, 5);   // mask lips
  const t = toTexture(cv, true, 4);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function buildMarkAtlas(cells) {
  // 4x4 atlas of laser-etched top markings; each cell maps onto one part top face.
  const size = 1024, n = 4, cs = size / n, cv = makeCanvas(size, size), ctx = cv.getContext('2d');
  cells.forEach(({ lines, w, d, dot, logo: withLogo, maxFs }, i) => {
    const cx = (i % n) * cs, cy = Math.floor(i / n) * cs;
    ctx.save();
    ctx.setTransform(cs / w, 0, 0, cs / d, cx, cy);
    ctx.fillStyle = 'rgba(175,175,172,0.5)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fs = Math.min(Math.min(w, d) / (lines.length + 3.4), maxFs || 1.5);
    lines.forEach((ln, k) => {
      ctx.font = `${k === 0 ? 700 : 600} ${fs}px ${FONT}`;
      ctx.fillText(ln, w / 2, d / 2 + (k - (lines.length - 1) / 2) * fs * 1.25);
    });
    if (dot) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.arc(dot[0], dot[1], Math.min(w, d) * 0.045, 0, Math.PI * 2); ctx.fill(); }
    if (withLogo) {
      ctx.strokeStyle = 'rgba(40,40,40,0.35)'; ctx.lineWidth = 0.12;
      ctx.strokeRect(0.5, 0.5, w - 1, d - 1);
    }
    ctx.restore();
  });
  const t = toTexture(cv, true, 8);
  return t;
}

export function buildEcapTopTexture() {
  const cv = makeCanvas(256, 256), ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(12,12,14,0.92)';
  ctx.beginPath(); ctx.arc(128, 128, 120, Math.PI * 0.62, Math.PI * 1.38); ctx.closePath(); ctx.fill();   // polarity half-moon
  ctx.strokeStyle = 'rgba(60,60,64,0.55)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(128, 70); ctx.lineTo(128, 186); ctx.moveTo(128, 128); ctx.lineTo(178, 84); ctx.moveTo(128, 128); ctx.lineTo(178, 172); ctx.stroke(); // vent "K"
  ctx.fillStyle = 'rgba(30,30,34,0.8)'; ctx.font = `700 26px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText('100', 196, 120); ctx.font = `600 20px ${FONT}`; ctx.fillText('35V', 196, 146);
  return toTexture(cv, true, 4);
}

export function buildModuleTexture() {
  // RF module top: dark mask, meander antenna, castellated edge pads, silkscreen.
  const W = 360, H = 510, s = W / 18, cv = makeCanvas(W, H), ctx = cv.getContext('2d');
  ctx.fillStyle = '#10161f'; ctx.fillRect(0, 0, W, H);
  const X = (x) => (x + 9) * s, Y = (y) => (12.75 - y) * s;
  ctx.strokeStyle = '#1b2a3d'; ctx.lineWidth = 0.55 * s; ctx.lineJoin = 'miter';
  ctx.beginPath(); ctx.moveTo(X(-6.5), Y(6.2)); let y = 6.2, up = true;
  for (let x = -6.5; x <= 6.5; x += 1.6) { y = up ? 11.6 : 7.2; ctx.lineTo(X(x), Y(y)); ctx.lineTo(X(x + 0.8), Y(y)); up = !up; }
  ctx.stroke();
  ctx.fillStyle = '#d6ad58';
  for (let k = 0; k < 12; k++) { const yy = (k - 5.5) * 1.27 - 4.6; ctx.fillRect(X(-9), Y(yy) - 0.45 * s, 0.9 * s, 0.9 * s); ctx.fillRect(X(9) - 0.9 * s, Y(yy) - 0.45 * s, 0.9 * s, 0.9 * s); }
  for (let k = 0; k < 8; k++) { const xx = (k - 3.5) * 1.27; ctx.fillRect(X(xx) - 0.45 * s, Y(-12.75) - 0.9 * s, 0.9 * s, 0.9 * s); }
  ctx.fillStyle = '#e9ecf1'; ctx.font = `600 ${0.8 * s}px ${FONT}`; ctx.textAlign = 'left';
  ctx.fillText('ANT', X(-8.2), Y(5.8));
  return toTexture(cv, true, 8);
}
