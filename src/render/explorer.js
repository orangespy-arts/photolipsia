import * as THREE from 'three';
import { SplatMesh } from '@sparkjsdev/spark';
import { createSeeds, growSeeds } from '../mapping/greening.js';
import { movementDirection, advanceMotion, followWeight } from './explorerMotion.js';
import { bindExplorerInput } from './explorerInput.js';

/**
 * Explorer — third-person ball that rolls through the splat scene and
 * greens the ground behind it. Arrow keys move relative to the camera;
 * a damped chase camera follows; seed splats bloom where the ball passes.
 *
 * Pure decision math lives in mapping/greening.js; this file is the
 * render/input shell that feeds it.
 */
export function createExplorer({ scene, camera, config, isStageReady }) {
  // ── the ball: a plain mesh — the actor, not the scene ──
  // Always visible: depthTest off + drawn last, so splats in front (even
  // spawning inside a big splat) can never hide the actor.
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 24, 16),
    new THREE.MeshStandardMaterial({
      color: 0xf5f2ea,
      emissive: 0x3355ff,
      emissiveIntensity: 0.4,
      roughness: 0.4,
      depthTest: false,
      transparent: true,
    }),
  );
  ball.renderOrder = 999;
  scene.add(ball);

  // a light for the ball's shading (splats ignore lights; the mesh needs one)
  const light = new THREE.DirectionalLight(0xffffff, 1.2);
  light.position.set(1, 3, 2);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  // ── ground height: flat plane per scene (no physics); ruin1 floor ≈ -0.23 ──
  const { groundY, spawn, cameraOffset, seedsUrl } = config;
  // ball sits ON the floor, not in it: center = floor + radius (small margin
  // so splat fuzz doesn't clip the bottom)
  const BALL_R = ball.geometry.parameters.radius;

  // ── movement state: direction keys held, velocity with damping ──
  const vel = new THREE.Vector3();
  const pos = new THREE.Vector3(spawn[0], groundY + BALL_R * 1.02, spawn[2]);
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

  // ── seeds: load the green splats, keep a JS-side position table ──
  const seedMesh = new SplatMesh({ url: seedsUrl });
  scene.add(seedMesh);
  const seedState = { seeds: null, ready: false, error: null };
  seedMesh.initialized.then(() => {
    const packed = seedMesh.packedSplats;
    const positions = [];
    for (let i = 0; i < packed.numSplats; i++) {
      positions.push([packed.getSplat(i).center.x, packed.getSplat(i).center.y, packed.getSplat(i).center.z]);
    }
    seedState.seeds = createSeeds(positions, 0);
    seedState.ready = true;
  }).catch((err) => { seedState.error = err?.message ?? String(err); });

  // audio gains arrive from main.js updateParams
  const av = { onset: 0, bandLow: 0 };

  function updateParams(params, dt) {
    av.onset += (params.onset - av.onset) * Math.min(1, dt * 20);
    av.bandLow += (params.bands.low - av.bandLow) * Math.min(1, dt * 10);
    // ball glow pulse follows the onset envelope
    ball.material.emissiveIntensity = 0.4 + av.onset * 2.5;
  }

  function update(dt) {
    if (!isStageReady() || !seedState.ready || document.hidden) return;
    if (!active) {
      input.reset();
      active = true;
      ball.visible = true;
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
    pos.y = groundY + BALL_R * 1.02;
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

    // greening: raise seed blooms near the ball, write changed opacities
    if (seedState.ready) {
      growSeeds(seedState.seeds, [pos.x, pos.y, pos.z], dt, {
        bandLow: av.bandLow, onset: av.onset,
      });
      const packed = seedMesh.packedSplats;
      let dirty = false;
      const seeds = seedState.seeds;
      for (let i = 0; i < seeds.length; i++) {
        const b = seeds[i].bloom;
        if (b <= 0) continue;
        // bloom→opacity: ease so freshly touched seeds fade in softly
        const opa = b * b * 0.95;
        const cur = packed.getSplat(i);
        if (Math.abs(cur.opacity - opa) > 0.01) {
          packed.setSplat(i, cur.center, cur.scales, cur.quaternion, opa, cur.color);
          dirty = true;
        }
      }
      if (dirty) packed.needsUpdate = true;
    }
  }

  return {
    ball, update, updateParams,
    get position() { return pos; },
    get loadError() { return seedState.error; },
    get seedsReady() { return seedState.ready; },
    get coverage() { return seedState.ready ? coverageOf(seedState.seeds) : 0; },
    // probe/diag hook: how many seeds have any bloom
    get grown() {
      if (!seedState.ready) return 0;
      let n = 0;
      for (const s of seedState.seeds) if (s.bloom > 0.01) n++;
      return n;
    },
    dispose() {
      input.dispose();
    },
  };
}

function coverageOf(seeds) {
  let sum = 0;
  for (const s of seeds) sum += s.bloom;
  return seeds.length ? sum / seeds.length : 0;
}
