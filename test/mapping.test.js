import { deepStrictEqual, ok } from 'node:assert';
import test from 'node:test';

import { emptyParams } from '../src/protocol/params.js';
import { combine } from '../src/mapping/combine.js';
import { regionEnergy, pulseScale, centroidHue } from '../src/mapping/visual.js';

function frame(source, overrides = {}) {
  return { ...emptyParams(source), ...overrides, bands: { ...emptyParams(source).bands, ...(overrides.bands ?? {}) } };
}

test('combine: weighted mean of continuums', () => {
  const a = frame('mock', { bands: { low: 0.2 } });
  const b = frame('osc', { bands: { low: 0.8 } });
  const out = combine([a, b], { mock: 0.5, osc: 0.5 });
  ok(Math.abs(out.bands.low - 0.5) < 1e-9, `got ${out.bands.low}`);
  deepStrictEqual(out.source, 'combined');
});

test('combine: onset takes the max (either source can pulse)', () => {
  const a = frame('mock', { onset: 0.1 });
  const b = frame('osc', { onset: 0.9 });
  ok(Math.abs(combine([a, b], { mock: 1, osc: 1 }).onset - 0.9) < 1e-9);
});

test('combine: ignores drivers with zero/missing weight', () => {
  const a = frame('mock', { rms: 0.4 });
  const b = frame('osc', { rms: 1.0 });
  const out = combine([a, b], { mock: 1, osc: 0 });
  ok(Math.abs(out.rms - 0.4) < 1e-9);
});

test('combine: events are concatenated and tagged', () => {
  const a = frame('mock', { events: [{ type: 'mark' }] });
  const b = frame('midi', { events: [{ type: 'note', pitch: 60 }] });
  const out = combine([a, b], { mock: 1, midi: 1 });
  deepStrictEqual(out.events.map((e) => e.type), ['mark', 'note']);
  ok(out.events[1].source === 'midi');
});

test('regionEnergy: low drives bottom, high drives top, mid middle', () => {
  const p = frame('mock', { bands: { low: 1, mid: 0, high: 0 } });
  ok(regionEnergy({ y: 0.0 }, p) > regionEnergy({ y: 1.0 }, p));
  const ph = frame('mock', { bands: { low: 0, mid: 1, high: 0 } });
  ok(regionEnergy({ y: 0.5 }, ph) > 0.8);
  const hi = frame('mock', { bands: { low: 0, mid: 0, high: 1 } });
  ok(regionEnergy({ y: 1.0 }, hi) > regionEnergy({ y: 0.0 }, hi));
});

test('regionEnergy is monotone in its band (no dead regions)', () => {
  const p = frame('mock', { bands: { low: 1 } });
  const e0 = regionEnergy({ y: 0 }, p);
  const e1 = regionEnergy({ y: 1 }, p);
  ok(e1 > 0, `top must still see some low energy, got ${e1}`);
  ok(e0 > e1);
});

test('pulseScale: onset pushes scale above 1, silence sits at 1', () => {
  const silent = frame('mock');
  deepStrictEqual(pulseScale({ y: 0.5 }, silent), 1);
  const hit = frame('mock', { onset: 1, bands: { low: 1 } });
  ok(pulseScale({ y: 0.0 }, hit) > 1.3);
});

test('centroidHue: centroid 0.5 → no shift, 1 → +0.25, 0 → −0.25', () => {
  deepStrictEqual(centroidHue(frame('mock', { centroid: 0.5 })), 0);
  ok(Math.abs(centroidHue(frame('mock', { centroid: 1 })) - 0.25) < 1e-9);
  ok(Math.abs(centroidHue(frame('mock', { centroid: 0 })) + 0.25) < 1e-9);
});
