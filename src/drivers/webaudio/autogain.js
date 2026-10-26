/**
 * Auto-gain normalization — pure, unit-tested.
 *
 * Requirement: any room / any input level should produce full-range
 * visuals. Strategy: per-field decaying peak tracker. The rolling peak
 * estimates "what loud means around here"; energy is divided by it and
 * clamped to 0..1. A decaying peak adapts both ways: turn the volume up
 * and the ceiling follows within seconds; quiet passages still show
 * motion instead of pinning at 0.
 */

/**
 * Decaying peak state. Falls toward `value` with time constant tau, so a
 * single spike doesn't own the ceiling forever, but sustained loudness
 * holds it. `warmup` frames bypass the decay (recording studio rule:
 * until we've seen enough signal, trust what we've seen, don't shrink it).
 */
export function createPeakTracker({ tau = 8, floor = 0.02, warmupFrames = 40 } = {}) {
  return { peak: 0, frames: 0, tau, floor, warmupFrames };
}

export function trackPeak(state, value, dt) {
  state.frames++;
  if (value >= state.peak) {
    state.peak = value; // instant rise
  } else if (state.frames > state.warmupFrames) {
    state.peak *= Math.exp(-dt / state.tau); // slow decay after warmup
  }
  return Math.max(state.peak, state.floor);
}

/**
 * Normalize a raw (0..~1-ish) value by its tracked ceiling → 0..1.
 */
export function normalize(value, ceiling) {
  return clamp01(value / ceiling);
}

/**
 * Full auto-gain stage state: one tracker per protocol field.
 */
export function createAutoGainState() {
  return {
    rms: createPeakTracker(),
    low: createPeakTracker(),
    mid: createPeakTracker(),
    high: createPeakTracker(),
    centroid: null, // centroid is already 0..1 by construction — no gain
    flatness: null,
  };
}

/**
 * Apply auto-gain to a set of raw values. Returns a NEW object
 * { rms, bands: {low, mid, high} } normalized; centroid/flatness pass
 * through untouched (they're scale-free by definition).
 */
export function applyAutoGain(state, raw, dt) {
  const out = { bands: {} };
  for (const field of ['rms']) {
    const ceil = trackPeak(state[field], raw[field], dt);
    out[field] = normalize(raw[field], ceil);
  }
  for (const band of ['low', 'mid', 'high']) {
    const ceil = trackPeak(state[band], raw.bands[band], dt);
    out.bands[band] = normalize(raw.bands[band], ceil);
  }
  return out;
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}
