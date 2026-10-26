import { emptyParams, sanitizeParams } from '../protocol/params.js';

/**
 * Combine frames from multiple drivers into one (pure).
 * weights: { [driverId]: number } — frames from drivers without a weight
 * (or weight 0) are ignored. Weighted mean for continuums; envelope values
 * (onset) take the max (a hit from either source should pulse);
 * events are concatenated (tagged with their source); meta comes from the
 * highest-weighted frame.
 */
export function combine(frames, weights) {
  const active = frames
    .filter((f) => f && weights[f.source] > 0)
    .sort((a, b) => (weights[b.source] ?? 0) - (weights[a.source] ?? 0));
  if (active.length === 0) return emptyParams('combined', 0);

  const wsum = active.reduce((s, f) => s + weights[f.source], 0);
  const out = emptyParams('combined', active[0].time);
  const mix = (pick) => active.reduce((s, f) => s + pick(f) * weights[f.source], 0) / wsum;

  out.rms = mix((f) => f.rms);
  out.centroid = mix((f) => f.centroid);
  out.flatness = mix((f) => f.flatness);
  for (const band of ['low', 'mid', 'high']) {
    out.bands[band] = mix((f) => f.bands[band]);
  }
  out.onset = Math.max(...active.map((f) => f.onset));
  out.beatPhase = active[0].beatPhase; // phase from the dominant source
  out.events = active.flatMap((f) =>
    f.events.map((e) => ({ ...e, source: f.source })),
  );
  return sanitize(out);
}

// keep the combiner honest: its output is also protocol-sanitized
function sanitize(frame) {
  return sanitizeParams(frame).params;
}
