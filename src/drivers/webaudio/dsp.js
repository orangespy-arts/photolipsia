/**
 * Pure DSP core for the web-audio driver — no Web Audio API dependency,
 * so it runs (and is unit-tested) in Node.
 *
 * Input: one FFT magnitude frame (linear magnitudes, bin i has center
 * frequency i * binHz) plus the previous analysis state. Output: raw
 * (pre-autogain) band energies, centroid, flatness, onset strength.
 *
 * Everything here is stateless except where an explicit `prev` state
 * object is passed in/out; smoothing and auto-gain live in their own
 * modules (env.js / autogain.js).
 */

/**
 * Bin indices for the three protocol bands at a given bin resolution.
 * Edges per docs/protocol.md: ~20–250 / ~250–2k / ~2k–16k Hz.
 * Returns { low: [i0, i1), mid: [i0, i1), high: [i0, i1) } with i1
 * clamped to fftSize/2.
 */
export function bandBinRanges({ binHz, nyquistHz }) {
  const nBins = Math.floor(nyquistHz / binHz);
  const idx = (hz) => Math.min(nBins, Math.max(0, Math.round(hz / binHz)));
  const clamp1 = (i) => Math.min(nBins, i);
  return {
    low: [idx(20), clamp1(idx(250))],
    mid: [idx(250), clamp1(idx(2000))],
    high: [idx(2000), clamp1(idx(16000))],
  };
}

/**
 * Band energies from one magnitude frame: each band's share of total
 * spectral energy (sum of band magnitudes / sum of all magnitudes),
 * sqrt-compressed for perceptual lift. Shares are scale-free — a wide
 * band isn't penalized for having more bins, loudness is autogain's job.
 */
export function bandEnergies(mags, ranges) {
  let total = 0;
  for (let i = 0; i < mags.length; i++) total += mags[i] ?? 0;
  if (total <= 1e-9) return { low: 0, mid: 0, high: 0 };
  const band = ([i0, i1]) => {
    let sum = 0;
    const lo = Math.min(i0, i1), hi = Math.max(i0, i1);
    for (let i = lo; i < hi; i++) sum += mags[i] ?? 0;
    return Math.sqrt(sum / total);
  };
  return {
    low: band(ranges.low),
    mid: band(ranges.mid),
    high: band(ranges.high),
  };
}

/**
 * Spectral centroid on a log-frequency scale, 0..1.
 * Maps the weighted mean frequency onto log20Hz..log20kHz — protocol says
 * "log scale 0..1", so 100Hz ≈ 0.23, 1kHz ≈ 0.58, 10kHz ≈ 0.93.
 * Pure silence → 0.5 (neutral). Unstable DC-only input clamps to 0.
 */
const CENTROID_FMIN = 20, CENTROID_FMAX = 20000;
export function centroid(mags, { binHz }) {
  let num = 0, den = 0;
  for (let i = 0; i < mags.length; i++) {
    const m = mags[i];
    if (m <= 0) continue;
    const w = m * Math.log(1 + (i * binHz) / 50);
    num += w * i;
    den += w;
  }
  if (den <= 0) return 0.5;
  const hz = Math.max(CENTROID_FMIN, (num / den) * binHz);
  const t = Math.log(hz / CENTROID_FMIN) / Math.log(CENTROID_FMAX / CENTROID_FMIN);
  return clamp01(t);
}

/**
 * Spectral flatness (geometric mean / arithmetic mean of power), 0..1.
 * 1 = white noise, 0 = pure tone. Bins below a relative floor participate
 * as the floor (log needs nonzero), so a sparse tone against silence
 * reads as tonal, and true silence returns 0 (no jitter for empty input).
 */
export function flatness(mags) {
  let max = 0;
  for (let i = 0; i < mags.length; i++) max = Math.max(max, mags[i] ?? 0);
  if (max <= 1e-9) return 0;
  const floor = max * 1e-6;
  let logSum = 0, sum = 0;
  for (let i = 0; i < mags.length; i++) {
    const m = Math.max(mags[i] ?? 0, floor);
    logSum += Math.log(m);
    sum += m;
  }
  const n = mags.length;
  const geo = Math.exp(logSum / n);
  const arith = sum / n;
  const f = geo / (arith || 1e-9);
  return clamp01(f * f); // square: typical audio sits low, noise pushes toward 1
}

/**
 * Onset strength via spectral flux: half-wave rectified frame-to-frame
 * increase in magnitude, summed across bins, normalized to a 0..1-ish
 * raw value. Caller owns thresholding + envelope (env.js).
 */
export function spectralFlux(mags, prevMags) {
  let flux = 0;
  const n = Math.min(mags.length, prevMags.length);
  for (let i = 0; i < n; i++) {
    const d = (mags[i] ?? 0) - (prevMags[i] ?? 0);
    if (d > 0) flux += d;
  }
  return flux;
}

/**
 * Analysis state for analyzeFrame(). Keep in driver code, pass back in.
 */
export function createAnalysisState() {
  return { prevMags: null, fluxMean: 0, fluxVar: 0 };
}

/**
 * One analyze step: magnitudes → { bands, centroid, flatness, flux, fluxRatio }.
 * fluxRatio = flux / running mean (peak detection happens downstream:
 * ratio above ~1.5–2 means "something just started"). Welford-style
 * running mean/variance on flux for an adaptive threshold.
 */
export function analyzeFrame(mags, state, { binHz, nyquistHz }) {
  const ranges = bandBinRanges({ binHz, nyquistHz });
  const bands = bandEnergies(mags, ranges);
  const flux = spectralFlux(mags, state.prevMags ?? mags.map(() => 0));
  const oldMean = state.fluxMean;
  state.fluxMean += (flux - state.fluxMean) * 0.02; // ~1s time constant at 50fps
  state.fluxVar += ((flux - oldMean) ** 2 - state.fluxVar) * 0.02;
  state.prevMags = Float32Array.from(mags);
  return {
    bands,
    centroid: centroid(mags, { binHz }),
    flatness: flatness(mags),
    flux,
    fluxRatio: flux / (state.fluxMean + 1e-9),
  };
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}
