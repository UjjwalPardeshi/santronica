/*
 * Assembles the PCB: substrate (top / bottom / FR-4 edge / plated holes) and
 * every instanced component kind. Owns the exploded-view animation.
 */
import * as THREE from 'three';
import { BOARD, PARTS } from './layout.js';
import { createMaterials, createGeometries, buildInstances, partLiftTable, MARK_CELLS } from './parts.js';
import { buildBoardTextures, buildEdgeTexture, buildMarkAtlas, buildEcapTopTexture, buildModuleTexture } from './textures.js';

// kind -> [geometry, material, castShadow]
const KINDS = {
  lqfp: ['lqfp', 'epoxy', true], soic: ['soic', 'epoxy', true], qfn: ['qfn', 'epoxy', true],
  sot: ['sot', 'epoxy', true], sot5: ['sot5', 'epoxy', true], sod: ['sod', 'epoxy', true],
  leadQfp: ['leadQfp', 'tin', true], leadSoic: ['leadSoic', 'tin', true], leadSot: ['leadSot', 'tin', false],
  tin: ['box', 'tin', false], dark: ['box', 'dark', false], beige: ['box', 'beige', true], gold: ['box', 'gold', false],
  xtalLid: ['xtalLid', 'nickel', true], inductor: ['inductor', 'ferrite', true],
  ecapBase: ['ecapBase', 'plastic', true], ecapCan: ['ecapCan', 'alu', true], ecapTop: ['disc', 'ecapTop', false],
  usbShell: ['usbShell', 'nickel', true], usbBack: ['usbBack', 'nickel', false],
  termBody: ['termBody', 'term', true], nickelCyl: ['cyl', 'nickel', false], solderCone: ['cone', 'solder', false],
  hdrBody: ['hdrBody', 'plastic', true], pin: ['box', 'gold', true],
  modPcb: ['modPcb', 'modPcb', true], modTop: ['plane', 'modTop', false], can: ['can', 'nickel', true],
  plastic: ['box', 'plastic', true], plate: ['plate', 'nickel', true], plasticCyl: ['cyl', 'plastic', true],
  ledBody: ['box', 'ledBody', false], lens: ['box', 'lens', false],
  ceramic: ['box', 'ceramic', true], fillet: ['fillet', 'solder', false], marks: ['plane', 'marks', false],
};

const RX180 = new THREE.Matrix4().makeRotationX(Math.PI);

function boardShape() {
  const { w, h, corner: r, holes, drill } = BOARD, s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(w / 2, h / 2 - r); s.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2, false);
  s.lineTo(-w / 2 + r, h / 2); s.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-w / 2, -h / 2 + r); s.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5, false);
  for (const [x, y] of holes) s.holes.push(new THREE.Path().absarc(x, y, drill / 2, 0, Math.PI * 2, true));
  return s;
}

function capGeometry(shape, bottom) {
  const g = new THREE.ShapeGeometry(shape, 16);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) + BOARD.w / 2) / BOARD.w, v = (pos.getY(i) + BOARD.h / 2) / BOARD.h;
    uv.setXY(i, bottom ? 1 - u : u, v);
  }
  g.rotateX(-Math.PI / 2);
  g.translate(0, bottom ? -BOARD.t / 2 : BOARD.t / 2, 0);
  if (bottom) {
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.computeVertexNormals();
  }
  return g;
}

const EDGE_UV = {
  generateTopUV: () => [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()],
  generateSideWallUV(geometry, v, a, b, c, d) {
    const p = (i) => [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]];
    const [A, B, C, D] = [p(a), p(b), p(c), p(d)];
    const horiz = Math.abs(A[1] - B[1]) < Math.abs(A[0] - B[0]);
    const u = (q) => (horiz ? q[0] : q[1]) * 0.25;
    return [A, B, C, D].map((q) => new THREE.Vector2(u(q), q[2] / BOARD.t));
  },
};

function edgeGeometry(shape) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: BOARD.t, bevelEnabled: false, curveSegments: 16, UVGenerator: EDGE_UV });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -BOARD.t / 2, 0);
  return g;
}

function markCells() {
  const byId = Object.fromEntries(PARTS.map((p) => [p.id, p]));
  const spec = {
    U1: { w: 10, d: 10, dot: [1.1, 1.1], maxFs: 1.05 }, U2: { w: 4.9, d: 3.9, dot: [0.55, 3.35] }, U3: { w: 4.9, d: 3.9, dot: [0.55, 3.35] },
    U4: { w: 4.9, d: 3.9, dot: [0.55, 3.35] }, U5: { w: 5, d: 5, dot: [0.6, 0.6] }, U6: { w: 4.9, d: 3.9, dot: [0.55, 3.35] },
    L1: { w: 6, d: 6, lines: ['4R7'], maxFs: 1.3 }, Y1: { w: 4.5, d: 2.7, lines: ['24.000', 'SNT'], maxFs: 0.62 }, M1: { w: 16, d: 17.6, lines: ['SANTRONICA', 'SNT-RF24', '2.4 GHz'], maxFs: 1.25 },
  };
  return MARK_CELLS.map((id) => ({ ...spec[id], lines: spec[id].lines || byId[id].mark || [id] }));
}

