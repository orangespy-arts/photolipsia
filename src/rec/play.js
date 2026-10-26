/**
 * Playback reader — parse a .jsonl recording, random-access frames.
 * Pure, unit-testable.
 *
 * Semantics: frameAt(t) returns the LAST frame with time ≤ t (exact-frame
 * rule: a frame is "in effect" from its timestamp until the next one).
 * Before the first frame → null (caller decides: hold or gap). Garbage
 * lines are skipped and counted, never fatal — a truncated last line
 * (crash mid-write) only loses that frame.
 */
import { sanitizeParams } from '../protocol/params.js';

export function parseRecording(text) {
  const frames = [];
  let badLines = 0;
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try {
      const { params, errors } = sanitizeParams(JSON.parse(s));
      // errors = the line carried real garbage (wrong types, bad bands);
      // those lines count as bad. Clean lines (even all-zero frames) keep.
      if (errors.length > 0) badLines++;
      else frames.push(params);
    } catch {
      badLines++;
    }
  }
  // frames must be time-ascending for binary search; recordings are,
  // but sort defensively (stable — equal times keep order)
  frames.sort((a, b) => a.time - b.time);
  return {
    frames,
    badLines,
    get duration() {
      return frames.length ? frames[frames.length - 1].time - frames[0].time : 0;
    },
    get start() { return frames.length ? frames[0].time : 0; },
  };
}

/** Binary search: last frame with time ≤ t, or null if t is before all. */
export function frameAt(rec, t) {
  const { frames } = rec;
  if (frames.length === 0 || t < frames[0].time) return null;
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid].time <= t) lo = mid;
    else hi = mid - 1;
  }
  return frames[lo];
}
