/*
 * The cast: every model the page can show, plus composites (several models arranged together,
 * e.g. the hero's laptop + phone + board). Exactly one entry is on stage at a time, inside
 * `holder`, which the choreography moves, turns and scales. Entries are swapped only while the
 * canvas is faded out between two slots that ask for different models (see pcb3d.js).
 *
 * A model is { group, radius, hull(explode), setExplode(e) } in model-space millimetres
 * (see PcbModel in board.js). A composite part turns a model (`rotation` [x, y, z] degrees: tilt about x, then turn about y),
 * optionally scales it, and places it: with `anchor` ([0..1]^3 of its turned box) the anchor
 * point lands on `at` (mm); without, the model's origin does.
 */
import * as THREE from 'three';

const D2R = Math.PI / 180;
const _v = new THREE.Vector3();

export class Ensemble {
  constructor(models, composites = {}) {
    this.models = models;
    this.holder = new THREE.Group();
    this.entries = new Map();
    this.current = null;
    for (const [name, model] of Object.entries(models)) {
      this.entries.set(name, { single: true, parts: [{ model, matrix: new THREE.Matrix4() }] });
    }
    for (const [name, parts] of Object.entries(composites)) {
      if (!parts.every((p) => models[p.model])) continue; // a composite needs all of its models
      this.entries.set(name, {
        single: false,
        parts: parts.map((p) => {
          const model = models[p.model];
          // 'YXZ': tilt about x first, then turn about the vertical, so a stood-up phone turns like one.
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rotation || [0, 0, 0]).map((d) => d * D2R), 'YXZ'));
          const s = p.scale || 1;
          const pos = new THREE.Vector3(...(p.at || [0, 0, 0]));
          if (p.anchor) {
            // Place the turned model so the point `anchor` of its box (0..1 per axis) lands on `at`:
            // e.g. anchor [0.5, 0, 0.5] stands it on the floor (y = at.y) centred on at.x / at.z.
            const box = new THREE.Box3(), pts = model.hull(0);
            for (let i = 0; i < pts.length; i += 3) box.expandByPoint(_v.set(pts[i], pts[i + 1], pts[i + 2]).applyQuaternion(q).multiplyScalar(s));
            pos.x -= box.min.x + p.anchor[0] * (box.max.x - box.min.x);
            pos.y -= box.min.y + p.anchor[1] * (box.max.y - box.min.y);
            pos.z -= box.min.z + p.anchor[2] * (box.max.z - box.min.z);
          }
          return { model, matrix: new THREE.Matrix4().compose(pos, q, new THREE.Vector3(s, s, s)) };
        }),
      });
    }
    for (const entry of this.entries.values()) entry.radius = this.measureRadius(entry);
  }

  has(name) { return this.entries.has(name); }

  /** Bounding-sphere radius about the holder origin (aims the lights and the shadow frustum). */
  measureRadius(entry) {
    if (entry.single) return entry.parts[0].model.radius;
    let r = 0;
    const pts = this.hullOf(entry, 0);
    for (let i = 0; i < pts.length; i += 3) r = Math.max(r, Math.hypot(pts[i], pts[i + 1], pts[i + 2]));
    return r;
  }

  hullOf(entry, explode) {
    if (entry.single) return entry.parts[0].model.hull(explode);
    const out = [];
    for (const { model, matrix } of entry.parts) {
      const pts = model.hull(0);
      for (let i = 0; i < pts.length; i += 3) {
        _v.set(pts[i], pts[i + 1], pts[i + 2]).applyMatrix4(matrix);
        out.push(_v.x, _v.y, _v.z);
      }
    }
    return out;
  }

  /** Model-space points enclosing entry `name` at this explode amount (composites stay assembled). */
  hull(name, explode) { return this.hullOf(this.entries.get(name), explode); }

  radius(name) { return this.entries.get(name).radius; }

  /** Put entry `name` on stage. Models are re-parented, so one model can appear in several entries. */
  show(name) {
    if (name === this.current || !this.entries.has(name)) return;
    for (const child of [...this.holder.children]) this.holder.remove(child);
    for (const { model, matrix } of this.entries.get(name).parts) {
      matrix.decompose(model.group.position, model.group.quaternion, model.group.scale);
      model.setExplode(0);
      this.holder.add(model.group);
    }
    this.current = name;
  }

  /** Explode only applies to a single model on stage; composites stay assembled. */
  setExplode(e) {
    const entry = this.entries.get(this.current);
    if (entry && entry.single) entry.parts[0].model.setExplode(e);
  }
}
