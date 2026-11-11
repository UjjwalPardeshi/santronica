/*
 * FPGA in a flip-chip BGA package (all marking fictional). Rest state: 35 mm laminate
 * substrate, 30 mm nickel-plated lid with laser marking, a ring of 0402 decoupling
 * capacitors on the substrate margin, 26 x 26 tin balls underneath. Lies per the PCB
 * convention: lid (top face) +Y, top edge -Z. explode: the lid lifts and the balls drop,
 * revealing the bare silicon die on the substrate.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';

// Dimensions in mm.
const SUB = 35, SUB_T = 1.2, SUB_R = 0.25;
const SUB_TOP = SUB_T / 2;                       // 0.6, substrate top face
const SUB_FACE = SUB - 2 * SUB_R;                // flat top face, where the decal plane sits
const LID = 30, LID_T = 2, LID_R = 0.9;
const LID_FACE = LID - 2 * LID_R;
const LID_Y = SUB_TOP + LID_T / 2;               // lid centre at rest
const TOP = SUB_TOP + LID_T;                     // lid top at rest
const DIE = 18, DIE_T = 0.7, DIE_R = 0.12;
const DIE_BOT = SUB_TOP + 0.1;
const DIE_FACE = DIE - 2 * DIE_R;
const DIE_Y = DIE_BOT + DIE_T / 2;
const BALL_R = 0.3, BALL_N = 26, PITCH = 1;
const BALL_Y = -SUB_TOP - BALL_R + 0.03;         // ball centre, slightly embedded
const BALL_HALF = ((BALL_N - 1) * PITCH) / 2 + BALL_R;
const BOT = BALL_Y - BALL_R;                     // lowest point at rest
const CAP_RING = 16.15, CAP_T = 0.35, CAP_PER_SIDE = 18, CAP_PITCH = 1.6;
const LIFT_LID = 10, DROP_BALLS = 3;
const YC = (TOP + BOT) / 2;                      // rest bounding-box centre (raw y)

const FIDUCIALS = [[16.2, -16.2], [-16.2, 16.2], [16.2, 16.2]];
const PIN1 = [[-16.9, -16.9], [-15.9, -16.9], [-16.9, -15.9]];
const SANS = '"Geist", "Helvetica Neue", Arial, sans-serif';
const MONO = '"Geist Mono", ui-monospace, Menlo, Consolas, monospace';
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smootherstep = (x) => { const t = clamp01(x); return t * t * t * (t * (t * 6 - 15) + 10); };
const hash = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function canvas(px) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  return c;
}

function tex(c, aniso, srgb) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

/** Faint horizontal brushing streaks (lighter and darker), drawn over a flat base. */
function brushed(g, px, amount) {
  for (let y = 0; y < px; y += 2) {
    const h = hash(y), len = px * (0.4 + 0.6 * hash(y + 91)), x0 = px * 0.6 * hash(y + 17);
    g.fillStyle = h > 0.5 ? `rgba(255,255,255,${amount * h})` : `rgba(0,0,0,${amount * (1 - h)})`;
    g.fillRect(x0, y, len, 1 + (y % 4 === 0 ? 1 : 0));
  }
}

/** Substrate: glass-weave laminate, gold fiducials and a pin-1 triangle. rm: G = roughness, B = metal. */
function substrateMaps(px, aniso) {
  const k = px / SUB_FACE, H = SUB_FACE / 2;
  const at = (x, z) => [(x + H) * k, (z + H) * k];
  const goldLayer = (g, fill) => {
    g.fillStyle = fill;
    for (const [x, z] of FIDUCIALS) { g.beginPath(); g.arc(...at(x, z), 0.45 * k, 0, Math.PI * 2); g.fill(); }
    g.beginPath();
    PIN1.forEach(([x, z], i) => (i ? g.lineTo(...at(x, z)) : g.moveTo(...at(x, z))));
    g.closePath(); g.fill();
  };

  const c = canvas(px), g = c.getContext('2d');
  g.fillStyle = '#1c1f25'; g.fillRect(0, 0, px, px);
  const step = Math.max(2, Math.round(0.11 * k));
  for (let i = 0; i < px; i += step) {
    g.fillStyle = `rgba(255,255,255,${0.012 + 0.02 * hash(i)})`; g.fillRect(0, i, px, 1);
    g.fillStyle = `rgba(0,0,0,${0.06 * hash(i + 7)})`; g.fillRect(i, 0, 1, px);
  }
  g.fillStyle = '#0a0b0d';
  for (const [x, z] of FIDUCIALS) { g.beginPath(); g.arc(...at(x, z), 0.62 * k, 0, Math.PI * 2); g.fill(); }
  goldLayer(g, '#d8b466');

  const r = canvas(px), rg = r.getContext('2d');
  rg.fillStyle = 'rgb(0,100,0)'; rg.fillRect(0, 0, px, px);
  brushed(rg, px, 0.06);
  goldLayer(rg, 'rgb(0,64,255)');

  return { color: tex(c, aniso, true), rm: tex(r, aniso, false) };
}

