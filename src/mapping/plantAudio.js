const unit = (value) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
export function plantAudioTarget(params) {
  return { low: unit(params?.bands?.low), mid: unit(params?.bands?.mid),
    high: unit(params?.bands?.high), onset: unit(params?.onset) };
}
export function followPlantAudio(current, target, dt) {
  const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
  const rate = target > current ? 28 : 9;
  const next = current + (target - current) * (1 - Math.exp(-rate * elapsed));
  return Math.abs(next - target) < 0.0001 ? target : next;
}
export function clampOnsetSize(value) {
  return Number.isFinite(value) ? Math.min(10, Math.max(0, value)) : 1;
}
// Affine motion about each root. Matches the GPU expression in plantMotion.js.
export function plantMotion(traits, audio, time, onsetSize = 1) {
  const energy = [audio.low, audio.mid, audio.high][traits.band] * traits.gain;
  const t = time * traits.rate;
  const wave = Math.sin(t * [2.2, 4.5, 14][traits.band] + traits.phase);
  const stretch = 1 + energy * ([0.48, 0.13, 0.07][traits.band] * (0.65 + 0.35 * wave)
    + audio.onset * [0.22, 0.08, 0.03][traits.band] * clampOnsetSize(onsetSize));
  const sway = energy * [0.05, 0.3, 0.12][traits.band] * wave;
  return { stretch, x: sway * Math.cos(traits.phase), z: sway * Math.sin(traits.phase) };
}
