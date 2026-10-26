/**
 * Mapping: AVParams → visual parameters (pure functions, no smoothing).
 * All outputs are plain numbers the render layer can apply per splat.
 */

/**
 * Spatial band assignment: which splats listen to which band.
 * Pure: (region descriptor, AVParams) → energy 0..1.
 * region: { y } normalized height 0..1 of the splat's base position
 * (0 = bottom, 1 = top). Low drives the bottom, high drives the top,
 * mid the middle — with soft crossfade so no region is ever dead.
 */
export function regionEnergy(region, params) {
  const y = clamp01(region.y);
  const b = params.bands;
  // triangular falloff with 0.25 overlap, plus a 0.1 floor so no region is
  // ever fully deaf to any band (soft crossfade)
  const FLOOR = 0.1;
  const tri = (center) => {
    const t = 1 - Math.min(1, Math.abs(y - center) / 0.75);
    return FLOOR + (1 - FLOOR) * t;
  };
  const wLow = tri(0.15);
  const wMid = tri(0.5);
  const wHigh = tri(0.85);
  const e = wLow * b.low + wMid * b.mid + wHigh * b.high;
  return clamp01(e);
}

/**
 * Pulse envelope for one splat: onset transient + continuous band energy.
 * Returns a scale multiplier around 1.0 (e.g. 0.85 .. 1.35).
 */
export function pulseScale(region, params, { onsetGain = 0.35, bandGain = 0.25 } = {}) {
  const e = regionEnergy(region, params);
  return 1 + onsetGain * params.onset + bandGain * e;
}

/**
 * Color shift in hue space: spectral centroid → hue rotation 0..1.
 * Returns hue offset in [-0.5, 0.5] relative to the splat's base hue.
 */
export function centroidHue(params) {
  return (params.centroid - 0.5) * 0.5;
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}
