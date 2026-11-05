// Splat music-motion amplitude (keyboard ↑/↓). Multiplies the whole shake
// displacement on the GPU: 0 = particles perfectly still, 3 = triple.
export const AMP_MIN = 0, AMP_MAX = 3, AMP_DEFAULT = 1, AMP_STEP = 1.25;
const FLOOR = 0.05, RESTART = 0.1;

export function clampAmplitude(v) {
  if (!Number.isFinite(v)) return AMP_DEFAULT;
  const c = Math.max(AMP_MIN, Math.min(AMP_MAX, v));
  return c < FLOOR ? 0 : c;
}

// dir +1 / -1: multiplicative steps feel even across the range; stepping up
// from 0 restarts at 0.1, stepping down below 0.05 lands on exactly 0.
export function stepAmplitude(value, dir) {
  const v = clampAmplitude(value);
  if (dir > 0) return clampAmplitude(v === 0 ? RESTART : v * AMP_STEP);
  if (dir < 0) return clampAmplitude(v / AMP_STEP);
  return v;
}

// Effect-sync level (keyboard ←/→): linear 0..1 in 0.05 steps, snapped so
// repeated presses land on clean values.
export const EFFECT_STEP = 0.05;
export function stepEffectSync(value, dir) {
  const v = Number.isFinite(value) ? value : 0.5;
  const next = v + Math.sign(dir) * EFFECT_STEP;
  return Math.max(0, Math.min(1, Math.round(next / EFFECT_STEP) * EFFECT_STEP));
}