export class PcbModel {
  constructor({ texRes = 2048, palette = 'green', anisotropy = 8 } = {}) {
    this.group = new THREE.Group();        // scaled/rotated by the choreography
    this.lastExplode = -1;
    const mats = (this.materials = createMaterials());
    const geos = (this.geometries = createGeometries());

    // Board substrate
    const t0 = performance.now();
    const tex = (this.textures = buildBoardTextures({ res: texRes, palette, anisotropy }));
    this.texMs = Math.round(performance.now() - t0);
    const shape = boardShape();
    this.topMat = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.6, clearcoatRoughness: 0.2,
      map: tex.top.color, bumpMap: tex.top.rmb, bumpScale: 1.6, roughnessMap: tex.top.rmb, metalnessMap: tex.top.rmb,
      aoMap: tex.top.ao, aoMapIntensity: 1, roughness: 1, metalness: 1,
    });
    const botMat = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.6, clearcoatRoughness: 0.2,
      map: tex.bottom.color, bumpMap: tex.bottom.rmb, bumpScale: 1.2, roughnessMap: tex.bottom.rmb, metalnessMap: tex.bottom.rmb, roughness: 1, metalness: 1,
    });
    const edgeMat = new THREE.MeshStandardMaterial({ map: buildEdgeTexture(palette), roughness: 0.55 });
    const top = new THREE.Mesh(capGeometry(shape, false), this.topMat);
    const bot = new THREE.Mesh(capGeometry(shape, true), botMat);
    const edge = new THREE.Mesh(edgeGeometry(shape), [new THREE.MeshBasicMaterial({ visible: false }), edgeMat]);
    top.receiveShadow = bot.receiveShadow = true;
    edge.castShadow = true;
    this.group.add(top, bot, edge);

    // Plated mounting-hole barrels
    const barrelMat = mats.gold.clone(); barrelMat.side = THREE.DoubleSide;
    const barrels = new THREE.InstancedMesh(geos.tube, barrelMat, BOARD.holes.length);
    BOARD.holes.forEach(([x, y], i) => barrels.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, 0, -y), new THREE.Quaternion(), new THREE.Vector3(BOARD.drill / 2 - 0.01, BOARD.t + 0.02, BOARD.drill / 2 - 0.01))));
    this.group.add(barrels);

    // Textured decals
    mats.marks.map = buildMarkAtlas(markCells());
    mats.marks.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 uvOff;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = vMapUv * 0.25 + uvOff;');
    };
    mats.ecapTop.map = buildEcapTopTexture();
    mats.modTop = new THREE.MeshStandardMaterial({ map: buildModuleTexture(), roughness: 0.45 });
    mats.modPcb.color.set(0x10161f);

    // Instanced components
    this.lift = partLiftTable();
    const byKind = new Map();
    for (const rec of buildInstances()) {
      if (!byKind.has(rec.kind)) byKind.set(rec.kind, []);
      byKind.get(rec.kind).push(rec);
    }
    this.batches = [];
    for (const [kind, recs] of byKind) {
      const [gk, mk, cast] = KINDS[kind];
      const geo = kind === 'marks' ? geos.plane.clone() : geos[gk];
      const mesh = new THREE.InstancedMesh(geo, mats[mk], recs.length);
      mesh.castShadow = cast;
      mesh.receiveShadow = kind === 'modTop' || kind === 'modPcb';
      mesh.frustumCulled = false;
      recs.forEach((r, i) => {
        if (r.flip) r.m.multiply(RX180);
        mesh.setMatrixAt(i, r.m);
        if (r.color !== undefined) mesh.setColorAt(i, new THREE.Color(r.color));
      });
      if (kind === 'marks') {
        const off = new Float32Array(recs.length * 2);
        recs.forEach((r, i) => { off[i * 2] = (r.cell % 4) / 4; off[i * 2 + 1] = 1 - (Math.floor(r.cell / 4) + 1) / 4; });
        geo.setAttribute('uvOff', new THREE.InstancedBufferAttribute(off, 2));
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.group.add(mesh);
      this.batches.push({ mesh, recs });
    }
    this.group.traverse((o) => { o.frustumCulled = false; });
    this.setExplode(0);
  }

  /** 0 = assembled, 1 = fully exploded. Cheap no-op when unchanged. */
  setExplode(e) {
    if (Math.abs(e - this.lastExplode) < 1e-4) return;
    this.lastExplode = e;
    const lifts = this.lift.map(({ h, delay }) => {
      const p = Math.min(1, Math.max(0, (e - delay) / (1 - 0.32)));
      return h * p * p * p * (p * (p * 6 - 15) + 10);
    });
    const m = new THREE.Matrix4();
    for (const { mesh, recs } of this.batches) {
      recs.forEach((r, i) => { m.copy(r.m); m.elements[13] += lifts[r.part] * r.liftMul; mesh.setMatrixAt(i, m); });
      mesh.instanceMatrix.needsUpdate = true;
    }
    this.topMat.aoMapIntensity = 1 - 0.8 * Math.min(1, e * 1.6);
  }

  /** Axis-aligned model-space extents (mm) used for fitting, including exploded height. */
  extents(explode) {
    return { x: BOARD.w / 2, z: BOARD.h / 2, yMin: -2.5, yMax: 6 + explode * 40 };
  }

  info() {
    let tris = 0, calls = 3 + 1;
    const triCount = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
    this.group.traverse((o) => {
      if (!o.isMesh) return;
      tris += triCount(o.geometry) * (o.isInstancedMesh ? o.count : 1);
    });
    calls += this.batches.length;
    return { triangles: Math.round(tris), batches: calls };
  }

  dispose() {
    this.group.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((mt) => { for (const k of ['map', 'bumpMap', 'roughnessMap', 'metalnessMap', 'aoMap']) mt[k]?.dispose?.(); mt.dispose(); });
    });
  }
}
