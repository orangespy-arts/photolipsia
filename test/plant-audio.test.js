import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { plantAudioTarget, followPlantAudio, plantMotion } from '../src/mapping/plantAudio.js';
import { plantTraits } from '../src/mapping/plants.js';
import { createPlants } from '../src/render/plants.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const neutral = { stretch: 1, x: 0, z: 0 };

test('traits repeat for a site but vary shape, band, leaf count and timing between sites', () => {
  assert.deepEqual(plantTraits('2,5'), plantTraits('2,5'));
  const traits = Array.from({ length: 80 }, (_, i) => plantTraits(`${i},3`));
  for (const field of ['kind', 'band', 'leafCount']) assert.equal(new Set(traits.map((p) => p[field])).size, 3);
  for (const field of ['height', 'width', 'phase', 'rate', 'gain']) assert.ok(new Set(traits.map((p) => p[field])).size > 50);
});

test('each band activates its own plants; silence and invalid input produce no motion', () => {
  const zero = plantAudioTarget();
  assert.deepEqual(plantAudioTarget({ bands: { low: NaN, mid: -1, high: Infinity }, onset: -1 }), zero);
  for (let band = 0; band < 3; band++) {
    const traits = { band, gain: 1, phase: 0.7, rate: 1 };
    for (const time of [0, 0.1, 2, 50]) {
      const silent = plantMotion(traits, zero, time);
      near(silent.stretch, 1); near(silent.x, 0); near(silent.z, 0);
    }
    for (let input = 0; input < 3; input++) {
      const audio = plantAudioTarget({ bands: { [['low','mid','high'][input]]: 1 }, onset: 1 });
      const motion = plantMotion(traits, audio, 0.1);
      if (input === band) assert.ok(motion.stretch > 1);
      else { near(motion.stretch, 1); near(motion.x, 0); near(motion.z, 0); }
    }
  }
});

test('different phases and frequencies produce distinct bounded motion anchored at roots', () => {
  const audio = plantAudioTarget({ bands: { low: 1, mid: 1, high: 1 }, onset: 1 });
  const movements = new Set();
  for (let i = 0; i < 60; i++) {
    const traits = plantTraits(`${i},3`);
    const motion = plantMotion(traits, audio, 1.5);
    movements.add(JSON.stringify(motion));
    assert.ok(motion.stretch >= 1 && motion.stretch <= 1.85);
    assert.ok(Math.hypot(motion.x, motion.z) <= 0.36);
    const ground = -0.23, height = 0;
    near(ground + height * motion.stretch, ground);
    near(height * motion.x, 0); near(height * motion.z, 0);
  }
  assert.equal(movements.size, 60);
});

test('audio attack and release settle consistently at 30/60/144Hz', () => {
  for (const hz of [30, 60, 144]) {
    let value = 0;
    for (let i = 0; i < hz; i++) value = followPlantAudio(value, 1, 1 / hz);
    assert.equal(value, 1);
    for (let i = 0; i < hz * 2; i++) value = followPlantAudio(value, 0, 1 / hz);
    assert.equal(value, 0);
  }
});

test('mature instances keep static buffers; stems and leaves share per-plant GPU traits', () => {
  const scene = new THREE.Scene();
  const plants = createPlants(scene, -0.23, 40);
  const position = { x: 0, z: 0 };
  plants.update(0.01, position, true); plants.update(2, position, false);
  const count = plants.count;
  const version = plants.stems.instanceMatrix.version;
  const leavesVersion = plants.leaves.instanceMatrix.version;
  const a = plants.stems.geometry.getAttribute('aPlantMotion');
  const b = plants.leaves.geometry.getAttribute('aPlantMotion');
  for (let i = 0; i < count; i++) {
    for (let j = 0; j < 6; j++) {
      near(a.getX(i), b.getX(i * 6 + j)); near(a.getZ(i), b.getZ(i * 6 + j));
    }
  }
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader };
  plants.stems.material.onBeforeCompile(shader);
  assert.match(shader.vertexShader, /float height = mvPosition.y - uPlantGround/);
  assert.match(shader.vertexShader, /transformedNormal.y =/);
  plants.updateParams({ bands: { mid: 1 } }); plants.update(0.2, position, false);
  assert.ok(shader.uniforms.uPlantBands.value.y > 0.9);
  assert.equal(shader.uniforms.uPlantBands.value.x, 0);
  assert.equal(plants.count, count);
  assert.equal(plants.stems.instanceMatrix.version, version);
  assert.equal(plants.leaves.instanceMatrix.version, leavesVersion);
  plants.updateParams({}); plants.update(2, position, false);
  assert.deepEqual(plants.audioBands, plantAudioTarget());
  plants.dispose(); assert.equal(scene.children.length, 0);
});


test('onset size scales only the transient height boost, preserving band motion and silence', () => {
  const traits = { band: 0, gain: 1, phase: 0.7, rate: 1 };
  const audio = plantAudioTarget({ bands: { low: 1 }, onset: 1 });
  const off = plantMotion(traits, audio, 1, 0);
  const normal = plantMotion(traits, audio, 1, 1);
  const large = plantMotion(traits, audio, 1, 10);
  near(large.stretch - off.stretch, 10 * (normal.stretch - off.stretch));
  near(large.x, off.x); near(large.z, off.z);
  assert.deepEqual(plantMotion(traits, audio, 1, 100), large);
  assert.deepEqual(plantMotion(traits, audio, 1, -1), off);
  assert.deepEqual(plantMotion(traits, audio, 1, NaN), normal);
  near(plantMotion(traits, plantAudioTarget(), 1, 10).stretch, 1);
});

test('onset control reaches both GPU materials without rebuilding plant geometry', () => {
  const plants = createPlants(new THREE.Scene(), 0, 10);
  const stemShader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader };
  const leafShader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader };
  plants.stems.material.onBeforeCompile(stemShader);
  plants.leaves.material.onBeforeCompile(leafShader);
  assert.equal(plants.setOnsetSize(99), 10);
  plants.update(1, { x: 0, z: 0 }, false);
  near(stemShader.uniforms.uPlantOnsetSize.value, 10);
  assert.equal(stemShader.uniforms.uPlantOnsetSize, leafShader.uniforms.uPlantOnsetSize);
  assert.equal(plants.setOnsetSize(-1), 0);
  plants.update(2, { x: 0, z: 0 }, false);
  near(stemShader.uniforms.uPlantOnsetSize.value, 0);
  assert.equal(plants.count, 0);
  plants.dispose();
});
