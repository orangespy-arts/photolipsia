import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNavigation, isSafe, constrainMotion, safeCamera } from '../src/render/navigation.js';
import { advanceMotion } from '../src/render/explorerMotion.js';
import { viewOffset, turnView } from '../src/render/mouseLook.js';
import { sceneConfig } from '../src/render/sceneConfig.js';

const room = { bounds: { min: [-5, 0, -5], max: [5, 4, 5] }, obstacles: [] };
const wall = { ...room, obstacles: [{ min: [1, 0, -2], max: [1.01, 4, 2] }] };
const start = [0, 0.22, 0];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);

test('navigation rejects absent/malformed boxes; URL carries explicit world-space calibration', () => {
  for (const input of [null, '', '{}', '{', JSON.stringify({ ...room, obstacles: [{}] }),
    JSON.stringify({ ...room, bounds: { min: [0, 0, 0], max: [0, 2, 2] } })]) {
    assert.equal(parseNavigation(input), null);
  }
  const params = new URLSearchParams({ play: '1', nav: JSON.stringify(wall) });
  assert.deepEqual(sceneConfig(params).explorer.navigation, wall);
  assert.equal(sceneConfig(new URLSearchParams('play=1')).explorer.navigation, null);
});

test('invalid spawn or absent calibration fails closed without moving or accumulating velocity', () => {
  for (const [p, nav] of [[start, null], [[7, 0.22, 0], room], [[1, 0.22, 0], wall]]) {
    const result = constrainMotion(p, [100, 0.22, 0], [20, 0, 0], 0.22, nav);
    assert.deepEqual(result.position, p);
    assert.deepEqual(result.velocity, [0, 0, 0]);
    assert.equal(result.blocked, true);
  }
});

test('whole-segment collision stops at thin walls even with a huge movement step', () => {
  const before = JSON.stringify(wall);
  const result = constrainMotion(start, [100, 0.22, 0], [100, 0, 0], 0.22, wall);
  near(result.position[0], 0.78);
  assert.deepEqual(result.velocity, [0, 0, 0]);
  assert.ok(isSafe(result.position, 0.22, wall));
  assert.equal(JSON.stringify(wall), before);
});

test('diagonal contact slides; simultaneous corners remove both outward velocity components', () => {
  const slide = constrainMotion(start, [2, 0.22, 1], [2, 0, 1], 0.22, wall);
  near(slide.position[0], 0.78); near(slide.position[2], 1);
  assert.deepEqual(slide.velocity, [0, 0, 1]);
  const corner = constrainMotion(start, [20, 0.22, 20], [2, 0, 2], 0.22, room);
  near(corner.position[0], 4.78); near(corner.position[2], 4.78);
  assert.deepEqual(corner.velocity, [0, 0, 0]);
});

test('resting contact allows retreat and tangential movement without sticking', () => {
  const p = [0.78, 0.22, 0];
  const retreat = constrainMotion(p, [-1, 0.22, 0], [-1, 0, 0], 0.22, wall);
  near(retreat.position[0], -1);
  const tangent = constrainMotion(p, [0.78, 0.22, 1], [0, 0, 1], 0.22, wall);
  near(tangent.position[2], 1);
});

test('camera boom and lagging pivot stop before walls, ceiling and outer bounds for every yaw', () => {
  let view = { yaw: 0, pitch: 0.4 };
  const pivot = safeCamera(start, [3, 0.22, 0], 0.12, wall);
  assert.ok(pivot[0] < 0.88);
  for (let i = 0; i < 360; i++) {
    view = turnView(view, Math.PI / 180 / 0.0025, 0);
    const desired = viewOffset(view, 15).map((v, j) => v + pivot[j]);
    const camera = safeCamera(pivot, desired, 0.12, wall);
    assert.ok(isSafe(camera, 0.12, wall));
    // The whole viewing segment, not just its endpoint, remains on this side.
    assert.ok(camera[0] < 0.88 || Math.abs(camera[2]) > 2.12);
  }
  near(safeCamera(start, [0, 20, 0], 0.12, room)[1], 3.88);
});

test('held input remains inside bounds at 30/60/144 Hz and after a long frame', () => {
  for (const hz of [30, 60, 144, 0.1]) {
    let p = [...start], v = [0, 0, 0];
    for (let i = 0; i < Math.max(1, hz * 5); i++) {
      const next = advanceMotion([p[0], p[2]], [v[0], v[2]], [1, 0], 1 / hz);
      const result = constrainMotion(p, [next.position[0], p[1], next.position[1]],
        [next.velocity[0], 0, next.velocity[1]], 0.22, wall);
      p = result.position; v = result.velocity;
      assert.ok(isSafe(p, 0.22, wall));
    }
    near(p[0], 0.78);
  }
});
