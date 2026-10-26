/**
 * OSC addresses → AVParams frame assembly. Pure, unit-tested.
 *
 * The protocol doc's address table as code. Max/SC/PD owns analysis,
 * normalization AND smoothing (protocol iron rules) — this layer only
 * collects the messages of one 60Hz-ish cycle into a frame.
 *
 * Usage: an OscFrameAssembler per connection. feed(msg) accumulates;
 * takeFrame(now) returns the accumulated frame (sanitized) and resets —
 * values not resent this cycle fall back to 0 per emptyParams (the DSP
 * side resends every field every bundle at 60Hz per the doc's advice).
 */

import { emptyParams, sanitizeParams } from '../../protocol/params.js';

export function createOscFrameAssembler() {
  const acc = emptyParams('osc', 0);
  return {
    feed(msg, now = 0) {
      const [a1, a2, a3] = msg.args;
      switch (msg.address) {
        case '/av/rms': if (isNum(a1)) acc.rms = a1; break;
        case '/av/band/low': if (isNum(a1)) acc.bands.low = a1; break;
        case '/av/band/mid': if (isNum(a1)) acc.bands.mid = a1; break;
        case '/av/band/high': if (isNum(a1)) acc.bands.high = a1; break;
        case '/av/centroid': if (isNum(a1)) acc.centroid = a1; break;
        case '/av/flatness': if (isNum(a1)) acc.flatness = a1; break;
        case '/av/onset': if (isNum(a1)) acc.onset = a1; break;
        case '/av/beat': if (isNum(a1)) acc.beatPhase = a1; break;
        case '/av/event': {
          if (typeof a1 === 'string') {
            const e = { type: a1 };
            if (isNum(a2)) e.value1 = a2;
            if (isNum(a3)) e.value2 = a3;
            acc.events.push(e);
          }
          break;
        }
        default: break; // unknown address: ignore (forward compat)
      }
      if (now > 0) acc.time = now;
    },
    takeFrame(now = 0) {
      if (now > 0) acc.time = now;
      const { params, errors } = sanitizeParams({ ...acc, bands: { ...acc.bands }, events: [...acc.events] });
      // reset in place (assembler is reused across frames)
      const fresh = emptyParams('osc', now);
      Object.assign(acc, fresh, { bands: { ...fresh.bands }, events: [] });
      return { params, errors };
    },
  };
}

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}
