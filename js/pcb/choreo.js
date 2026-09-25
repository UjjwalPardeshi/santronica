/*
 * Scroll choreography: the page places empty `.pcb-slot` boxes; the board flies
 * between them. Focus line = viewport centre.
 *   - before the first slot reaches the focus line the board sits in it (scrolls with it)
 *   - after the last slot passes it the board stays in that slot (scrolls away with it)
 *   - between slots A and B: the board rides inside A while A is near the focus line
 *     (dwell), glides to B, then rides inside B; it dips in opacity mid-flight
 * Slots with a 0x0 box (display:none at this breakpoint) are ignored.
 *
 * Orientation convention (see SPEC): q = Rz(rz) · Ry(ry) · Rx(rx) · Ry_local(spin).
 * Angles are interpolated as numbers so authored paths (full turns, flips) stay exact.
 */
import * as THREE from 'three';

const D2R = Math.PI / 180;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3();

export const ANGLES = ['rx', 'spin', 'ry', 'rz'];

export function poseQuaternion(p, out = new THREE.Quaternion()) {
  _e.set(p.rx * D2R, p.ry * D2R, p.rz * D2R, 'ZYX');
  out.setFromEuler(_e);
  _q.setFromAxisAngle(Y_AXIS, p.spin * D2R);
  return out.multiply(_q);
}

const num = (el, name, dflt) => {
  const v = parseFloat(el.getAttribute(`data-pcb-${name}`));
  return Number.isFinite(v) ? v : dflt;
};
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

export class Choreo {
  constructor({ extents, dwell = 0.3, travelOpacity = 0.55 }) {
    this.extents = extents;       // (explode) => { x, z, yMin, yMax } model-space mm
    this.dwell = dwell;
    this.travelOpacity = travelOpacity;
    this.slots = [];
    this.last = { pair: null, t: 0 };
  }

  /** Re-read every slot's document geometry and pose. Call on resize / layout change. */
  measure() {
    const sy = window.scrollY, sx = window.scrollX;
    this.slots = [...document.querySelectorAll('[data-pcb-slot]')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return null;
        const pose = {
          rx: num(el, 'rx', 60), spin: num(el, 'spin', 0), ry: num(el, 'ry', 0), rz: num(el, 'rz', 0),
          explode: clamp01(num(el, 'explode', 0)), fit: num(el, 'fit', 0.9), opacity: clamp01(num(el, 'opacity', 1)),
        };
        const fit = this.fitFor(pose, r.width, r.height);
        return { name: el.getAttribute('data-pcb-slot'), el, cx: r.left + sx + r.width / 2, cy: r.top + sy + r.height / 2, w: r.width, h: r.height, pose, ...fit };
      })
      .filter(Boolean)
      .sort((a, b) => a.cy - b.cy);
  }

  /** px-per-mm so the posed board fills `fit` of the slot, plus the projected centre offset (mm). */
  fitFor(pose, w, h) {
    const q = poseQuaternion(pose), ex = this.extents(pose.explode);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const X of [-ex.x, ex.x]) for (const Y of [ex.yMin, ex.yMax]) for (const Z of [-ex.z, ex.z]) {
      _v.set(X, Y, Z).applyQuaternion(q);
      x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y);
    }
    const s = Math.min((pose.fit * w) / (x1 - x0), (pose.fit * h) / (y1 - y0));
    return { s, ox: (x0 + x1) / 2, oy: (y0 + y1) / 2 };
  }

  /** Target state for the current scroll position. Screen coordinates in CSS px. */
  target(scrollY, vw, vh) {
    const S = this.slots;
    if (!S.length) return null;
    const focus = scrollY + vh / 2;
    const screen = (sl) => ({ x: sl.cx - window.scrollX, y: sl.cy - scrollY });
    const pack = (sl, x, y, opacity, pair, t) => ({ x, y, s: sl.s, ox: sl.ox, oy: sl.oy, ...sl.pose, opacity, pair, t });

    if (focus <= S[0].cy || S.length === 1) {
      const p = screen(S[0]); this.last = { pair: [S[0].name], t: 0 };
      return pack(S[0], p.x, p.y, S[0].pose.opacity, this.last.pair, 0);
    }
    const n = S.length - 1;
    if (focus >= S[n].cy) {
      const p = screen(S[n]); this.last = { pair: [S[n].name], t: 1 };
      return pack(S[n], p.x, p.y, S[n].pose.opacity, this.last.pair, 1);
    }
    let i = 0;
    while (i < n - 1 && S[i + 1].cy <= focus) i++;
    const A = S[i], B = S[i + 1];
    const D = B.cy - A.cy, t = (focus - A.cy) / D;
    // Dwell is measured in pixels so the resting board never scrolls off-screen: while a slot
    // is within `dw` of the focus line the board rides inside it like a normal page element.
    const dw = Math.min(this.dwell * vh, 0.4 * D) / D;
    const u = clamp01((t - dw) / (1 - 2 * dw));
    const e = smoother(u);
    const a = screen(A), b = screen(B);
    const out = { s: lerp(A.s, B.s, e), ox: lerp(A.ox, B.ox, e), oy: lerp(A.oy, B.oy, e) };
    for (const k of [...ANGLES, 'explode']) out[k] = lerp(A.pose[k], B.pose[k], e);
    // Hand-off: ride slot A, then glide to slot B as it arrives from below.
    out.x = lerp(a.x, b.x, e);
    out.y = lerp(a.y, b.y, e);
    // Large moving objects go translucent while they travel and firm up once settled.
    const dip = 1 - (1 - this.travelOpacity) * Math.sqrt(Math.sin(Math.PI * u));
    out.opacity = lerp(A.pose.opacity, B.pose.opacity, e) * dip;
    out.pair = [A.name, B.name];
    out.t = t;
    this.last = { pair: out.pair, t };
    return out;
  }
}
