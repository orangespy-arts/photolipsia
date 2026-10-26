import * as THREE from 'three';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';

/**
 * SplatStage — owns the three.js scene and the splat, applies audio-driven
 * visual params every frame.
 *
 * The AVParams → visual math lives in mapping (pure, tested); this file is
 * the only place that touches three.js/Spark.
 */
export function createSplatStage({ canvas, splatUrl }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0b10);

  const camera = new THREE.PerspectiveCamera(
    60, canvas.clientWidth / canvas.clientHeight, 0.01, 100,
  );
  camera.position.set(0, 0.4, 4.5);
  camera.lookAt(0, 0, 0);

  const splat = new SplatMesh({ url: splatUrl });
  splat.quaternion.array = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2]; // y-down → y-up
  splat.scale.setScalar(1);
  scene.add(splat);

  // SparkRenderer is the actual splat-drawing pass (a THREE.Mesh attached
  // to the camera) — without it the canvas stays black even though the
  // splat data is loaded and counted.
  const sparkRenderer = new SparkRenderer({ renderer });
  camera.add(sparkRenderer);
  scene.add(camera);

  // audio state, updated by updateParams(); consumed by the dyno modifier
  const audio = {
    bands: { low: 0, mid: 0, high: 0 },
    onset: 0,
    centroid: 0,
  };

  let ready = false;
  let loadError = null;
  splat.initialized.then(
    () => { ready = true; },
    (err) => { loadError = err?.message ?? String(err); },
  );

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  let hueApplied = 0; // stored only in Stage 1; per-splat hue lands in Stage 2 dyno

  /**
   * Per-frame update. params: sanitized AVParams frame.
   * Stage-1 visual response (global, on the whole splat object):
   *   low  → breathing scale     onset → punch extra scale
   *   centroid → hue rotation    (per-splat dyno comes in Stage 2)
   */
  function updateParams(params, dt) {
    if (!ready) return;
    // bands average as the breathing driver (low-weighted)
    const breathe = params.bands.low * 0.7 + params.bands.mid * 0.2 + params.bands.high * 0.1;
    const target = 1 + breathe * 0.25 + params.onset * 0.35;
    // smooth toward target — visual tempo, deliberately slower than audio
    const k = 1 - Math.exp(-dt * 12);
    splat.scale.setScalar(splat.scale.x + (target - splat.scale.x) * k);

    // hue rotation from spectral centroid
    const hueShift = (params.centroid - 0.5) * 0.3;
    hueApplied = hueShift;
  }

  function render(timeSeconds) {
    resize();
    splat.rotation.y = timeSeconds * 0.15; // slow idle spin for life
    renderer.render(scene, camera);
  }

  return {
    updateParams, render,
    get ready() { return ready; },
    get loadError() { return loadError; },
    get splat() { return splat; },
    get diag() {
      return {
        ready, loadError,
        numSplats: splat.numSplats,
        splatScale: splat.scale.x,
        camPos: camera.position.toArray(),
        inScene: scene.children.includes(splat),
      };
    },
  };
}
