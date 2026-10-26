/**
 * MIDI simulator — a scripted "performance" feeding raw MIDI bytes into
 * the driver exactly like a real device would. Purpose: full-chain
 * verification (bytes → midiCore → protocol → render) without hardware,
 * and a repeatable visual tuning signal.
 *
 * 8s loop at 120 BPM:
 *  - kick pattern: C2 on every quarter, velocity alternating 100/64
 *  - hi-hat pattern: F#3 on every eighth, velocity 30
 *  - mod wheel (CC1) slow sine 0→127→0
 *  - brightness (CC74) slow sweep
 *  - MIDI clock 24 ticks/quarter at 120 BPM + start byte at t=0
 */
import { emptyParams } from '../../protocol/params.js';

export function createMidiSimulator({ bpm = 120 } = {}) {
  const secPerBeat = 60 / bpm;
  const tickEvery = secPerBeat / 24; // MIDI clock interval
  let t = 0;
  let sentUntil = 0; // schedule cursor (s)
  let transportSent = false;

  /**
   * Anchor the schedule: events are generated relative to `t0` so a page
   * that loads at wall-clock 5s doesn't burst-replay 0..5s of script.
   */
  function anchor(t0) {
    sentUntil = t0;
    offset = t0;
    transportSent = true; // already "sent" conceptually; real start byte
    // is emitted at the anchor point below
    pendingStart = t0;
  }

  let offset = 0;
  let pendingStart = null;

  /**
   * Produce all MIDI messages between lastPoll and now (s), script-time.
   * Returns [{ bytes, atSec }] with atSec shifted to wall clock.
   */
  function generate(until) {
    const from = sentUntil - offset; // script time
    const to = until - offset;
    const out = [];
    if (pendingStart != null) {
      out.push({ bytes: [0xfa], atSec: pendingStart });
      pendingStart = null;
    }
    // half-open windows [from, to): a boundary instant is emitted exactly
    // once, by the window that starts there — never duplicated
    const ticksIn = (step) => Math.max(0, Math.ceil(from / step - 1e-9));
    // MIDI clock ticks
    for (let i = ticksIn(tickEvery); i * tickEvery < to; i++) {
      out.push({ bytes: [0xf8], atSec: offset + i * tickEvery });
    }
    // kick: every quarter
    for (let i = ticksIn(secPerBeat); i * secPerBeat < to; i++) {
      const v = i % 2 === 0 ? 100 : 64;
      out.push({ bytes: [0x90, 36, v], atSec: offset + i * secPerBeat });
      out.push({ bytes: [0x80, 36, 0], atSec: offset + i * secPerBeat + 0.1 });
    }
    // hi-hats: every eighth
    for (let i = ticksIn(secPerBeat / 2); i * (secPerBeat / 2) < to; i++) {
      out.push({ bytes: [0x90, 54, 30], atSec: offset + i * secPerBeat / 2 });
      out.push({ bytes: [0x80, 54, 0], atSec: offset + i * secPerBeat / 2 + 0.05 });
    }
    // CC sweeps: 60Hz control stream
    for (let i = ticksIn(1 / 60); i / 60 < to; i++) {
      const tI = i / 60;
      const cyc = (tI % 8) / 8;
      out.push({ bytes: [0xb0, 1, Math.round(127 * (0.5 + 0.5 * Math.sin(tI * 2 * Math.PI / 8)))], atSec: offset + tI });
      out.push({ bytes: [0xb0, 74, Math.round(127 * cyc)], atSec: offset + tI });
    }
    sentUntil = until;
    t = until;
    return out;
  }

  return { generate, anchor };
}
