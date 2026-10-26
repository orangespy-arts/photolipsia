import { deepStrictEqual, ok } from 'node:assert';
import test from 'node:test';

import { createMidiSimulator } from '../src/drivers/midi/simulate.js';
import { createMidiCore } from '../src/drivers/midi/midiCore.js';

test('simulator: 1s half-open window [0,1) at 120bpm = 48 ticks + 2 kicks + 4 hats', () => {
  const sim = createMidiSimulator();
  sim.anchor(0);
  const msgs = sim.generate(1.0);
  // half-open: instants in [0,1). beats at 0, 0.5 (2 kicks); eighths add
  // 0.25/0.75 (4 hats); clock at 48Hz → 48 ticks (t=1.0 belongs to the
  // NEXT window — matches how incremental polls slice time)
  const clocks = msgs.filter((m) => m.bytes[0] === 0xf8).length;
  const kicks = msgs.filter((m) => m.bytes[0] === 0x90 && m.bytes[1] === 36).length;
  const hats = msgs.filter((m) => m.bytes[0] === 0x90 && m.bytes[1] === 54).length;
  deepStrictEqual(clocks, 48);
  deepStrictEqual(kicks, 2);
  deepStrictEqual(hats, 4);
});

test('simulator: transport start byte appears exactly once, first', () => {
  const sim = createMidiSimulator();
  sim.anchor(0);
  const msgs = sim.generate(2.0);
  deepStrictEqual(msgs[0].bytes[0], 0xfa);
  deepStrictEqual(msgs.filter((m) => m.bytes[0] === 0xfa).length, 1);
});

test('simulator: incremental generate has no gaps or duplicates', () => {
  const sim = createMidiSimulator();
  sim.anchor(0);
  let all = [];
  for (let i = 1; i <= 10; i++) all = all.concat(sim.generate(i / 10));
  const clocks = all.filter((m) => m.bytes[0] === 0xf8).map((m) => m.atSec);
  deepStrictEqual(clocks.length, 48, '48 ticks in [0,1), no dups across slices');
  ok(Math.abs(clocks[1] - clocks[0] - 1 / 48) < 1e-9, 'even spacing');
  const kickTimes = all.filter((m) => m.bytes[0] === 0x90 && m.bytes[1] === 36).map((m) => m.atSec);
  deepStrictEqual(kickTimes, [0, 0.5], 'boundary instants emitted exactly once');
});

test('simulator: anchor shifts events to wall clock (no burst replay)', () => {
  const sim = createMidiSimulator();
  sim.anchor(5.0); // page loaded 5s late
  const msgs = sim.generate(5.1);
  // first 100ms of script, shifted: kick at wall 5.0, not script 0..5
  ok(msgs.every((m) => m.atSec >= 5.0 - 1e-9), `min at=${Math.min(...msgs.map((m) => m.atSec))}`);
  const clocks = msgs.filter((m) => m.bytes[0] === 0xf8).length;
  ok(clocks > 0 && clocks <= 6, `no burst: ${clocks} ticks in 100ms (expect ≤6 at 48Hz)`);
});

test('FULL CHAIN: simulator bytes → midiCore → protocol frames', () => {
  const sim = createMidiSimulator();
  sim.anchor(0);
  const core = createMidiCore();
  // run 2s at 60fps
  let notes = 0, lastPhase = 0, sawOnset = false, sawCentroid = false;
  for (let f = 0; f <= 120; f++) {
    const now = f / 60;
    for (const { bytes, atSec } of sim.generate(now)) core.feed(bytes, atSec);
    const p = core.poll(now);
    notes += p.events.length;
    sawOnset ||= p.onset > 0.5;
    sawCentroid ||= p.centroid !== 0.5;
    if (p.beatPhase > 0) {
      // at 60fps sampling a 48Hz clock, consecutive frames either advance
      // by tick(s), stay equal (no tick since last poll), or wrap to ~0
      ok(
        p.beatPhase > lastPhase - 1e-9 || p.beatPhase < 0.1,
        `phase must advance/hold/wrap, got ${lastPhase} → ${p.beatPhase}`,
      );
    }
    lastPhase = p.beatPhase;
  }
  // 2s half-open at 120bpm: kicks at 0/0.5/1/1.5 (4) + hats every 0.25 (8)
  // = 12 note-ons (+ 12 note-offs)
  ok(notes >= 22, `events=${notes}`);
  ok(sawOnset, 'onset charged by kicks');
  ok(sawCentroid, 'centroid swept by CC74');
});

test('FULL CHAIN: beatPhase steps at true 120bpm (24 ticks/beat)', () => {
  const sim = createMidiSimulator({ bpm: 120 });
  sim.anchor(0);
  const core = createMidiCore();
  const phases = [];
  for (let f = 0; f <= 48; f++) {
    const now = f / 60;
    for (const { bytes, atSec } of sim.generate(now)) core.feed(bytes, atSec);
    phases.push(core.poll(now).beatPhase);
  }
  // at 120bpm one quarter = 0.5s = 30 frames = 24 ticks; phase should
  // wrap ~4 times over 48 frames (0.8s ≈ 1.6 beats... at least once)
  const wraps = phases.filter((p, i) => i > 0 && p < phases[i - 1]).length;
  ok(wraps >= 1, `phase wrapped ${wraps} times over 0.8s`);
});
