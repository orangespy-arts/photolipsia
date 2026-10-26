/**
 * Pure MIDI → AVParams core. No Web MIDI API dependency — takes raw MIDI
 * bytes with timestamps, keeps state; poll() assembles a protocol frame.
 * Unit-testable in Node.
 *
 * The DEVICE is the DSP side here: note velocity is already 0..127 →
 * /127 is a normalized value (iron rule 2 for free). What this layer adds:
 *  - note on/off → events[] + velocity-scaled onset envelope charge
 *  - CC → smoothed continuums (CC_MAP below, documented)
 *  - pitch bend (14-bit) → centroid
 *  - MIDI clock (0xF8, 24 ticks/quarter) → beatPhase — a real beat source;
 *    start/continue (0xFA/0xFB) reset the phase, stop (0xFC) holds it
 *
 * Channel bytes are accepted but ignored: one controller drives one
 * visualizer (combine.js handles multiple *drivers*, not MIDI channels).
 */
import { emptyParams } from '../../protocol/params.js';
import { follower, onsetEnvelope } from '../webaudio/env.js';

// CC → protocol field. Mod wheel + expression drive "mid" (swell; last
// one wins per frame), sustain pedal drives "high" (pressed = presence,
// released = decay), brightness CC74 drives centroid (it is literally
// named brightness on most synths). Unlisted CCs are ignored — extend
// this table together with the protocol doc.
export const CC_MAP = {
  1: 'mid',       // mod wheel
  11: 'mid',      // expression
  64: 'high',     // sustain pedal
  74: 'centroid', // brightness
};

export function createMidiCore({ fps = 60 } = {}) {
  const dt = 1 / fps;
  const st = {
    bands: { low: { value: 0 }, mid: { value: 0 }, high: { value: 0 } },
    onset: { value: 0 },
    centroid: 0.5,
    ticks: 0,          // clock ticks since transport start
    clockActive: false, // seen a tick recently
    lastClockAt: -Infinity,
    events: [],
  };

  const ON = (s) => (s & 0xf0) === 0x90;
  const OFF = (s) => (s & 0xf0) === 0x80;
  const CC = (s) => (s & 0xf0) === 0xb0;
  const BEND = (s) => (s & 0xf0) === 0xe0;

  /**
   * Feed one MIDI message. `bytes` includes the status byte (running
   * status is NOT supported — Web MIDI never emits it). `atSec` is the
   * event timestamp in the same clock as poll's `now`.
   */
  function feed(bytes, atSec) {
    const b0 = bytes[0];
    if (b0 >= 0xf0) return feedSystem(bytes, atSec);

    const d1 = bytes[1] ?? 0, d2 = bytes[2] ?? 0;
    const type = b0 & 0xf0;

    if (ON(type) && d2 > 0) {
      // note on: onset charge scales with velocity (protocol: onset is
      // not boolean — 0.9 = strong fresh hit), plus a protocol event
      onsetEnvelope(st.onset, true, d2 / 127, dt);
      st.events.push({ type: 'note', pitch: d1, velocity: d2 / 127, time: atSec });
    } else if (OFF(type) || (ON(type) && d2 === 0)) {
      st.events.push({ type: 'note', pitch: d1, velocity: 0, time: atSec });
    } else if (CC(type)) {
      const field = CC_MAP[d1];
      if (field === 'centroid') st.centroid = clamp01(d2 / 127);
      else if (field) follower(st.bands[field], d2 / 127, dt);
    } else if (BEND(type)) {
      const v14 = (d2 << 7) | d1; // 0..16383, 8192 = center
      st.centroid = clamp01(v14 / 16383);
    }
  }

  function feedSystem(bytes, atSec) {
    const b0 = bytes[0];
    if (b0 === 0xf8) { // clock: 24 ticks per quarter note
      st.clockActive = true;
      st.ticks++;
      st.lastClockAt = atSec;
    } else if (b0 === 0xfa || b0 === 0xfb) {
      st.ticks = 0; // start/continue: phase restarts
      st.clockActive = true;
      st.lastClockAt = atSec;
    }
    // 0xfc (stop): keep phase — resume continues the bar; clock stalls
    // out via the lastClockAt timeout in poll()
  }

  /**
   * poll(now): assemble the current frame. Iron rule 3 — every frame is
   * complete: decaying values decay here, held values are held here.
   */
  function poll(now) {
    const p = emptyParams('midi', now);
    for (const b of ['low', 'mid', 'high']) p.bands[b] = st.bands[b].value;
    onsetEnvelope(st.onset, false, 0, dt); // envelope decays every frame
    p.onset = st.onset.value;
    p.centroid = st.centroid;
    // stalled clock (device unplugged / transport stopped long ago)
    // stops being a beat source — protocol: no beat source → phase 0
    if (st.clockActive && now - st.lastClockAt > 2) st.clockActive = false;
    p.beatPhase = st.clockActive ? (st.ticks % 24) / 24 : 0;
    p.events = st.events;
    st.events = [];
    return p;
  }

  return { feed, poll };
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}
