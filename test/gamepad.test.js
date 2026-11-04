import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStick, readGamepad, selectGamepad } from '../src/input/gamepad.js';

test('stick dead zone suppresses drift, rescales smoothly and preserves direction', () => {
  assert.deepEqual(normalizeStick(0.05, -0.08), { x: 0, y: 0 });
  assert.deepEqual(normalizeStick(0.15, 0), { x: 0, y: 0 });
  assert.ok(Math.abs(normalizeStick(0.575, 0).x - 0.5) < 1e-12);
  const diagonal = normalizeStick(-1, 1);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-12);
  assert.equal(diagonal.x, -diagonal.y);
  assert.deepEqual(normalizeStick(NaN, Infinity), { x: 0, y: 0 });
  assert.deepEqual(normalizeStick(0, 0, 0), { x: 0, y: 0 });
});

test('selection handles sparse slots, disconnect, reconnect and preferred device', () => {
  const first = { connected: true, index: 1 };
  const second = { connected: true, index: 3 };
  assert.equal(selectGamepad([null, first, null, second], 3), second);
  assert.equal(selectGamepad([null, first, null, { ...second, connected: false }], 3), first);
  assert.equal(selectGamepad([null, null]), null);
  assert.equal(selectGamepad([null, second], 3), second);
});

test('standard mapping keeps two triggers independent and clamps malformed readings', () => {
  const buttons = Array.from({ length: 17 }, () => ({ value: 0, pressed: false }));
  buttons[6] = { value: 0.3, pressed: false };
  buttons[7] = { value: 0.8, pressed: true };
  const pad = { connected: true, mapping: 'standard', axes: [-1, 0, 0, 1], buttons };
  const state = readGamepad(pad);
  assert.deepEqual(state.triggers, [0.3, 0.8]);
  assert.deepEqual(state.left, { x: -1, y: 0 });
  assert.deepEqual(state.right, { x: 0, y: 1 });
  assert.equal(state.buttons[7].pressed, true);
  assert.equal(buttons[6].value, 0.3);
  assert.deepEqual(readGamepad({ ...pad, axes: [9, NaN], buttons: [{ value: -1 }] }).axes, [1, 0]);
  assert.equal(readGamepad({ ...pad, connected: false }), null);
  assert.equal(readGamepad(null), null);
});

test('unknown mapping preserves raw input without guessing stick or trigger positions', () => {
  const state = readGamepad({ connected: true, mapping: '', axes: [0.7], buttons: [{ value: 1, pressed: true }] });
  assert.equal(state.standard, false);
  assert.equal(state.left, null);
  assert.equal(state.right, null);
  assert.equal(state.triggers, null);
  assert.deepEqual(state.axes, [0.7]);
  assert.equal(state.buttons[0].value, 1);
});
