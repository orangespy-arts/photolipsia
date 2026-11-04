import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { advanceFlight, PITCH_LIMIT } from '../src/render/flightMotion.js';
import { createFlightController } from '../src/render/flightController.js';
import { sceneConfig } from '../src/render/sceneConfig.js';

const initial = () => ({ position: [0, 0, 0], velocity: [0, 0, 0], angular: [0, 0], yaw: 0, pitch: 0 });
const idle = { strafe: 0, forward: 0, rise: 0, yaw: 0, pitch: 0 };
const near = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

test('flight moves in camera directions, rises vertically and caps combined speed', () => {
  assert.ok(advanceFlight(initial(), { ...idle, forward: 1 }, 0.1).position[2] < 0);
  assert.ok(advanceFlight(initial(), { ...idle, strafe: 1 }, 0.1).position[0] > 0);
  assert.ok(advanceFlight({ ...initial(), yaw: -Math.PI / 2 }, { ...idle, forward: 1 }, 0.1).position[0] > 0);
  assert.ok(advanceFlight({ ...initial(), pitch: 0.5 }, { ...idle, forward: 1 }, 0.1).position[1] > 0);
  const rising = advanceFlight(initial(), { ...idle, rise: 1 }, 0.1);
  assert.ok(rising.position[1] > 0); near(rising.position[2], 0);
  const diagonal = advanceFlight(initial(), { ...idle, forward: 1, rise: 1, strafe: 1 }, 0.1);
  near(Math.hypot(...diagonal.velocity), Math.hypot(...rising.velocity));
});

test('flight acceleration and release are consistent at 30, 60 and 144 Hz', () => {
  const runs = [30, 60, 144].map(hz => {
    let state = initial();
    for (let i = 0; i < hz * 3; i++) state = advanceFlight(state, { ...idle, forward: i < hz * 2 ? 1 : 0 }, 1 / hz);
    return state;
  });
  for (const run of runs) { near(run.position[2], runs[0].position[2]); near(run.velocity[2], runs[0].velocity[2]); }
  let turn = initial();
  for (let i = 0; i < 300; i++) turn = advanceFlight(turn, { ...idle, pitch: 1 }, 1 / 60);
  near(turn.pitch, PITCH_LIMIT); near(turn.angular[1], 0);
  const stopped = advanceFlight(runs[0], idle, 5);
  assert.deepEqual(stopped.position, runs[0].position);
  assert.deepEqual(stopped.velocity, [0, 0, 0]);
});

test('controller gates loading and neutral input, stops on blur/disconnect, resets and disposes', () => {
  const target = new EventTarget(), doc = new EventTarget();
  let focus = true, ready = false;
  doc.hasFocus = () => focus;
  const camera = new THREE.PerspectiveCamera();
  const pad = { index: 0, id: 'test', connected: true, mapping: 'standard', axes: [0, -1, 0, 0], buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })) };
  let pads = [pad];
  let effectInput = null;
  const controller = createFlightController({ camera, target, doc, getPads: () => pads, isReady: () => ready,
    onInput: value => { effectInput = value; } });
  controller.update(0.1); near(camera.position.z, 0);
  ready = true; controller.update(0.1); near(camera.position.z, 0);
  pad.axes[1] = 0; controller.update(0.1);
  pad.axes[1] = -1; controller.update(0.1); assert.ok(camera.position.z < 0);
  assert.equal(effectInput.index, 0);
  assert.equal(effectInput.axes[1], -1);
  const before = camera.position.toArray();
  target.dispatchEvent(new Event('blur')); focus = false; controller.update(0.1);
  assert.equal(effectInput, null);
  focus = true; controller.update(0.1); assert.deepEqual(camera.position.toArray(), before);
  pad.axes[1] = 0; controller.update(0.1);
  pad.axes[1] = -1; controller.update(0.1); assert.ok(camera.position.z < before[2]);
  pads = []; const lost = camera.position.toArray(); controller.update(0.1);
  assert.equal(effectInput, null);
  pads = [pad]; controller.update(0.1); assert.deepEqual(camera.position.toArray(), lost);
  controller.reset(); assert.deepEqual(camera.position.toArray(), [0, 0, 0]);
  pad.axes[1] = 0; controller.update(0.1);
  pad.axes[2] = 1; controller.update(0.1); assert.ok(camera.rotation.y < 0);
  controller.dispose(); const rotation = camera.rotation.y; controller.update(0.1); near(camera.rotation.y, rotation);
});

test('VJ mode owns camera independently of explorer and uses scene entrance', () => {
  const config = sceneConfig(new URLSearchParams('vj=1&journey=1&play=1&scene=city'));
  assert.equal(config.vj, true); assert.equal(config.play, false); assert.equal(config.journey, false);
  assert.equal(config.staticEnvironment, true); near(config.view.camPos[0], 1.9);
  const custom = sceneConfig(new URLSearchParams('vj=1&splat=/custom.ply'));
  assert.equal(custom.view, undefined);
  const framed = sceneConfig(new URLSearchParams('vj=1&view=0,0,0@1,2,3'));
  assert.deepEqual(framed.view.camPos, [1, 2, 3]);
  assert.equal(sceneConfig(new URLSearchParams('play=1')).play, true);
});
