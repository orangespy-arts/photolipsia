import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeeds, growSeeds, coverage } from '../src/mapping/greening.js';

// frameless math: ball on the ground plane at (0,0), seeds at known spots

const near = (v, eps = 1e-9) => assert.ok(Math.abs(v) < eps, `expected ~0, got ${v}`);

test('createSeeds: positions copied, bloom starts at initial', () => {
  const seeds = createSeeds([[1, 0, 2], [3, 0, 4]]);
  assert.equal(seeds.length, 2);
  assert.deepEqual(seeds[0].position, [1, 0, 2]);
  assert.equal(seeds[0].bloom, 0);
  const pre = createSeeds([[0, 0, 0]], 0.5);
  assert.equal(pre[0].bloom, 0.5);
});

test('growSeeds: seed far from ball never grows', () => {
  const seeds = createSeeds([[10, 0, 10]]);
  const grew = growSeeds(seeds, [0, 0, 0], 1, {});
  assert.equal(grew, 0);
  assert.equal(seeds[0].bloom, 0);
});

test('growSeeds: seed at ball feet grows to full in ~1/speed seconds', () => {
  const seeds = createSeeds([[0, 0, 0]]);
  // speed 1.2/s → full at 1/1.2 ≈ 0.833s
  growSeeds(seeds, [0, 0, 0], 0.5, {});
  assert.ok(seeds[0].bloom > 0 && seeds[0].bloom < 1);
  growSeeds(seeds, [0, 0, 0], 0.5, {});
  near(seeds[0].bloom - 1, 1e-9);
});

test('growSeeds: falloff — rim seed grows slower than center seed', () => {
  const center = createSeeds([[0, 0, 0]]);
  const rim = createSeeds([[0.76, 0, 0]]); // 0.76 of default radius 0.8
  growSeeds(center, [0, 0, 0], 0.2, {});
  growSeeds(rim, [0, 0, 0], 0.2, {});
  assert.ok(center[0].bloom > rim[0].bloom * 2,
    `center ${center[0].bloom} should dwarf rim ${rim[0].bloom}`);
});

test('growSeeds: one-way — ball leaves, bloom holds (no decay)', () => {
  const seeds = createSeeds([[0, 0, 0]]);
  growSeeds(seeds, [0, 0, 0], 0.4, {});
  const b = seeds[0].bloom;
  growSeeds(seeds, [50, 0, 50], 5, {});
  assert.equal(seeds[0].bloom, b);
});

test('growSeeds: fully grown seeds stop consuming work', () => {
  const seeds = createSeeds([[0, 0, 0]]);
  growSeeds(seeds, [0, 0, 0], 2, {});
  const grew = growSeeds(seeds, [0, 0, 0], 2, {});
  assert.equal(grew, 0);
});

test('growSeeds: bandLow widens radius — mid-distance seed grows only with bass', () => {
  const mid = createSeeds([[1.0, 0, 0]]); // outside 0.8, inside 0.8*1.6=1.28
  growSeeds(mid, [0, 0, 0], 0.5, {});
  assert.equal(mid[0].bloom, 0);
  const mid2 = createSeeds([[1.0, 0, 0]]);
  growSeeds(mid2, [0, 0, 0], 0.5, { bandLow: 1 });
  assert.ok(mid2[0].bloom > 0);
});

test('growSeeds: onset speeds growth — same dt, more bloom with onset', () => {
  const a = createSeeds([[0, 0, 0]]);
  const b = createSeeds([[0, 0, 0]]);
  growSeeds(a, [0, 0, 0], 0.1, {});
  growSeeds(b, [0, 0, 0], 0.1, { onset: 1 });
  assert.ok(b[0].bloom > a[0].bloom);
});

test('growSeeds: dt=0 is a no-op', () => {
  const seeds = createSeeds([[0, 0, 0]]);
  growSeeds(seeds, [0, 0, 0], 0, {});
  assert.equal(seeds[0].bloom, 0);
});

test('coverage: fraction of grown bloom, empty = 0', () => {
  assert.equal(coverage([]), 0);
  const seeds = createSeeds([[0, 0, 0], [1.1, 0, 0]]);
  growSeeds(seeds, [0, 0, 0], 0.4, {});      // seed 2 out of base radius
  const c = coverage(seeds);
  assert.ok(c > 0 && c < 0.5, `partial grow → coverage < 0.5, got ${c}`);
  growSeeds(seeds, [5, 0, 5], 0.5, {});      // far → nothing (holds)
  growSeeds(seeds, [0, 0, 0], 20, { bandLow: 1 }); // wide radius reaches both
  near(coverage(seeds) - 1, 1e-9);
});

test('growSeeds: y is ignored (planar) — ball above ground still greens', () => {
  const seeds = createSeeds([[0, 0, 0]]);
  const grew = growSeeds(seeds, [0, 5, 0], 0.5, {});
  assert.equal(grew, 1);
});
