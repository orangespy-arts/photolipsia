import { ok, deepStrictEqual } from 'node:assert';
import test from 'node:test';

import {
  createPeakTracker, trackPeak, normalize, createAutoGainState, applyAutoGain,
} from '../src/drivers/webaudio/autogain.js';

const DT = 1 / 60;

test('trackPeak: rises instantly, holds through warmup', () => {
  const s = createPeakTracker({ warmupFrames: 10 });
  trackPeak(s, 0.8, DT);
  ok(Math.abs(s.peak - 0.8) < 1e-9);
  // within warmup, no decay
  for (let i = 0; i < 5; i++) trackPeak(s, 0.1, DT);
  ok(Math.abs(s.peak - 0.8) < 1e-9, `warmup must hold peak: ${s.peak}`);
});

test('trackPeak: decays after warmup (volume-up adapts within seconds)', () => {
  const s = createPeakTracker({ tau: 1, warmupFrames: 2 });
  trackPeak(s, 1.0, DT);
  trackPeak(s, 0.01, DT); // warmup done
  for (let i = 0; i < 60; i++) trackPeak(s, 0.01, DT); // 1s of quiet
  ok(s.peak < 0.5, `peak should decay: ${s.peak}`);
});

test('trackPeak: floor keeps quiet rooms from dividing by ~0', () => {
  const s = createPeakTracker({ floor: 0.02 });
  const ceil = trackPeak(s, 0.0001, DT);
  ok(ceil === 0.02, `floor: ${ceil}`);
});

test('normalize: division + clamp', () => {
  deepStrictEqual(normalize(0.5, 1.0), 0.5);
  deepStrictEqual(normalize(2.0, 1.0), 1); // over-ceiling clamps
  deepStrictEqual(normalize(0.5, 0.25), 1);
});

test('applyAutoGain: quiet-then-loud ends up near full range', () => {
  const state = createAutoGainState();
  // 40 quiet frames (warmup sees quiet as the ceiling)
  let out;
  for (let i = 0; i < 40; i++) {
    out = applyAutoGain(state, { rms: 0.05, bands: { low: 0.05, mid: 0.04, high: 0.03 } }, DT);
  }
  ok(out.bands.low > 0.8, `quiet normalized up: ${out.bands.low}`);
  // then something loud: clamps to 1 rather than blowing out
  out = applyAutoGain(state, { rms: 0.6, bands: { low: 0.6, mid: 0.2, high: 0.1 } }, DT);
  ok(out.bands.low === 1, `loud clamps: ${out.bands.low}`);
});

test('applyAutoGain: does not mutate raw input', () => {
  const state = createAutoGainState();
  const raw = { rms: 0.5, bands: { low: 0.5, mid: 0.5, high: 0.5 } };
  applyAutoGain(state, raw, DT);
  deepStrictEqual(raw.rms, 0.5);
  deepStrictEqual(raw.bands.low, 0.5);
});
