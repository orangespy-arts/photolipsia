import { ok, deepStrictEqual } from 'node:assert';
import test from 'node:test';

import {
  bandBinRanges, bandEnergies, centroid, flatness,
  spectralFlux, analyzeFrame, createAnalysisState,
} from '../src/drivers/webaudio/dsp.js';

// ── helpers ──

// synth a magnitude spectrum: gaussian bump at a given frequency
function spectrum(peaks, { binHz = 10, nBins = 512, width = 5, amp = 1 } = {}) {
  const mags = new Float32Array(nBins);
  for (const [hz, a] of peaks) {
    const c = Math.round(hz / binHz);
    for (let i = 1; i <= width; i++) {
      for (const j of [c - i, c + i]) {
        if (j >= 0 && j < nBins) mags[j] = Math.max(mags[j], a * Math.exp(-((i / width) ** 2) * 3));
      }
    }
    if (c >= 0 && c < nBins) mags[c] = Math.max(mags[c], a);
  }
  return mags;
}

const HZ = { binHz: 10, nyquistHz: 5120 }; // 512 bins @ 10Hz — matches 1024-pt FFT at 44.1k (roughly)

// ── bandBinRanges ──

test('bandBinRanges: protocol edges 20-250/250-2k/2k-16k', () => {
  const r = bandBinRanges(HZ);
  deepStrictEqual(r.low, [2, 25]);
  deepStrictEqual(r.mid, [25, 200]);
  deepStrictEqual(r.high, [200, 512]); // 16k > nyquist here → clamped to nBins
});

test('bandBinRanges: wider nyquist keeps 16k edge', () => {
  const r = bandBinRanges({ binHz: 5, nyquistHz: 24000 });
  deepStrictEqual(r.high, [400, 3200]);
});

// ── bandEnergies ──

test('bandEnergies: bass-only signal energizes low, not high', () => {
  const mags = spectrum([[60, 1], [120, 0.8]]);
  const r = bandBinRanges(HZ);
  const e = bandEnergies(mags, r);
  ok(e.low > 0.5, `low=${e.low}`);
  ok(e.high < 0.01, `high=${e.high}`);
  ok(e.mid < e.low);
});

test('bandEnergies: hi-hat signal energizes high', () => {
  // wider spectrum so 8–12kHz bins exist: 2048 bins @ 10Hz = 20k nyquist
  const mags = spectrum([[8000, 1], [10000, 0.9], [12000, 0.8]], { nBins: 2048 });
  const ranges = bandBinRanges({ binHz: 10, nyquistHz: 20000 });
  const e = bandEnergies(mags, ranges);
  ok(e.high > 0.5, `high=${e.high}`);
  ok(e.low < 0.05);
});

test('bandEnergies: silence is zero everywhere', () => {
  const e = bandEnergies(new Float32Array(512), bandBinRanges(HZ));
  ok(e.low === 0 && e.mid === 0 && e.high === 0);
});

// ── centroid ──

test('centroid: bass → low value, hi-hat → high value (log 20Hz..20kHz scale)', () => {
  const bass = centroid(spectrum([[80, 1]]), HZ);
  const hat = centroid(spectrum([[9000, 1]], { nBins: 2048 }), { binHz: 10 });
  // 80Hz → log(80/20)/log(20000/20) ≈ 0.20; 9kHz → ≈ 0.88
  ok(bass < 0.25 && bass > 0.1, `bass centroid=${bass}`);
  ok(hat > 0.8, `hat centroid=${hat}`);
});

test('centroid: silence is neutral 0.5 (not a fake dark hue)', () => {
  deepStrictEqual(centroid(new Float32Array(512), HZ), 0.5);
});

// ── flatness ──

test('flatness: pure tone → near 0, white noise → high', () => {
  const tone = flatness(spectrum([[440, 1]]));
  ok(tone < 0.15, `tone flatness=${tone}`);
  // pseudo-white noise over the full range
  const noise = new Float32Array(512).map(() => 0.5 + 0.5 * (Math.abs(Math.sin(12.9898) * 43758.5453) % 1));
  const nf = flatness(noise);
  ok(nf > tone, `noise flatness=${nf} should beat tone ${tone}`);
});

test('flatness: silence → 0 (no jitter visual for empty input)', () => {
  deepStrictEqual(flatness(new Float32Array(512)), 0);
});

// ── spectralFlux ──

test('spectralFlux: counts only increases, not decreases', () => {
  const quiet = new Float32Array([0, 0, 0, 0]);
  const loud = new Float32Array([1, 2, 1, 1]);
  const copy = Float32Array.from(loud);
  ok(spectralFlux(loud, quiet) === 5, 'rise from silence counts all');
  ok(spectralFlux(copy, loud) === 0, 'identical frame = zero flux');
  // loud→quiet bin-by-bin: every bin decreases or stays, so flux is 0
  const lower = new Float32Array([1, 1, 1, 0.5]);
  ok(spectralFlux(lower, loud) === 0, 'pure decrease counts nothing');
});

// ── analyzeFrame ──

test('analyzeFrame: full pipeline produces protocol-shaped analysis', () => {
  const state = createAnalysisState();
  const a = analyzeFrame(spectrum([[60, 1], [440, 0.5]]), state, HZ);
  ok(a.bands.low > 0.3 && a.bands.low <= 1);
  ok(a.centroid >= 0 && a.centroid <= 1);
  ok(a.flatness >= 0 && a.flatness <= 1);
  ok(a.flux >= 0);
  // second identical frame → flux near 0 (no change = no onset)
  const b = analyzeFrame(spectrum([[60, 1], [440, 0.5]]), state, HZ);
  ok(b.flux < a.flux, `steady frame should not flux: a=${a.flux} b=${b.flux}`);
});

test('analyzeFrame: sudden hit produces a flux spike above running mean', () => {
  const state = createAnalysisState();
  // settle with quiet signal
  for (let i = 0; i < 10; i++) analyzeFrame(spectrum([[60, 0.05]]), state, HZ);
  // HIT: loud wideband
  const hit = analyzeFrame(spectrum([[60, 1], [3000, 1], [9000, 0.9]]), state, HZ);
  ok(hit.fluxRatio > 1.5, `fluxRatio=${hit.fluxRatio}`);
});
