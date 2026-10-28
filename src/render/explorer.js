import * as THREE from 'three';
import { createPlants } from './plants.js';
import { createGlassBall } from './glassBall.js';
import { movementDirection, advanceMotion, followWeight } from './explorerMotion.js';
import { bindExplorerInput } from './explorerInput.js';
import { bindMouseLook, turnView, viewOffset } from './mouseLook.js';

/**
 * Explorer — third-person ball that rolls through the splat scene and
 * grows mesh plants along its path. Arrow keys move relative to the camera;
 * a damped chase camera follows; leaves unfold where the glass ball passes.
 *
 * Pure plant math lives in mapping/plants.js; this file is the
 * render/input shell that feeds it.
 */
export function createExplorer({ scene, camera, config, isStageReady, canvas, onLookStatus }) {
  const ball = createGlassBall();
  scene.add(ball);

  // Plants receive light; the scanned environment retains its original colors.
  const light = new THREE.DirectionalLight(0xffffff, 1.2);
  light.position.set(1, 3, 2);
  scene.add(light);
  const ambient = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambient);

  // ── ground height: flat plane per scene (no physics); ruin1 floor ≈ -0.23 ──
  const { groundY, spawn, cameraOffset } = config;
  // The anchor and plant roots share exactly the same ground plane.
  const BALL_R = ball.geometry.parameters.radius;

  // ── movement state: direction keys held, velocity with damping ──
  const vel = new THREE.Vector3();
  const pos = new THREE.Vector3(spawn[0], groundY + BALL_R, spawn[2]);
  ball.position.copy(pos);
  ball.visible = false;
  let active = false;
  const input = bindExplorerInput(window, document, () => active,
    () => vel.set(0, 0, 0));
  const keys = input.keys;

  // Smooth the follow pivot, but apply mouse orientation immediately.
  const distance = Math.max(0.5, Math.hypot(...cameraOffset));
  let view = {
    yaw: Math.atan2(-cameraOffset[0], cameraOffset[2]),
    pitch: Math.min(1.25, Math.max(0.04, Math.atan2(cameraOffset[1], Math.hypot(cameraOffset[0], cameraOffset[2])))),
  };
  const pivot = pos.clone();
  const applyCamera = () => {
    camera.position.copy(pivot).add(new THREE.Vector3(...viewOffset(view, distance)));
    camera.lookAt(pivot);
  };
  applyCamera();
  const mouseLook = canvas ? bindMouseLook(canvas, document, window, () => active,
    (dx, dy) => { view = turnView(view, dx, dy); applyCamera(); },
    input.reset, onLookStatus) : null;

  const plants = createPlants(scene, groundY);

  function update(dt) {
    if (!isStageReady() || document.hidden) return;
    if (!active) {
      input.reset();
      active = true;
      ball.visible = true;
    }
    // Heading comes directly from mouse yaw, unaffected by chase-camera lag.
    const wish = movementDirection(keys, [Math.sin(view.yaw), -Math.cos(view.yaw)]);
    const next = advanceMotion([pos.x, pos.z], [vel.x, vel.z], wish, dt);
    pos.x = next.position[0]; pos.z = next.position[1];
    vel.set(next.velocity[0], 0, next.velocity[1]);
    pos.y = groundY + BALL_R;
    ball.position.copy(pos);

    // rolling: spin around the axis perpendicular to velocity
    const speed = vel.length();
    if (speed > 0.01) {
      const axis = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), vel).normalize();
      ball.rotateOnWorldAxis(axis, (speed * dt) / BALL_R);
    }

    pivot.lerp(pos, followWeight(6, dt));
    applyCamera();

    plants.update(dt, pos, speed > 0.01);
  }

  return {
    ball, update,
    setOnsetSize(value) { return plants.setOnsetSize(value); },
    updateParams(params) { plants.updateParams(params); },
    get plantAudioScale() { return plants.audioScale; },
    get view() { return { ...view }; },
    get position() { return pos; },
    get seedsReady() { return true; }, // legacy diagnostic name; no seed file required
    get grown() { return plants.count; },
    get coverage() { return plants.count / plants.capacity; }, // pool utilization, not scene coverage
    dispose() {
      mouseLook?.dispose(); input.dispose(); plants.dispose();
      scene.remove(ball, light, ambient);
      ball.geometry.dispose(); ball.material.dispose();
    },
  };
}
