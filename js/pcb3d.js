/*
 * Santronica — floating 3D PCB.
 * Loaded only when the <head> probe found WebGL, no reduced-motion and no
 * Save-Data (html.pcb). Follows the page's [data-pcb-slot] boxes while scrolling.
 * Contract: see the SPEC — window.SantronicaPCB { ready, snap(), isSettled(), info() },
 * html.pcb-live after the first frame, html.pcb-failed on any failure, ?pcbdebug HUD.
 */
import * as THREE from 'three';
import { createStage } from './pcb/scene.js';
import { PcbModel } from './pcb/board.js';
import { Choreo, poseQuaternion, ANGLES } from './pcb/choreo.js';
import { Spring } from './pcb/spring.js';

const html = document.documentElement;
const params = new URLSearchParams(location.search);
const DEBUG = params.has('pcbdebug');
const POSTER = params.has('pcbposter');
const coarse = matchMedia('(pointer: coarse)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const small = () => innerWidth < 768;

const api = (window.SantronicaPCB = { ready: false, snap() {}, isSettled: () => false, info: () => null });

function fail(err) {
  if (!html.classList.contains('pcb-failed')) console.warn('[pcb] disabled:', err && err.message ? err.message : err);
  html.classList.remove('pcb-live');
  html.classList.add('pcb-failed');
}

const T = { start: performance.now() };
const mark = (k) => { T[k] = Math.round(performance.now() - T.start); };

async function boot() {
  const stage = document.getElementById('pcbStage') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'pcbStage', className: 'pcb-stage' }));
  stage.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'presentation');
  canvas.style.cssText = 'display:block;width:100%;height:100%;';
  stage.appendChild(canvas);

  if (DEBUG) html.classList.add('pcb-debug');
  if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);

  mark('fonts');
  const maxDpr = coarse ? 1.5 : 2;
  let dpr = Math.min(devicePixelRatio || 1, maxDpr);
  const S = createStage(canvas, { dpr });
  const aniso = Math.min(8, S.renderer.capabilities.getMaxAnisotropy());
  const model = new PcbModel({ texRes: small() || coarse ? 1024 : 2048, palette: stage.dataset.pcbPalette || 'green', anisotropy: aniso });
  mark('model');
  S.scene.add(model.group);

  const choreo = new Choreo({ extents: (e) => model.extents(e), travelOpacity: small() || coarse ? 0.1 : 0.16 });

  // Springs (critically damped). Position/size are CSS px; angles degrees.
  const sp = {};
  for (const k of ['x', 'y', 's', 'ox', 'oy', ...ANGLES, 'explode', 'opacity']) sp[k] = new Spring(0, k === 'opacity' ? 0.5 : 0.44);
  const tilt = { x: new Spring(0, 0.7), y: new Spring(0, 0.7) };

  let vw = 0, vh = 0, measured = false;
  const layout = () => {
    vw = stage.clientWidth || innerWidth; vh = stage.clientHeight || innerHeight;
    S.resize(vw, vh);
    choreo.travelOpacity = small() || coarse ? 0.1 : 0.16;
    choreo.measure();
    measured = true;
  };
  let layoutTimer = 0;
  const relayout = () => { clearTimeout(layoutTimer); layoutTimer = setTimeout(layout, 120); };
  addEventListener('resize', relayout, { passive: true });
  addEventListener('load', relayout);
  if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(document.body);

  const pointer = { x: 0.5, y: 0.5 };
  if (finePointer && !POSTER) addEventListener('pointermove', (e) => { pointer.x = e.clientX / innerWidth; pointer.y = e.clientY / innerHeight; }, { passive: true });

  const setTargets = () => {
    const t = choreo.target(scrollY, vw, vh);
    if (!t) return false;
    for (const k of Object.keys(sp)) sp[k].target = t[k];
    tilt.x.target = finePointer && !POSTER ? (pointer.y - 0.5) * -5 : 0;
    tilt.y.target = finePointer && !POSTER ? (pointer.x - 0.5) * 7 : 0;
    return true;
  };

  const q = new THREE.Quaternion(), qt = new THREE.Quaternion(), eul = new THREE.Euler();
  const center = new THREE.Vector3();
  let clock = 0;
  const pose = {};
  const apply = () => {
    const upp = S.unitsPerPx(vh);
    const float = POSTER ? 0 : 1;
    const bob = Math.sin((clock * 2 * Math.PI) / 6.2) * 0.012 * 100 * sp.s.value * float;
    for (const k of ANGLES) pose[k] = sp[k].value;
    pose.rx += Math.sin((clock * 2 * Math.PI) / 7.4) * 1.2 * float;
    pose.spin += Math.sin((clock * 2 * Math.PI) / 9.3 + 1) * 1.5 * float;
    pose.rz += Math.sin((clock * 2 * Math.PI) / 11.1 + 2) * 0.5 * float;
    poseQuaternion(pose, q);
    eul.set(tilt.x.value * (Math.PI / 180), tilt.y.value * (Math.PI / 180), 0, 'XYZ');
    q.premultiply(qt.setFromEuler(eul));

    const scale = sp.s.value * upp;
    model.group.quaternion.copy(q);
    model.group.scale.setScalar(Math.max(scale, 1e-4));
    model.group.position.set((sp.x.value - vw / 2) * upp - sp.ox.value * scale, -(sp.y.value + bob - vh / 2) * upp - sp.oy.value * scale, 0);
    model.setExplode(Math.min(1, Math.max(0, sp.explode.value)));
    center.copy(model.group.position);
    S.aimLights(center, scale * 70);
    const op = Math.min(1, Math.max(0, sp.opacity.value));
    if (Math.abs(op - apply.op) > 0.004) { canvas.style.opacity = op.toFixed(3); apply.op = op; }
  };
  apply.op = -1;

  const onScreen = () => {
    const half = 0.62 * 100 * sp.s.value;
    return sp.y.value + half > -40 && sp.y.value - half < vh + 40 && sp.opacity.value > 0.01;
  };

  // Debug HUD
  let hud = null, fps = 0, frames = 0, fpsT = performance.now();
  if (DEBUG) {
    hud = document.createElement('div');
    hud.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9999;font:12px/1.4 ui-monospace,monospace;background:rgba(0,0,0,.72);color:#9ef;padding:8px 10px;border-radius:8px;pointer-events:none;white-space:pre';
    document.body.appendChild(hud);
  }

  // Adaptive resolution: step the DPR down if frames stay slow.
  let slowFrames = 0;
  const adapt = (dt) => {
    if (dt > 0.024) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 90 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); S.renderer.setPixelRatio(dpr); S.resize(vw, vh); slowFrames = 0; }
  };

  let raf = 0, last = performance.now(), firstFrame = true, lost = false, frozen = false;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!measured || frozen) return;
    clock += POSTER ? 0 : dt;
    if (!setTargets()) return;
    for (const k in sp) sp[k].step(dt);
    tilt.x.step(dt); tilt.y.step(dt);
    apply();
    if (onScreen() || firstFrame) {
      S.renderer.render(S.scene, S.camera);
      if (firstFrame) mark('firstRender');
      if (!firstFrame) adapt(dt);
    }
    if (firstFrame) {
      firstFrame = false;
      requestAnimationFrame(() => { html.classList.add('pcb-live'); api.ready = true; });
    }
    if (hud && ++frames && now - fpsT > 500) {
      fps = Math.round((frames * 1000) / (now - fpsT)); frames = 0; fpsT = now;
      const c = choreo.last;
      hud.textContent = `pair  ${c.pair ? c.pair.join(' → ') : '-'}\nt     ${c.t.toFixed(3)}\nfps   ${fps}\ndpr   ${dpr}\ncalls ${S.renderer.info.render.calls}  tris ${S.renderer.info.render.triangles}`;
    }
  };

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; cancelAnimationFrame(raf); fail(new Error('WebGL context lost')); });

  layout();
  setTargets();
  for (const k in sp) sp[k].snap();
  apply();
  // Compile off the main thread where the GPU driver supports it; otherwise compile on first render.
  if (S.renderer.compileAsync && S.renderer.extensions.has('KHR_parallel_shader_compile')) await S.renderer.compileAsync(S.scene, S.camera);
  mark('compiled');
  // Materialise: start slightly small and transparent, settle with the springs.
  sp.s.value *= 0.92; sp.opacity.value = 0;
  apply();
  raf = requestAnimationFrame(frame);

  Object.assign(api, {
    snap() {
      if (lost) return;
      layout(); setTargets();
      for (const k in sp) sp[k].snap();
      tilt.x.snap(); tilt.y.snap();
      apply();
      S.renderer.render(S.scene, S.camera);
    },
    /** Test hook: stop per-frame rendering (snap() still renders) for deterministic screenshots. */
    freeze(on = true) { frozen = !!on; },
    isSettled: () => Object.values(sp).every((s) => s.settled(0.01)),
    info: () => ({
      drawCalls: S.renderer.info.render.calls,
      triangles: S.renderer.info.render.triangles,
      slots: choreo.slots.map((s) => s.name),
      activePair: choreo.last.pair,
      t: choreo.last.t,
      dpr,
      timings: { ...T },
    }),
  });
}

boot().catch(fail);
