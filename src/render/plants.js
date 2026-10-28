import * as THREE from 'three';
import { plantSites, plantGrowth, plantTraits } from '../mapping/plants.js';
import { plantAudioTarget, followPlantAudio, clampOnsetSize } from '../mapping/plantAudio.js';
import { addPlantMotion } from './plantMotion.js';

// A pointed, folded leaf, attached at its base (origin), extending along +Y.
export function leafGeometry() {
  const vertices = [], indices = [];
  const segments = 8;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const width = Math.sin(Math.PI * t) * 0.25;
    const curve = -0.22 * t * t;
    vertices.push(-width, t, curve, 0, t, curve + width * 0.3, width, t, curve);
    if (i < segments) {
      const a = i * 3, b = a + 3;
      indices.push(a, b, a + 1, a + 1, b, b + 1,
        a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createPlants(scene, groundY, capacity = 2400) {
  // Each instance has stable traits; shared uniforms animate them on the GPU.
  const group = new THREE.Group();
  group.name = 'audio-plants';
  scene.add(group);
  let audioTarget = plantAudioTarget();
  const audio = plantAudioTarget();
  let onsetSizeTarget = 1;
  const uniforms = {
    uPlantBands: { value: new THREE.Vector3() }, uPlantOnset: { value: 0 },
    uPlantOnsetSize: { value: 1 },
    uPlantTime: { value: 0 }, uPlantGround: { value: groundY },
  };
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.009, 0.013, 1, 5),
    new THREE.MeshStandardMaterial({ color: 0x467331, roughness: 0.9 }), capacity);
  const leaves = new THREE.InstancedMesh(leafGeometry(),
    new THREE.MeshStandardMaterial({ color: 0x6aab40, roughness: 0.8, side: THREE.DoubleSide }), capacity * 6);
  for (const mesh of [stems, leaves]) {
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // The pool expands as the player walks; an initial bounding sphere would be stale.
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  const stemMotion = addPlantMotion(stems, capacity, uniforms);
  const leafMotion = addPlantMotion(leaves, capacity * 6, uniforms);
  const planted = new Map();
  const growing = new Set();
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  let time = 0;

  function paint(plant, growth) {
    const height = plant.height * growth.stem;
    transform.position.set(plant.x, groundY + height / 2, plant.z);
    transform.rotation.set(0, plant.yaw, 0);
    transform.scale.set(growth.stem, height, growth.stem);
    transform.updateMatrix();
    stems.setMatrixAt(plant.index, transform.matrix);
    for (let j = 0; j < 6; j++) {
      transform.position.set(plant.x, groundY + height * (0.2 + j * 0.65 / Math.max(1, plant.leafCount - 1)), plant.z);
      // Leaves start upright, then unfold away from the stem in alternating directions.
      transform.rotation.set(0, plant.yaw + j * plant.twist, -growth.leaf * plant.spread);
      const length = j < plant.leafCount ? plant.height * plant.length * (1 - j * 0.1) * growth.leaf : 0;
      transform.scale.set(length * plant.width, length, length);
      transform.updateMatrix();
      leaves.setMatrixAt(plant.index * 6 + j, transform.matrix);
    }
  }

  return {
    stems, leaves,
    setOnsetSize(value) { onsetSizeTarget = clampOnsetSize(value); return onsetSizeTarget; },
    updateParams(params) { audioTarget = plantAudioTarget(params); },
    get audioScale() { return 1 + audio.low * 0.48; },
    get audioBands() { return { ...audio }; },
    get count() { return planted.size; },
    get capacity() { return capacity; },
    update(dt, position, moving) {
      time += Math.max(0, dt);
      for (const field of Object.keys(audio)) audio[field] = followPlantAudio(audio[field], audioTarget[field], dt);
      uniforms.uPlantBands.value.set(audio.low, audio.mid, audio.high);
      uniforms.uPlantOnset.value = audio.onset;
      uniforms.uPlantOnsetSize.value = followPlantAudio(uniforms.uPlantOnsetSize.value, onsetSizeTarget, dt);
      uniforms.uPlantTime.value = time;
      if (moving && planted.size < capacity) {
        for (const site of plantSites(position.x, position.z)) {
          if (planted.has(site.key)) continue;
          if (planted.size >= capacity) break;
          const plant = { ...site, ...plantTraits(site.key), index: planted.size, born: time };
          planted.set(site.key, plant); growing.add(plant);
          color.setHSL(plant.hue, 0.42, 0.35 + (plant.index % 5) * 0.015);
          stemMotion.setXYZW(plant.index, plant.band, plant.gain, plant.phase, plant.rate);
          for (let j = 0; j < 6; j++) {
            leaves.setColorAt(plant.index * 6 + j, color);
            leafMotion.setXYZW(plant.index * 6 + j, plant.band, plant.gain, plant.phase, plant.rate);
          }
          stemMotion.needsUpdate = true; leafMotion.needsUpdate = true;
        }
      }
      let changed = false;
      for (const plant of growing) {
        const growth = plantGrowth(time - plant.born);
        paint(plant, growth); changed = true;
        if (growth.mature) growing.delete(plant);
      }
      stems.count = planted.size; leaves.count = planted.size * 6;
      if (changed) {
        stems.instanceMatrix.needsUpdate = true;
        leaves.instanceMatrix.needsUpdate = true;
        if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
      }
    },
    dispose() {
      for (const mesh of [stems, leaves]) {
        group.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose();
      }
      scene.remove(group);
      planted.clear(); growing.clear();
    },
  };
}
