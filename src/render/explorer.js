import * as THREE from 'three';
import { createPlants } from './plants.js';
import { createGlassBall } from './glassBall.js';
import { movementDirection, advanceMotion, followWeight } from './explorerMotion.js';
import { bindExplorerInput } from './explorerInput.js';
import { bindMouseLook, turnView, viewOffset } from './mouseLook.js';
import { constrainMotion, isSafe, safeCamera } from './navigation.js';

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
  const navigation = config.navigation;
  const navigationReady = isSafe([spawn[0], groundY + BALL_R, spawn[2]], BALL_R, navigation);
  const navigationStatus = navigationReady ? null : 'Movement paused: scene safety bounds and spawn need calibration.';

  // ── movement state: direction keys held, velocity with damping ──
  const vel = new THREE.Vector3();
  const pos = new THREE.Vector3(spawn[0], groundY + BALL_R, spawn[2]);
  ball.position.copy(pos);
  ball.visible = false;
  let active = false;
  let enabled = true;
  const input = bindExplorerInput(window, document, () => enabled && active && navigationReady,
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
    if (navigationReady) {
      // Revalidate the lagging pivot from the ball: follow lag cannot cut corners.
      pivot.fromArray(safeCamera(pos.toArray(), pivot.toArray(), 0.12, navigation));
      const desired = pivot.clone().add(new THREE.Vector3(...viewOffset(view, distance)));
      camera.position.fromArray(safeCamera(pivot.toArray(), desired.toArray(), 0.12, navigation));
    } else {
      camera.position.copy(pivot).add(new THREE.Vector3(...viewOffset(view, distance)));
    }
    camera.lookAt(pivot);
  };
  applyCamera();
  const mouseLook = canvas ? bindMouseLook(canvas, document, window, () => enabled && active && navigationReady,
    (dx, dy) => { view = turnView(view, dx, dy); applyCamera(); },
    input.reset, (message) => onLookStatus?.(navigationStatus ?? message)) : null;

  const plants = createPlants(scene, groundY);

  function update(dt) {
    if (!enabled || !isStageReady() || document.hidden) return;
    if (!active) {
      input.reset();
      active = true;
      ball.visible = true;
    }
    if (!navigationReady) return;
    // Heading comes directly from mouse yaw, unaffected by chase-camera lag.
    const wish = movementDirection(keys, [Math.sin(view.yaw), -Math.cos(view.yaw)]);
    const next = advanceMotion([pos.x, pos.z], [vel.x, vel.z], wish, dt);
    const safe = constrainMotion(pos.toArray(), [next.position[0], pos.y, next.position[1]],
      [next.velocity[0], 0, next.velocity[1]], BALL_R, navigation);
    pos.fromArray(safe.position);
    vel.fromArray(safe.velocity);
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
    navigationStatus,
    setEnabled(value) {
      if (enabled === Boolean(value)) return;
      enabled = Boolean(value); input.reset(); vel.set(0, 0, 0);
    },
    reset() {
      input.reset(); vel.set(0, 0, 0);
      pos.set(spawn[0], groundY + BALL_R, spawn[2]);
      ball.position.copy(pos); pivot.copy(pos);
      view = { yaw: Math.atan2(-cameraOffset[0], cameraOffset[2]),
        pitch: Math.atan2(cameraOffset[1], Math.hypot(cameraOffset[0], cameraOffset[2])) };
      applyCamera();
    },
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
