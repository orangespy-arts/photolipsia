import * as THREE from 'three';
import { createPlants } from './plants.js';
import { movementDirection, advanceMotion, followWeight } from './explorerMotion.js';
import { bindExplorerInput } from './explorerInput.js';

/**
 * Explorer — third-person ball that rolls through the splat scene and
 * grows mesh plants along its path. Arrow keys move relative to the camera;
 * a damped chase camera follows; leaves unfold where the invisible anchor passes.
 *
 * Pure plant math lives in mapping/plants.js; this file is the
 * render/input shell that feeds it.
 */
export function createExplorer({ scene, camera, config, isStageReady }) {
  // Fully transparent movement anchor: no glow, outline or depth occlusion.
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  ball.visible = false;
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

  // ── chase camera: damped follow behind/above the ball ──
  const camOffset = new THREE.Vector3(...cameraOffset); // behind = +z of ball frame
  const camLook = pos.clone();
  camera.position.copy(pos).add(camOffset);
  camera.lookAt(camLook);
  const camTarget = new THREE.Vector3();

  const plants = createPlants(scene, groundY);

  function update(dt) {
    if (!isStageReady() || document.hidden) return;
    if (!active) {
      input.reset();
      active = true;
    }
    // direction in camera-yaw frame
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    const wish = movementDirection(keys, [fwd.x, fwd.z]);
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

    // chase camera with damping
    camTarget.copy(pos).add(camOffset);
    camera.position.lerp(camTarget, followWeight(4, dt));
    camLook.lerp(pos, followWeight(6, dt));
    camera.lookAt(camLook);

    plants.update(dt, pos, speed > 0.01);
  }

  return {
    ball, update,
    get position() { return pos; },
    get seedsReady() { return true; }, // legacy diagnostic name; no seed file required
    get grown() { return plants.count; },
    get coverage() { return plants.count / plants.capacity; }, // pool utilization, not scene coverage
    dispose() {
      input.dispose(); plants.dispose();
      scene.remove(ball, light, ambient);
      ball.geometry.dispose(); ball.material.dispose();
    },
  };
}
