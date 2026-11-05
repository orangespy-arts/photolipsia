import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceFade, FADE_SECONDS } from '../src/mapping/fadeAlpha.js';

test('fade ramps linearly over FADE_SECONDS both ways and clamps', () => {
  let a = 0;
  for (let i = 0; i < 18; i++) a = advanceFade(a, true, 1 / 60);
  assert.ok(Math.abs(a - 18 / 60 / FADE_SECONDS) < 1e-9);
  a = advanceFade(a, true, 10); a = advanceFade(a, true, 10); a = advanceFade(a, true, 10);
  assert.equal(a, 1);
  assert.equal(advanceFade(0.1, false, 1), 0);
  assert.equal(advanceFade(NaN, true, NaN), 0);
});
