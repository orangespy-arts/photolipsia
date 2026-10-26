/**
 * Recorder — AVParams frames → JSONL. Pure, unit-testable.
 *
 * Format: one JSON object per line, the protocol frame as-is. The frame
 * IS the format (its version field rides along), so a recording is a
 * protocol-valid frame stream — record.js and play.js stay dumb, and any
 * future tool (Unity track included) reads the same files.
 *
 * Memory is bounded: a ring buffer of the last `maxFrames` frames
 * (default 60Hz × 5min = 18000). Older frames fall off; the recording
 * is "the last N seconds", which matches the fallback/performance use.
 */

export function createRecorder({ maxFrames = 18000 } = {}) {
  const lines = [];
  let dropped = 0;

  return {
    /** Append one frame (an already-sanitized AVParams object). */
    add(frame) {
      const line = JSON.stringify(frame);
      if (lines.length >= maxFrames) {
        lines.shift(); // ring behavior; O(n) shift is fine at these sizes
        dropped++;
      }
      lines.push(line);
      return line;
    },
    get length() { return lines.length; },
    get dropped() { return dropped; },
    /** Full recording as a .jsonl string (newline-terminated). */
    toJSONL() {
      return lines.length ? lines.join('\n') + '\n' : '';
    },
  };
}

/** Suggested filename for a recording session. */
export function recordingName(driverId, startedAtMs) {
  const d = new Date(startedAtMs);
  const p = (n) => String(n).padStart(2, '0');
  return `rec-${driverId}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.jsonl`;
}
