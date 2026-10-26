/**
 * Response-gain overrides for live tuning (?gain= URL params).
 *
 * Pure functions — parse a query string into a gains object, apply gains to
 * an AVParams frame. Gains multiply continuums (clamped 0..1 after), so
 * `?gain=low=1.5` makes the low band hit 1.5× harder on the visuals.
 * Onset uses max instead of multiply (it's an envelope: scaling a near-zero
 * baseline does nothing, but scaling peaks punches harder).
 */

const GAIN_KEYS = ['rms', 'low', 'mid', 'high', 'centroid', 'flatness', 'onset'];

/** "low=1.5,onset=2" → { low: 1.5, onset: 2 }. Garbage entries ignored. */
export function parseGains(spec = '') {
  const gains = {};
  for (const part of String(spec).split(',')) {
    const [key, raw] = part.split('=');
    const v = Number(raw);
    if (GAIN_KEYS.includes(key) && Number.isFinite(v) && v >= 0) gains[key] = v;
  }
  return gains;
}

/** Apply gains to a frame in place and return it. Gain 0 = mute the field. */
export function applyGains(p, gains = {}) {
  const mult = (v, g) => Math.min(1, Math.max(0, v * g));
  const has = (k) => gains[k] !== undefined;
  if (has('rms')) p.rms = mult(p.rms, gains.rms);
  if (has('low')) p.bands.low = mult(p.bands.low, gains.low);
  if (has('mid')) p.bands.mid = mult(p.bands.mid, gains.mid);
  if (has('high')) p.bands.high = mult(p.bands.high, gains.high);
  if (has('centroid')) p.centroid = mult(p.centroid, gains.centroid);
  if (has('flatness')) p.flatness = mult(p.flatness, gains.flatness);
  if (has('onset')) p.onset = Math.min(1, p.onset * gains.onset);
  return p;
}
