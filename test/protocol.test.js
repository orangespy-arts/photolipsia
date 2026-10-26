import { deepStrictEqual } from 'node:assert';
import test from 'node:test';

import { emptyParams, sanitizeParams } from '../src/protocol/params.js';
import { PROTOCOL_VERSION } from '../src/protocol/version.js';
import { createDriverRegistry } from '../src/drivers/registry.js';
import { createMockDriver } from '../src/drivers/mock.js';

test('emptyParams has all protocol v1 fields', () => {
  const p = emptyParams('test', 1.5);
  deepStrictEqual(p.version, PROTOCOL_VERSION);
  deepStrictEqual(p.rms, 0);
  deepStrictEqual(p.bands, { low: 0, mid: 0, high: 0 });
  deepStrictEqual(p.centroid, 0);
  deepStrictEqual(p.flatness, 0);
  deepStrictEqual(p.onset, 0);
  deepStrictEqual(p.beatPhase, 0);
  deepStrictEqual(p.events, []);
  deepStrictEqual(p.source, 'test');
  deepStrictEqual(p.time, 1.5);
});

test('sanitizeParams clamps out-of-range values', () => {
  const { params, errors } = sanitizeParams({
    rms: 1.7, bands: { low: -0.2, mid: 0.5 }, onset: 3,
  });
  deepStrictEqual(params.rms, 1);
  deepStrictEqual(params.bands.low, 0);
  deepStrictEqual(params.bands.mid, 0.5);
  deepStrictEqual(params.onset, 1);
  ok(errors.length >= 3, `expected >=3 errors, got ${JSON.stringify(errors)}`);
});

test('sanitizeParams drops garbage frames safely', () => {
  for (const bad of [null, undefined, 42, 'nope']) {
    const { params, errors } = sanitizeParams(bad);
    ok(errors.length > 0);
    deepStrictEqual(params.bands, { low: 0, mid: 0, high: 0 });
    deepStrictEqual(params.source, 'unknown');
  }
});

test('sanitizeParams keeps valid events, drops malformed ones', () => {
  const { params } = sanitizeParams({
    events: [
      { type: 'note', pitch: 60, velocity: 0.8, time: 1 },
      { velocity: 0.9 },                       // no type -> dropped
      null,                                    // dropped
      { type: 'mark' },                        // kept
    ],
  });
  deepStrictEqual(params.events.map((e) => e.type), ['note', 'mark']);
});

test('driver registry registers and retrieves by id', () => {
  const reg = createDriverRegistry();
  reg.register(createMockDriver());
  ok(reg.get('mock'));
  deepStrictEqual(reg.get('nope'), null);
  deepStrictEqual(reg.ids(), ['mock']);
});

test('registry rejects unknown ids and non-drivers', () => {
  const reg = createDriverRegistry();
  throws(() => reg.register({ id: 'alien', poll() {} }));
  throws(() => reg.register({ id: 'mock' })); // no poll
});

test('mock "pulse" driver: kick decays within the beat', () => {
  const d = createMockDriver({ kind: 'pulse' });
  const at = (t) => d.poll(t);
  const hit = at(0.0);
  const late = at(0.4); // 120bpm -> beat every 0.5s, 0.4s after kick
  ok(hit.bands.low > 0.5, `low at t=0 should be strong, got ${hit.bands.low}`);
  ok(late.bands.low < hit.bands.low, 'low must decay after the kick');
  ok(late.onset < hit.onset, 'onset envelope must decay');
  deepStrictEqual(hit.source, 'mock');
});

test('mock "silence" driver is all zeros (baseline for checks)', () => {
  const d = createMockDriver({ kind: 'silence' });
  const p = d.poll(3.2);
  deepStrictEqual(p.bands, { low: 0, mid: 0, high: 0 });
  deepStrictEqual(p.rms, 0);
  deepStrictEqual(p.onset, 0);
});

// tiny local helpers (node:test's `ok`/`throws` are not global imports here)
import { ok, throws } from 'node:assert';
