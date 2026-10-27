import * as THREE from 'three';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import { createAvModifier } from './avModifier.js';

/**
 * SplatStage — owns the three.js scene and the splat, applies audio-driven
 * visual params every frame.
 *
 * The AVParams → visual math lives in mapping (pure, tested); this file is
 * the only place that touches three.js/Spark.
 */
export function createSplatStage({ canvas, splatUrl, view, spin }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0b10);

  const camera = new THREE.PerspectiveCamera(
    60, canvas.clientWidth / canvas.clientHeight, 0.01, 100,
  );
  camera.position.set(0, 0.4, 4.5);
  camera.lookAt(0, 0, 0);

  // ?view= gives a splat-specific basis: look-at point, then camera
  // position (each 3 numbers). Scenes other than the test splat have
  // their own scale and center; this aims the camera without touching
  // the default path.
  if (view?.camPos) camera.position.set(...view.camPos);
  if (view?.lookAt) camera.lookAt(...view.lookAt);

  const splat = new SplatMesh({ url: splatUrl });
  splat.quaternion.array = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2]; // y-down → y-up
  splat.scale.setScalar(1);
  scene.add(splat);

  // ── Stage 2: per-splat audio deformation (GPU dyno graph) ──
  const av = createAvModifier();
  splat.objectModifier = av.modifier;

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
    // feed the GPU dyno graph (its own smoothing is the protocol's job —
    // driver already smoothed; we only ramp gently to avoid pops on edits)
    av.uniforms.uLow.value += (params.bands.low - av.uniforms.uLow.value) * Math.min(1, dt * 30);
    av.uniforms.uMid.value += (params.bands.mid - av.uniforms.uMid.value) * Math.min(1, dt * 30);
    av.uniforms.uHigh.value += (params.bands.high - av.uniforms.uHigh.value) * Math.min(1, dt * 30);
    av.uniforms.uOnset.value = params.onset;
    av.uniforms.uCentroid.value = params.centroid;
    av.uniforms.uTime.value = params.time;

    // gentle whole-object scale remains (Stage 1 behavior, now secondary
    // to the per-splat region response)
    const breathe = params.bands.low * 0.7 + params.bands.mid * 0.2 + params.bands.high * 0.1;
    const target = 1 + breathe * 0.08 + params.onset * 0.1;
    const k = 1 - Math.exp(-dt * 12);
    splat.scale.setScalar(splat.scale.x + (target - splat.scale.x) * k);
  }

  function render(timeSeconds) {
    resize();
    if (spin !== 0) splat.rotation.y = timeSeconds * 0.15; // slow idle spin; ?spin=0 stills it
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
