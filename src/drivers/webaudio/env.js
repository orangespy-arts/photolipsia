/**
 * Smoothing / envelope helpers for drivers — pure, unit-tested.
 *
 * Protocol iron rule 1: every value in an AVParams frame is
 * "ready to render". These helpers are how a driver delivers that.
 */

/**
 * One-pole smoother with separate attack/release time constants (seconds).
 * Classic follower: fast rise, slow fall, so visuals snap to hits and
 * decay musically. dt guard: if dt is huge (tab hidden), snap.
 */
export function follower(state, target, dt, { attack = 0.05, release = 0.2 } = {}) {
  const tau = target > state.value ? attack : release;
  const k = dt >= 1 ? 1 : 1 - Math.exp(-dt / Math.max(1e-4, tau));
  state.value += (target - state.value) * k;
  return state.value;
}

/**
 * Onset envelope: a detected trigger (fluxRatio above threshold) charges
 * the envelope to the trigger strength; it decays exponentially (~200ms
 * per protocol docs). Not a boolean — 0.9 = strong fresh transient,
 * 0.05 = residue of the last one.
 */
export function onsetEnvelope(state, triggered, strength, dt, { decayTau = 0.2 } = {}) {
  state.value *= Math.exp(-dt / decayTau);
  if (triggered) state.value = Math.max(state.value, strength);
  return clamp01(state.value);
}

/**
 * Detect a transient from spectral flux: ratio of current flux to its
 * running mean (kept by the caller's analysis state) above threshold,
 * with a refractory window so one hit = one trigger even if flux stays
 * high for a few frames.
 */
export function fluxTrigger(state, fluxRatio, dt, { threshold = 1.8, refractory = 0.08 } = {}) {
  state.sinceLast = (state.sinceLast ?? Infinity) + dt;
  if (fluxRatio > threshold && state.sinceLast >= refractory) {
    state.sinceLast = 0;
    return true;
  }
  return false;
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}