/** Engraved marking, in mm relative to the lid centre (-Z is the top edge of the canvas). */
function lidMarking(g, k, ink) {
  const cx = (LID_FACE * k) / 2;
  const at = (z) => (LID_FACE / 2 + z) * k;
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  const text = (s, z, size, weight, family, spacing) => {
    g.font = `${weight} ${size * k}px ${family}`;
    if ('letterSpacing' in g) g.letterSpacing = `${spacing * k}px`;
    g.fillText(s, cx, at(z));
  };
  const rule = (z, w) => g.fillRect(cx - (w * k) / 2, at(z), w * k, 0.08 * k);
  text('SANTRONICA', -7.4, 2.3, 600, SANS, 0.3);
  rule(-5.1, 9);
  text('SNT-FX7 FPGA', -2.9, 1.4, 500, MONO, 0.05);
  text('SNTF9K400M', -0.5, 1.7, 600, MONO, 0.08);
  text('FBG512 · 2441', 1.9, 1.3, 400, MONO, 0.05);
  rule(4.4, 9);
  text('MADE IN INDIA', 6.6, 1.1, 500, MONO, 0.25);
}

/** Satin nickel lid. rm: G = roughness; engraved areas are matter (rougher) and darker. */
function lidMaps(px, aniso) {
  const k = px / LID_FACE;
  const c = canvas(px), g = c.getContext('2d');
  g.fillStyle = '#aeb3ba'; g.fillRect(0, 0, px, px);
  brushed(g, px, 0.07);
  lidMarking(g, k, '#3a3f46');

  const r = canvas(px), rg = r.getContext('2d');
  rg.fillStyle = 'rgb(0,150,0)'; rg.fillRect(0, 0, px, px);
  brushed(rg, px, 0.05);
  lidMarking(rg, k, 'rgb(0,210,0)');

  return { color: tex(c, aniso, true), rm: tex(r, aniso, false) };
}

/** Bare die: dark mirror-like silicon with a faint block structure and a bond-pad ring. */
function dieMaps(px, aniso) {
  const k = px / DIE_FACE, N = 12, cell = px / N;
  const c = canvas(px), g = c.getContext('2d');
  g.fillStyle = '#14202e'; g.fillRect(0, 0, px, px);
  const r = canvas(px), rg = r.getContext('2d');
  rg.fillStyle = 'rgb(0,30,0)'; rg.fillRect(0, 0, px, px);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const h = hash(i * 13 + j * 7);
      g.fillStyle = `rgba(255,255,255,${0.06 + 0.08 * h})`;
      g.fillRect(i * cell + 3, j * cell + 3, cell - 6, cell - 6);
      rg.fillStyle = `rgba(0,${Math.round(60 * h)},0,1)`;
      rg.fillRect(i * cell + 3, j * cell + 3, cell - 6, cell - 6);
    }
  }
  g.strokeStyle = '#4a5560'; g.lineWidth = Math.max(1, 0.03 * k);
  for (let i = 0; i <= N; i++) {
    g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, px); g.stroke();
    g.beginPath(); g.moveTo(0, i * cell); g.lineTo(px, i * cell); g.stroke();
  }
  // bond-pad ring along the edges: bright metal, smoother than the silicon
  const pad = 0.3 * k, pitch = 0.6 * k, margin = 0.8 * k;
  const pads = (ctx, fill) => {
    ctx.fillStyle = fill;
    for (let p = margin; p < px - margin; p += pitch) {
      ctx.fillRect(p, margin, pad, pad); ctx.fillRect(p, px - margin - pad, pad, pad);
      ctx.fillRect(margin, p, pad, pad); ctx.fillRect(px - margin - pad, p, pad, pad);
    }
  };
  pads(g, '#8a939c');
  pads(rg, 'rgb(0,64,0)');                          // roughness ~0.25 on the pads
  return { color: tex(c, aniso, true), rm: tex(r, aniso, false) };
}

