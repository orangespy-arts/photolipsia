import { PROTOCOL_VERSION } from './version.js';

/**
 * Create an empty AVParams frame (protocol v1).
 * All continuous/envelope values are clamped to [0,1]; events default to [].
 */
export function emptyParams(source = 'unknown', time = 0) {
  return {
    version: PROTOCOL_VERSION,
    rms: 0,
    bands: { low: 0, mid: 0, high: 0 },
    centroid: 0,
    flatness: 0,
    onset: 0,
    beatPhase: 0,
    events: [],
    source,
    time,
  };
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

/**
 * Validate (and repair) a frame from an untrusted source (OSC bridge,
 * recorded file, user code). Returns { params, errors } — errors is a list
 * of human-readable problems found; params is a safe AVParams frame with
 * out-of-range values clamped and missing fields defaulted.
 */
export function sanitizeParams(raw, { now = 0 } = {}) {
  const errors = [];
  const safe = emptyParams('unknown', now);

  if (raw == null || typeof raw !== 'object') {
    errors.push('frame is not an object');
    return { params: safe, errors };
  }

  for (const key of ['rms', 'centroid', 'flatness', 'onset', 'beatPhase']) {
    const v = raw[key];
    if (v === undefined || v === null) continue; // keep default
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      errors.push(`${key} is not a finite number`);
      continue;
    }
    if (v < 0 || v > 1) errors.push(`${key} out of [0,1] (clamped)`);
    safe[key] = clamp01(v);
  }

  if (raw.bands != null && typeof raw.bands === 'object') {
    for (const band of ['low', 'mid', 'high']) {
      const v = raw.bands[band];
      if (v === undefined || v === null) continue;
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        errors.push(`bands.${band} is not a finite number`);
        continue;
      }
      if (v < 0 || v > 1) errors.push(`bands.${band} out of [0,1] (clamped)`);
      safe.bands[band] = clamp01(v);
    }
  } else if (raw.bands !== undefined) {
    errors.push('bands is not an object');
  }

  if (raw.events !== undefined) {
    if (!Array.isArray(raw.events)) {
      errors.push('events is not an array');
    } else {
      safe.events = raw.events.filter((e) => {
        if (e == null || typeof e !== 'object' || typeof e.type !== 'string') {
          errors.push('event without string type dropped');
          return false;
        }
        return true;
      });
    }
  }

  if (raw.source !== undefined) {
    if (typeof raw.source === 'string' && raw.source.length > 0) {
      safe.source = raw.source;
    } else {
      errors.push('source is not a non-empty string');
    }
  }

  if (raw.time !== undefined) {
    if (typeof raw.time === 'number' && Number.isFinite(raw.time)) {
      safe.time = raw.time;
    } else {
      errors.push('time is not a finite number');
    }
  }

  return { params: safe, errors };
}
