import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceEffects, effectState, EFFECT_NAMES } from '../src/mapping/vjEffects.js';

const pad = (lt = 0, rt = 0, pressed = []) => ({ standard: true, triggers: [lt, rt],
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })) });
const armed = () => advanceEffects(effectState(), pad(), 1 / 60);

test('effects require neutral triggers on connection; both triggers remain independent', () => {
  assert.equal(advanceEffects(effectState(), pad(1, 1), 0.1).armed, false);
  const left = advanceEffects(armed(), pad(1, 0), 0.1);
  assert.ok(left.feedback > 0); assert.equal(left.distortion, 0);
  const right = advanceEffects(armed(), pad(0, 1), 0.1);
  assert.ok(right.distortion > 0); assert.equal(right.feedback, 0);
  const both = advanceEffects(armed(), pad(1, 1), 0.1);
  assert.equal(both.distortion, both.feedback);
});
test('shoulders switch on edges once, wrap around and cancel simultaneous presses', () => {
  let state = advanceEffects(armed(), pad(0, 0, [5]), 0.1);
  assert.equal(state.preset, 1); assert.equal(state.reset, true);
  state = advanceEffects(state, pad(0, 0, [5]), 0.1);
  assert.equal(state.preset, 1); assert.equal(state.reset, false);
  assert.equal(advanceEffects(armed(), pad(0, 0, [4]), 0.1).preset, EFFECT_NAMES.length - 1);
  assert.equal(advanceEffects(armed(), pad(0, 0, [4, 5]), 0.1).preset, 0);
});
test('B and lost input clear immediately and require release before rearming', () => {
  const active = advanceEffects(armed(), pad(1, 1), 0.1);
  for (const input of [null, { standard: false }, pad(1, 1, [1])]) {
    const clear = advanceEffects(active, input, 0.1);
    assert.equal(clear.feedback, 0); assert.equal(clear.distortion, 0); assert.equal(clear.reset, true);
    assert.equal(advanceEffects(clear, pad(1, 1), 0.1).armed, false);
  }
  assert.equal(advanceEffects(active, pad(1, 1), 1).feedback, 0);
});
test('release smoothing is frame-rate independent and eventually becomes exact zero', () => {
  const results = [30, 60, 144].map(hz => {
    let state = armed();
    for (let i = 0; i < hz; i++) state = advanceEffects(state, pad(1, 0.5), 1 / hz);
    for (let i = 0; i < hz / 2; i++) state = advanceEffects(state, pad(), 1 / hz);
    return state.feedback;
  });
  assert.ok(Math.max(...results) - Math.min(...results) < 1e-10);
  let state = advanceEffects(armed(), pad(1, 1), 0.1);
  for (let i = 0; i < 180; i++) state = advanceEffects(state, pad(), 1 / 60);
  assert.equal(state.feedback, 0); assert.equal(state.distortion, 0);
});

test('ten distinct presets; RB walks all of them one press at a time and wraps', () => {
  assert.equal(EFFECT_NAMES.length, 10);
  assert.equal(new Set(EFFECT_NAMES).size, 10);
  assert.ok(!EFFECT_NAMES.includes('镜像'), 'kaleid lives on Y, not in presets');
  let state = armed(); const seen = [state.preset];
  for (let i = 0; i < 10; i++) {
    state = advanceEffects(state, pad(0, 0, [5]), 0.1);
    state = advanceEffects(state, pad(), 0.1);
    seen.push(state.preset);
  }
  assert.deepEqual(seen, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);
});
