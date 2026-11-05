import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepAmplitude, clampAmplitude, stepEffectSync, AMP_MAX, AMP_DEFAULT } from '../src/mapping/amplitude.js';

test('up/down multiply by 1.25 and are inverse of each other', () => {
  assert.equal(stepAmplitude(1, 1), 1.25);
  assert.equal(stepAmplitude(1.25, -1), 1);
});

test('clamps at 3x and reaches exactly 0 going down; restarts at 0.1 going up', () => {
  let v = 1;
  for (let i = 0; i < 20; i++) v = stepAmplitude(v, 1);
  assert.equal(v, AMP_MAX);
  for (let i = 0; i < 40; i++) v = stepAmplitude(v, -1);
  assert.equal(v, 0);
  assert.equal(stepAmplitude(0, -1), 0);
  assert.equal(stepAmplitude(0, 1), 0.1);
});

test('garbage input falls back to the default', () => {
  assert.equal(clampAmplitude(NaN), AMP_DEFAULT);
  assert.equal(clampAmplitude(0.01), 0);
});

test('effect sync steps by 0.05 on clean values and clamps to 0..1', () => {
  assert.equal(stepEffectSync(0.5, 1), 0.55);
  assert.equal(stepEffectSync(0.5, -1), 0.45);
  let v = 0.5;
  for (let i = 0; i < 30; i++) v = stepEffectSync(v, 1);
  assert.equal(v, 1);
  for (let i = 0; i < 30; i++) v = stepEffectSync(v, -1);
  assert.equal(v, 0);
  assert.equal(stepEffectSync(0.33, 1), 0.4);
  assert.equal(stepEffectSync(NaN, 0), 0.5);
});
