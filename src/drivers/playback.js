/**
 * Playback driver — replay a parsed recording as if it were live.
 *
 * Wall clock → recording time mapping: `t0` (s, default 0) is where in
 * the recording the replay starts; looping wraps at the recording end.
 * Recorded frames are already driver-smoothed (iron rule 1 survives the
 * round trip) — this driver re-emits them verbatim, source-tagged.
 */
import { frameAt } from '../rec/play.js';

export function createPlaybackDriver(rec, { t0 = 0, loop = true, fps = 60 } = {}) {
  const start = rec.start;
  const end = rec.start + rec.duration;
  const window = rec.duration;

  function poll(nowSeconds = 0) {
    // first poll anchors wall clock to the requested recording offset
    if (anchor === null) anchor = nowSeconds - (start + t0);
    let rt = nowSeconds - anchor; // recording time (absolute)
    if (loop && window > 0) {
      rt = start + ((rt - start) % window + window) % window; // wrap, always ≥ start
    } else {
      rt = Math.min(Math.max(rt, start), end);
    }
    const frame = frameAt(rec, rt);
    if (!frame) return empty();
    // tag as playback WITHOUT mutating the recorded frame
    return { ...frame, source: 'playback' };
  }

  let anchor = null;
  const empty = () => ({
    version: 1, rms: 0, bands: { low: 0, mid: 0, high: 0 },
    centroid: 0.5, flatness: 0, onset: 0, beatPhase: 0,
    events: [], source: 'playback', time: 0,
  });

  return {
    id: 'playback',
    async start() {},
    stop() {},
    poll,
    get duration() { return window; },
  };
}
