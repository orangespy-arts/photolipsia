import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { plantSites, plantGrowth } from '../src/mapping/plants.js';
import { createPlants, leafGeometry } from '../src/render/plants.js';
import { createExplorer } from '../src/render/explorer.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('plant sites are repeatable, unique and confined to the traversed area', () => {
  const a = plantSites(-1.3, 2.7);
  assert.ok(a.length > 0);
  assert.deepEqual(a, plantSites(-1.3, 2.7));
  assert.equal(new Set(a.map((s) => s.key)).size, a.length);
  for (const s of a) assert.ok(Math.hypot(s.x + 1.3, s.z - 2.7) <= 0.65);
});

test('stems emerge before leaves unfold, with bounded persistent maturity', () => {
  assert.deepEqual(plantGrowth(-1), { stem: 0, leaf: 0, mature: false });
  assert.ok(plantGrowth(0.15).stem > 0);
  assert.equal(plantGrowth(0.15).leaf, 0);
  assert.ok(plantGrowth(0.7).leaf > 0);
  assert.deepEqual(plantGrowth(100), { stem: 1, leaf: 1, mature: true });
  for (let i = 1; i <= 20; i++) {
    assert.ok(plantGrowth(i / 10).stem >= plantGrowth((i - 1) / 10).stem);
    assert.ok(plantGrowth(i / 10).leaf >= plantGrowth((i - 1) / 10).leaf);
  }
});

test('leaf has pointed ends and a non-flat folded surface', () => {
  const geometry = leafGeometry();
  const p = geometry.attributes.position;
  near(p.getX(0), 0); near(p.getY(0), 0);
  near(p.getX(p.count - 1), 0); near(p.getY(p.count - 1), 1);
  assert.ok(p.getZ(p.count - 1) < 0);
  assert.ok([...geometry.attributes.normal.array].every(Number.isFinite));
  assert.ok(geometry.index.count > 0);
  geometry.dispose();
});

test('plants root at ground, unfold after leaving, deduplicate and obey capacity', () => {
  const scene = new THREE.Scene();
  const plants = createPlants(scene, -0.23, 40);
  const origin = { x: 0, z: 0 };
  plants.update(0.1, origin, false);
  assert.equal(plants.count, 0);
  plants.update(0.1, origin, true);
  const count = plants.count;
  assert.ok(count > 0);
  plants.update(0.5, origin, true);
  assert.equal(plants.count, count);
  const matrix = new THREE.Matrix4();
  plants.stems.getMatrixAt(0, matrix);
  near(matrix.elements[13] - matrix.elements[5] / 2, -0.23);
  assert.ok(matrix.elements[5] > 0);
  plants.update(2, { x: 50, z: 50 }, false);
  assert.equal(plants.count, count);
  plants.leaves.getMatrixAt(0, matrix);
  assert.ok(matrix.elements.some((v) => v !== 0));
  const version = plants.leaves.instanceMatrix.version;
  plants.update(1, origin, false);
  assert.equal(plants.leaves.instanceMatrix.version, version);
  for (let i = 0; i < 10; i++) plants.update(0.1, { x: i * 2, z: 0 }, true);
  assert.equal(plants.count, 40);
  assert.equal(plants.stems.count, 40);
  assert.equal(plants.leaves.count, 160);
  plants.dispose(); assert.equal(scene.children.length, 0);
});

test('invisible explorer waits for scene, touches ground and grows leaves on movement', (t) => {
  const priorWindow = globalThis.window, priorDocument = globalThis.document;
  globalThis.window = new EventTarget();
  globalThis.document = new EventTarget();
  t.after(() => { globalThis.window = priorWindow; globalThis.document = priorDocument; });
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  let ready = false;
  const explorer = createExplorer({ scene, camera, isStageReady: () => ready,
    config: { groundY: 2, spawn: [3, 2, 4], cameraOffset: [0, 1.6, 3.2] } });
  t.after(() => explorer.dispose());
  near(explorer.position.y - explorer.ball.geometry.parameters.radius, 2);
  assert.equal(explorer.ball.material.opacity, 0);
  assert.equal(explorer.ball.material.depthWrite, false);
  explorer.update(0.1); assert.equal(explorer.grown, 0);
  ready = true; explorer.update(0.1);
  assert.equal(explorer.ball.visible, false);
  assert.equal(explorer.grown, 0);
  const press = new Event('keydown'); press.code = 'KeyD'; window.dispatchEvent(press);
  for (let i = 0; i < 10; i++) explorer.update(1 / 60);
  assert.ok(explorer.position.x > 3);
  assert.ok(explorer.grown > 0);
  near(explorer.position.y - explorer.ball.geometry.parameters.radius, 2);
  assert.equal(explorer.ball.visible, false);
  window.dispatchEvent(new Event('blur'));
  const last = explorer.position.clone(); explorer.update(0.1);
  assert.deepEqual(explorer.position.toArray(), last.toArray());
});
