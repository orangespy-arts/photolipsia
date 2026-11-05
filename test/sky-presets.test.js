import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skyFor, hexToRgb, SKY_PRESETS } from '../src/mapping/skyPresets.js';
import { SCENES } from '../src/render/sceneCatalog.js';

test('only 空城 (s02) and 云海遗迹 (s09) get a sky; others stay as scanned', () => {
  const withSky = SCENES.filter((s) => skyFor(s)).map((s) => s.id);
  assert.deepEqual(withSky, ['s02', 's09']);
});

test('presets normalise to complete configs with rgb triples in 0..1', () => {
  for (const name of Object.keys(SKY_PRESETS)) {
    const c = skyFor({ sky: name });
    for (const k of ['top', 'horizon', 'bottom', 'cloud', 'shade']) {
      assert.equal(c[k].length, 3);
      assert.ok(c[k].every((v) => v >= 0 && v <= 1), `${name}.${k}`);
    }
    assert.ok(c.cover >= 0 && c.cover <= 1 && c.softness > 0 && c.scale > 0);
  }
});

test('object overrides merge onto a preset; bad values fall back to the preset', () => {
  const c = skyFor({ sky: { preset: 'bright', cover: 0.9, top: 'not-a-colour', speed: 'fast' } });
  assert.equal(c.cover, 0.9);
  assert.deepEqual(c.top, hexToRgb(SKY_PRESETS.bright.top));
  assert.equal(c.speed, SKY_PRESETS.bright.speed);
  assert.equal(skyFor({ sky: 'no-such-preset' }), null);
  assert.equal(skyFor({}), null);
  assert.deepEqual(hexToRgb('#ff8000'), [1, 128 / 255, 0]);
});
