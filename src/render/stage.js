import * as THREE from 'three';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import { createAvModifier } from './avModifier.js';
import { parseTf } from './framing.js';

/**
 * SplatStage — owns the three.js scene and the splat, applies audio-driven
 * visual params every frame.
 *
 * The AVParams → visual math lives in mapping (pure, tested); this file is
 * the only place that touches three.js/Spark.
 */
export function createSplatStage({ canvas, splatUrl, view, spin, tf }) {
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

  // ?tf= splat basis transform: position, euler-degrees rotation, uniform
  // scale — lets a non-centered scan be placed without retraining it.
  // The y-up flip stays on the quaternion (applied first); the tf euler
  // rotation composes after it. baseScale feeds the breathing multiplier.
  let tfScale = 1;
  if (tf) {
    const t = parseTf(tf);
    if (t) {
      splat.position.set(...t.position);
      splat.rotation.set(
        THREE.MathUtils.degToRad(t.rotationDeg[0]),
        THREE.MathUtils.degToRad(t.rotationDeg[1]),
        THREE.MathUtils.degToRad(t.rotationDeg[2]),
      );
      tfScale = t.scale;
      splat.scale.setScalar(tfScale);
    }
  }
  const baseScale = 1;

  // ── Stage 2: per-splat audio deformation (GPU dyno graph) ──
  const av = createAvModifier();
  splat.objectModifier = av.modifier;

  // SparkRenderer is the actual splat-drawing pass (a THREE.Mesh attached
  // to the camera) — without it the canvas stays black even though the
  // splat data is loaded and counted.
  const sparkRenderer = new SparkRenderer({ renderer });
  camera.add(sparkRenderer);
  scene.add(camera);

  // ── interactive framing (like a 3D DCC): drag-orbit, wheel-dolly,
  // right/shift-drag pan. Only active when ?spin=0 — with idle spin the
  // splat moves under the cursor and the two motions fight. The controller
  // writes camera state; liveCameraState() reads it back for link copy.
  let orbiting = false;
  const orbit = {
    target: view?.lookAt ? new THREE.Vector3(...view.lookAt)
      : new THREE.Vector3(0, 0, 0),
    // spherical (radius, theta around y, phi from y axis) about target
    radius: camera.position.distanceTo(camera.position.clone().setFromMatrixPosition(camera.matrixWorld)),
  };
  // derive spherical from the final camera pose (view params already applied)
  {
    const off = camera.position.clone().sub(orbit.target);
    orbit.radius = off.length();
    orbit.theta = Math.atan2(off.x, off.z);
    orbit.phi = Math.acos(THREE.MathUtils.clamp(off.y / Math.max(1e-6, orbit.radius), -1, 1));
  }
  function applyOrbit() {
    const sinPhi = Math.sin(orbit.phi);
    camera.position.set(
      orbit.target.x + orbit.radius * sinPhi * Math.sin(orbit.theta),
      orbit.target.y + orbit.radius * Math.cos(orbit.phi),
      orbit.target.z + orbit.radius * sinPhi * Math.cos(orbit.theta),
    );
    camera.lookAt(orbit.target);
  }
  const pointerState = { active: false, button: 0, x: 0, y: 0, shift: false };
  canvas.addEventListener('pointerdown', (e) => {
    if (spin !== 0) return; // idle spin owns the motion; drag fights it
    pointerState.active = true;
    pointerState.button = e.button;
    pointerState.shift = e.shiftKey;
    pointerState.x = e.clientX;
    pointerState.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointerState.active) return;
    const dx = e.clientX - pointerState.x;
    const dy = e.clientY - pointerState.y;
    pointerState.x = e.clientX;
    pointerState.y = e.clientY;
    if (pointerState.button === 2 || pointerState.shift) {
      // pan: move target in the camera's screen plane
      const scale = orbit.radius * 0.0016;
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
      orbit.target.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
    } else {
      // orbit: drag right → scene turns right (theta decreases)
      orbit.theta -= dx * 0.005;
      orbit.phi = THREE.MathUtils.clamp(orbit.phi - dy * 0.005, 0.05, Math.PI - 0.05);
    }
    applyOrbit();
  });
  canvas.addEventListener('pointerup', (e) => {
    pointerState.active = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* already up */ }
  });
  canvas.addEventListener('wheel', (e) => {
    if (spin !== 0) return;
    e.preventDefault();
    orbit.radius = THREE.MathUtils.clamp(
      orbit.radius * Math.exp(e.deltaY * 0.0012), 0.05, 200,
    );
    applyOrbit();
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); });
  function liveCameraState() {
    return {
      lookAt: orbit.target.toArray(),
      camPos: camera.position.toArray(),
    };
  }

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
    // to the per-splat region response); multiplies the ?tf= base scale
    const breathe = params.bands.low * 0.7 + params.bands.mid * 0.2 + params.bands.high * 0.1;
    const target = (baseScale + breathe * 0.08 + params.onset * 0.1) * tfScale;
    const k = 1 - Math.exp(-dt * 12);
    splat.scale.setScalar(splat.scale.x + (target - splat.scale.x) * k);
  }

  function render(timeSeconds) {
    resize();
    // slow idle spin for life; ?spin=0 stills it (also the drag-orbit gate).
    // Writes only the y component so a ?tf= rotation survives.
    if (spin !== 0) splat.rotation.y = timeSeconds * 0.15;
    renderer.render(scene, camera);
  }

  return {
    updateParams, render,
    get ready() { return ready; },
    get loadError() { return loadError; },
    get splat() { return splat; },
    liveCameraState,
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
