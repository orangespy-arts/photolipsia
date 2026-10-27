import * as THREE from 'three';
import { plantSites, plantGrowth } from '../mapping/plants.js';

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
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.009, 0.013, 1, 5),
    new THREE.MeshStandardMaterial({ color: 0x467331, roughness: 0.9 }), capacity);
  const leaves = new THREE.InstancedMesh(leafGeometry(),
    new THREE.MeshStandardMaterial({ color: 0x6aab40, roughness: 0.8, side: THREE.DoubleSide }), capacity * 4);
  for (const mesh of [stems, leaves]) {
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // The pool expands as the player walks; an initial bounding sphere would be stale.
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
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
    for (let j = 0; j < 4; j++) {
      transform.position.set(plant.x, groundY + height * (0.35 + j * 0.15), plant.z);
      // Leaves start upright, then unfold away from the stem in alternating directions.
      transform.rotation.set(0, plant.yaw + j * 2.4, -growth.leaf * 1.05);
      const length = plant.height * (0.8 - j * 0.09) * growth.leaf;
      transform.scale.set(length, length, length);
      transform.updateMatrix();
      leaves.setMatrixAt(plant.index * 4 + j, transform.matrix);
    }
  }

  return {
    stems, leaves,
    get count() { return planted.size; },
    get capacity() { return capacity; },
    update(dt, position, moving) {
      time += Math.max(0, dt);
      if (moving && planted.size < capacity) {
        for (const site of plantSites(position.x, position.z)) {
          if (planted.has(site.key)) continue;
          if (planted.size >= capacity) break;
          const plant = { ...site, index: planted.size, born: time };
          planted.set(site.key, plant); growing.add(plant);
          color.setHSL(0.25 + (plant.index % 7) * 0.005, 0.42, 0.35 + (plant.index % 5) * 0.015);
          for (let j = 0; j < 4; j++) leaves.setColorAt(plant.index * 4 + j, color);
        }
      }
      let changed = false;
      for (const plant of growing) {
        const growth = plantGrowth(time - plant.born);
        paint(plant, growth); changed = true;
        if (growth.mature) growing.delete(plant);
      }
      stems.count = planted.size; leaves.count = planted.size * 4;
      if (changed) {
        stems.instanceMatrix.needsUpdate = true;
        leaves.instanceMatrix.needsUpdate = true;
        if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
      }
    },
    dispose() {
      for (const mesh of [stems, leaves]) {
        scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose();
      }
      planted.clear(); growing.clear();
    },
  };
}
