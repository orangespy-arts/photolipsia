import { test } from 'node:test';
import assert from 'node:assert/strict';
import { movementDirection, advanceMotion, followWeight } from '../src/render/explorerMotion.js';
import { bindExplorerInput } from '../src/render/explorerInput.js';
import { sceneConfig } from '../src/render/sceneConfig.js';

const keys = (name) => ({ up: false, down: false, left: false, right: false, [name]: true });
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('movement follows screen directions for forward and rotated cameras', () => {
  for (const [key, expected] of [['up', [0, -1]], ['down', [0, 1]], ['left', [-1, 0]], ['right', [1, 0]]]) {
    movementDirection(keys(key), [0, -1]).forEach((v, i) => near(v, expected[i]));
  }
  assert.deepEqual(movementDirection(keys('right'), [1, 0]), [0, 1]);
  const diagonal = movementDirection({ ...keys('up'), right: true }, [0, -1]);
  near(Math.hypot(...diagonal), 1);
});

test('30/60/144Hz travel, stopping distance and camera settling remain consistent', () => {
  const runs = [30, 60, 144].map((hz) => {
    let state = { position: [0, 0], velocity: [0, 0] };
    let camera = 0;
    let movingCamera;
    for (let frame = 0; frame < hz * 5; frame++) {
      state = advanceMotion(state.position, state.velocity, frame < hz * 3 ? [1, 0] : [0, 0], 1 / hz);
      camera += (state.position[0] - camera) * followWeight(4, 1 / hz);
      if (frame === hz * 3 - 1) movingCamera = camera;
    }
    return { ...state, camera, movingCamera };
  });
  for (const run of runs) {
    near(run.position[0], runs[0].position[0]);
    near(run.velocity[0], runs[0].velocity[0]);
    near(run.camera, runs[0].camera, 0.001);
    near(run.movingCamera, runs[0].movingCamera, 0.03);
  }
});

test('loading blocks input; aliases, blur, visibility and disposal clear it correctly', () => {
  const target = new EventTarget();
  const doc = new EventTarget();
  let enabled = false, resets = 0;
  const input = bindExplorerInput(target, doc, () => enabled, () => resets++);
  const send = (type, code) => {
    const event = new Event(type, { cancelable: true });
    event.code = code; target.dispatchEvent(event);
  };
  send('keydown', 'KeyW'); assert.equal(input.keys.up, false);
  enabled = true;
  send('keydown', 'KeyW'); send('keydown', 'ArrowUp'); send('keyup', 'KeyW');
  assert.equal(input.keys.up, true);
  target.dispatchEvent(new Event('blur'));
  assert.equal(input.keys.up, false); assert.equal(resets, 1);
  send('keydown', 'KeyD'); doc.hidden = true;
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(input.keys.right, false); assert.equal(resets, 2);
  input.dispose(); send('keydown', 'KeyW');
  assert.equal(input.keys.up, false);
});

test('scene config keeps viewing default and supplies matching exploration assets', () => {
  assert.equal(sceneConfig(new URLSearchParams()).splatUrl, '/splats/test.ply');
  const config = sceneConfig(new URLSearchParams('play=1&spawn=2,3,4&ground=5&follow=1,2,3&tf=1,0,0&seeds=/custom.ply'));
  assert.equal(config.splatUrl, '/splats/ruin1.ply');
  assert.equal(config.tf, '1,0,0');
  assert.deepEqual(config.explorer, {
    groundY: 5, spawn: [2, 5, 4], cameraOffset: [1, 2, 3], seedsUrl: '/custom.ply',
  });
  const invalid = sceneConfig(new URLSearchParams('ground=Infinity&spawn=bad&follow=0,0,0'));
  assert.equal(invalid.explorer.groundY, -0.23);
  assert.equal(invalid.explorer.cameraOffset[2], 3.2);
});