function planeAt(size, y) {
  const geo = new THREE.PlaneGeometry(size, size);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y, 0);
  return geo;
}

export class ChipModel {
  constructor({ texRes = 2048, anisotropy = 8 } = {}) {
    const t0 = performance.now();
    this.group = new THREE.Group();                 // transformed by the site
    this.root = new THREE.Group();
    this.root.position.y = -YC;                     // rest bounding-box centre -> origin
    this.group.add(this.root);
    this.lidGroup = new THREE.Group();
    this.ballGroup = new THREE.Group();
    this.root.add(this.lidGroup, this.ballGroup);
    this.lastExplode = -1;
    this.instanced = [];                            // InstancedMeshes, disposed explicitly

    const sub = substrateMaps(texRes, anisotropy);
    const lid = lidMaps(texRes, anisotropy);
    const die = dieMaps(Math.max(512, texRes >> 1), anisotropy);
    this.textures = [sub.color, sub.rm, lid.color, lid.rm, die.color, die.rm];

    const mats = (this.materials = {
      subSide: new THREE.MeshPhysicalMaterial({ color: 0x282d35, roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.18 }),
      subTop: new THREE.MeshPhysicalMaterial({
        map: sub.color, roughnessMap: sub.rm, roughness: 1, metalnessMap: sub.rm, metalness: 1,
        clearcoat: 0.45, clearcoatRoughness: 0.16, envMapIntensity: 0.7,
      }),
      lidSide: new THREE.MeshPhysicalMaterial({ color: 0xaeb3ba, metalness: 1, roughness: 0.4, envMapIntensity: 0.8 }),
      lidTop: new THREE.MeshPhysicalMaterial({ map: lid.color, roughnessMap: lid.rm, roughness: 1, metalness: 1, envMapIntensity: 0.5 }),
      dieSide: new THREE.MeshPhysicalMaterial({ color: 0x1b2028, metalness: 0.7, roughness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.05 }),
      dieTop: new THREE.MeshPhysicalMaterial({
        map: die.color, roughnessMap: die.rm, roughness: 1, metalness: 0.9, clearcoat: 0.8, clearcoatRoughness: 0.03,
      }),
      capBody: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0 }),
      capTerm: new THREE.MeshStandardMaterial({ color: 0xc8cdd4, roughness: 0.3, metalness: 1 }),
      ball: new THREE.MeshStandardMaterial({ color: 0xd4d8de, roughness: 0.2, metalness: 1 }),
    });

    const add = (mesh, parent, { cast = false, recv = false } = {}) => {
      mesh.castShadow = cast;
      mesh.receiveShadow = recv;
      mesh.frustumCulled = false;
      parent.add(mesh);
      return mesh;
    };

    // Substrate: rounded laminate body plus a flat decal plane carrying the top artwork.
    add(new THREE.Mesh(new RoundedBoxGeometry(SUB, SUB_T, SUB, 2, SUB_R), mats.subSide), this.root, { cast: true, recv: true });
    add(new THREE.Mesh(planeAt(SUB_FACE, SUB_TOP + 0.003), mats.subTop), this.root, { recv: true });

    // Heat-spreader lid (moves with explode).
    const lidBody = add(new THREE.Mesh(new RoundedBoxGeometry(LID, LID_T, LID, 4, LID_R), mats.lidSide), this.lidGroup, { cast: true });
    lidBody.position.y = LID_Y;
    add(new THREE.Mesh(planeAt(LID_FACE, TOP + 0.003), mats.lidTop), this.lidGroup);

    // Bare die, hidden under the lid until it lifts.
    const dieBody = add(new THREE.Mesh(new RoundedBoxGeometry(DIE, DIE_T, DIE, 2, DIE_R), mats.dieSide), this.root, { cast: true, recv: true });
    dieBody.position.y = DIE_Y;
    add(new THREE.Mesh(planeAt(DIE_FACE, DIE_BOT + DIE_T + 0.003), mats.dieTop), this.root, { recv: true });

    this.buildCapacitors(mats);
    this.buildBalls(mats);

    const rest = this.hull(0);
    this.radius = 0;
    for (let i = 0; i < rest.length; i += 3) this.radius = Math.max(this.radius, Math.hypot(rest[i], rest[i + 1], rest[i + 2]));
    this.setExplode(0);
    this.buildMs = Math.round(performance.now() - t0);
  }

  /** 0402 decoupling capacitors in a ring on the substrate margin (two instanced parts). */
  buildCapacitors(mats) {
    const n = CAP_PER_SIDE * 4;
    const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, CAP_T, 0.5), mats.capBody, n);
    const terms = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, CAP_T + 0.01, 0.5), mats.capTerm, n * 2);
    const qX = new THREE.Quaternion();
    const qZ = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, Math.PI / 2);
    const M = new THREE.Matrix4(), P = new THREE.Vector3(), O = new THREE.Vector3(), Q = new THREE.Quaternion();
    const S1 = new THREE.Vector3(1, 1, 1), C = new THREE.Color();
    let ci = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const isX = dx !== 0;
      Q.copy(isX ? qX : qZ);
      for (let i = 0; i < CAP_PER_SIDE; i++) {
        const t = (i - (CAP_PER_SIDE - 1) / 2) * CAP_PITCH;
        P.set(isX ? dx * CAP_RING : t, SUB_TOP + CAP_T / 2, isX ? t : dz * CAP_RING);
        M.compose(P, Q, S1);
        caps.setMatrixAt(ci, M);
        C.set(hash(ci) < 0.7 ? 0xb9a077 : 0x2c3036);
        caps.setColorAt(ci, C);
        for (const sgn of [-1, 1]) {
          O.set(sgn * 0.375, 0, 0).applyQuaternion(Q).add(P);
          M.compose(O, Q, S1);
          terms.setMatrixAt(ci * 2 + (sgn > 0 ? 1 : 0), M);
        }
        ci++;
      }
    }
    caps.instanceColor.needsUpdate = true;
    for (const m of [caps, terms]) {
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      this.root.add(m); this.instanced.push(m);
    }
  }

  /** Tin ball grid under the substrate (moves down with explode). */
  buildBalls(mats) {
    const n = BALL_N * BALL_N;
    const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(BALL_R, 6, 4), mats.ball, n);
    const M = new THREE.Matrix4();
    let k = 0;
    for (let i = 0; i < BALL_N; i++) {
      for (let j = 0; j < BALL_N; j++) {
        const x = (i - (BALL_N - 1) / 2) * PITCH, z = (j - (BALL_N - 1) / 2) * PITCH;
        balls.setMatrixAt(k++, M.makeTranslation(x, BALL_Y, z));
      }
    }
    balls.frustumCulled = false;
    this.ballGroup.add(balls);
    this.instanced.push(balls);
  }

  /** Corner points (model-space mm, flat [x, y, z, ...]) of the substrate, lid and balls at this explode. */
  hull(explode = 0) {
    const t = smootherstep(explode), lift = LIFT_LID * t, drop = DROP_BALLS * t, out = [];
    const box = (x0, x1, y0, y1, z0, z1) => {
      for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) out.push(x, y - YC, z);
    };
    box(-SUB / 2, SUB / 2, -SUB_T / 2, SUB_TOP, -SUB / 2, SUB / 2);
    box(-LID / 2, LID / 2, SUB_TOP + lift, TOP + lift, -LID / 2, LID / 2);
    box(-BALL_HALF, BALL_HALF, BOT - drop, BALL_Y + BALL_R - drop, -BALL_HALF, BALL_HALF);
    return out;
  }

  /** 0 = assembled, 1 = lid lifted 10 mm and balls dropped 3 mm, die revealed. Cheap when unchanged. */
  setExplode(e) {
    const x = clamp01(e);
    if (Math.abs(x - this.lastExplode) < 1e-4) return;
    this.lastExplode = x;
    const t = smootherstep(x);
    this.lidGroup.position.y = LIFT_LID * t;
    this.ballGroup.position.y = -DROP_BALLS * t;
  }

  info() {
    let tris = 0;
    this.group.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3;
      tris += n * (o.isInstancedMesh ? o.count : 1);
    });
    return { triangles: Math.round(tris), buildMs: this.buildMs };
  }

  dispose() {
    this.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const m of this.instanced) m.dispose();    // frees instanceMatrix / instanceColor buffers
    for (const m of Object.values(this.materials)) m.dispose();
    for (const t of this.textures) t.dispose();
  }
}
