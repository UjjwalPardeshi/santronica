/*
 * Renderer, camera and studio lighting for the floating board.
 * Transparent canvas: the page's flat section colours show through.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';

export const CAMERA_DISTANCE = 1000;
const FOV = 24;

export function createStage(canvas, { dpr }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.03).texture;
  scene.environmentIntensity = 0.55;
  room.dispose?.();
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(FOV, 1, 20, 6000);
  camera.position.set(0, 0, CAMERA_DISTANCE);
  camera.lookAt(0, 0, 0);

  // Warm key light from upper-left-front (casts the component shadows), cool rim from behind.
  const key = new THREE.DirectionalLight(0xfff3e4, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 3;
  key.shadow.bias = -0.0004;
  const rim = new THREE.DirectionalLight(0xe4ecff, 1.6);
  const fill = new THREE.HemisphereLight(0xf3f6ff, 0x1a1c20, 0.12);
  scene.add(key, key.target, rim, rim.target, fill);

  const KEY_DIR = new THREE.Vector3(-0.55, 0.95, 0.75).normalize();
  const RIM_DIR = new THREE.Vector3(0.45, 0.55, -0.9).normalize();

  return {
    renderer, scene, camera, key, rim,
    /** World units per CSS pixel on the z = 0 plane. */
    unitsPerPx(viewportHeight) {
      return (2 * CAMERA_DISTANCE * Math.tan((FOV * Math.PI) / 360)) / viewportHeight;
    },
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    /** Keep the lights (and the shadow frustum) wrapped around the board. */
    aimLights(center, radius) {
      key.target.position.copy(center);
      key.position.copy(center).addScaledVector(KEY_DIR, radius * 4);
      const cam = key.shadow.camera;
      cam.left = -radius; cam.right = radius; cam.top = radius; cam.bottom = -radius;
      cam.near = radius * 0.5; cam.far = radius * 8;
      cam.updateProjectionMatrix();
      key.shadow.normalBias = radius * 0.0009;
      rim.target.position.copy(center);
      rim.position.copy(center).addScaledVector(RIM_DIR, radius * 4);
    },
  };
}
