import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGains, applyGains } from '../src/mapping/gains.js';
import { emptyParams } from '../src/protocol/params.js';

test('parseGains reads key=value pairs', () => {
  assert.deepEqual(parseGains('low=1.5,onset=2'), { low: 1.5, onset: 2 });
});

test('parseGains ignores garbage and negatives', () => {
  assert.deepEqual(parseGains('low=abc,foo=2,onset=-1,high=0.5'),
    { high: 0.5 });
});

test('parseGains accepts empty', () => {
  assert.deepEqual(parseGains(''), {});
  assert.deepEqual(parseGains(null), {});
});

test('applyGains multiplies and clamps continuums', () => {
  const p = emptyParams('test', 0);
  p.bands.low = 0.8;
  p.centroid = 0.5;
  applyGains(p, { low: 2, centroid: 3 });
  assert.equal(p.bands.low, 1); // clamped
  assert.equal(p.centroid, 1);
});

test('applyGains scales onset peaks', () => {
  const p = emptyParams('test', 0);
  p.onset = 0.4;
  applyGains(p, { onset: 2 });
  assert.equal(p.onset, 0.8);
});

test('applyGains with no gains is a no-op', () => {
  const p = emptyParams('test', 0);
  p.bands.low = 0.3;
  const before = { ...p.bands };
  applyGains(p, {});
  assert.deepEqual(p.bands, before);
});

test('applyGains gain=0 mutes the field (0 is meaningful)', () => {
  const p = emptyParams('test', 0);
  p.bands.high = 0.5;
  p.onset = 0.5;
  applyGains(p, { high: 0, onset: 0 });
  assert.equal(p.bands.high, 0);
  assert.equal(p.onset, 0);
});
