import { deepStrictEqual, ok } from 'node:assert';
import test from 'node:test';

import { createMidiCore, CC_MAP } from '../src/drivers/midi/midiCore.js';

const DT = 1 / 60;

// frame helper: feed bytes, then poll, return the frame
function play(core, msgs, now) {
  for (const [bytes, at] of msgs) core.feed(bytes, at);
  return core.poll(now);
}

const noteOn = (pitch, vel, ch = 0) => [0x90 | ch, pitch, vel];
const noteOff = (pitch, ch = 0) => [0x80 | ch, pitch, 0];
const cc = (n, v, ch = 0) => [0xb0 | ch, n, v];
const bend = (l, h, ch = 0) => [0xe0 | ch, l, h];

test('note on → note event with normalized velocity + onset charge', () => {
  const core = createMidiCore();
  const p = play(core, [[noteOn(60, 100), 1.0]], 1.01);
  deepStrictEqual(p.events, [{ type: 'note', pitch: 60, velocity: 100 / 127, time: 1.0 }]);
  ok(p.onset > 0.7, `onset=${p.onset}`); // velocity 100/127 ≈ 0.79 charged
  deepStrictEqual(p.source, 'midi');
});

test('note off → velocity-0 event', () => {
  const core = createMidiCore();
  core.feed(noteOn(60, 100), 1.0);
  core.poll(1.01);
  const p = play(core, [[noteOff(60), 2.0]], 2.01);
  deepStrictEqual(p.events, [{ type: 'note', pitch: 60, velocity: 0, time: 2.0 }]);
});

test('note on with velocity 0 IS note off (MIDI spec)', () => {
  const core = createMidiCore();
  core.feed(noteOn(60, 100), 1.0);
  core.poll(1.01);
  const p = play(core, [[noteOn(60, 0), 2.0]], 2.01);
  deepStrictEqual(p.events, [{ type: 'note', pitch: 60, velocity: 0, time: 2.0 }]);
});

test('onset decays per poll call (driver polls at 60fps)', () => {
  const core = createMidiCore();
  core.feed(noteOn(60, 127), 1.0);
  const p1 = core.poll(1.01);
  const p2 = core.poll(1.02);
  const p3 = core.poll(1.03);
  ok(p1.onset > p2.onset && p2.onset > p3.onset, `${p1.onset} ${p2.onset} ${p3.onset}`);
  // after 3 frames (50ms), exp(-0.05/0.2) ≈ 0.78 of the charge remains
  ok(p3.onset < 0.8 && p3.onset > 0.7, `decay matches τ=0.2s: ${p3.onset}`);
});

test('events do not leak into the next frame (iron rule 3)', () => {
  const core = createMidiCore();
  core.feed(noteOn(60, 100), 1.0);
  core.poll(1.01);
  const p = core.poll(1.05);
  deepStrictEqual(p.events, []);
});

test('mod wheel (CC1) smooths into bands.mid', () => {
  const core = createMidiCore();
  // hold full mod wheel: follower attacks toward 1
  for (let i = 0; i < 30; i++) core.feed(cc(1, 127), i * DT);
  const p = core.poll(30 * DT);
  ok(p.bands.mid > 0.9, `mid=${p.bands.mid}`);
  ok(p.bands.low === 0 && p.bands.high === 0, 'only mid target moves');
});

test('sustain pedal (CC64) drives bands.high and releases on release', () => {
  const core = createMidiCore();
  for (let i = 0; i < 30; i++) core.feed(cc(64, 127), i * DT);
  const pressed = core.poll(0.5);
  ok(pressed.bands.high > 0.9);
  for (let i = 0; i < 30; i++) core.feed(cc(64, 0), 0.5 + i * DT);
  const released = core.poll(1.0);
  ok(released.bands.high < 0.3, `high after release=${released.bands.high}`);
});

test('brightness (CC74) maps to centroid directly (no smoothing)', () => {
  const core = createMidiCore();
  core.feed(cc(74, 100), 0);
  const p = core.poll(0.01);
  ok(Math.abs(p.centroid - 100 / 127) < 1e-9);
});

test('unknown CC is ignored', () => {
  const core = createMidiCore();
  core.feed(cc(7, 127), 0); // channel volume — deliberately unmapped
  const p = core.poll(0.01);
  deepStrictEqual(p.bands, { low: 0, mid: 0, high: 0 });
  ok(p.centroid === 0.5); // untouched neutral
});

test('pitch bend centers at 8192 → centroid 0.5, full up → 1.0', () => {
  const core = createMidiCore();
  core.feed(bend(0, 64), 0); // lsb=0 msb=64 → 8192 center
  ok(Math.abs(core.poll(0.01).centroid - 0.5) < 0.01);
  core.feed(bend(127, 127), 0.02); // full up
  ok(Math.abs(core.poll(0.03).centroid - 1) < 1e-6);
});

test('MIDI clock: 24 ticks per quarter → beatPhase advances 1/24 per tick', () => {
  const core = createMidiCore();
  for (let i = 0; i < 48; i++) core.feed([0xf8], i * DT);
  const p = core.poll(48 * DT);
  ok(Math.abs(p.beatPhase - (48 % 24) / 24) < 1e-9, `phase=${p.beatPhase}`);
});

test('clock start (0xFA) resets phase; stop keeps; stall (2s) kills phase', () => {
  const core = createMidiCore();
  for (let i = 0; i < 10; i++) core.feed([0xf8], i * DT);
  core.feed([0xfa], 0.2); // start
  ok(Math.abs(core.poll(0.21).beatPhase) < 1e-9, 'phase reset by start');
  for (let i = 0; i < 25; i++) core.feed([0xf8], 0.25 + i * DT);
  ok(Math.abs(core.poll(0.7).beatPhase - 1 / 24) < 1e-9, 'one tick past reset');
  // stall: no ticks for 2s
  const stalled = core.poll(3.0);
  deepStrictEqual(stalled.beatPhase, 0);
});

test('no clock ever → beatPhase stays 0 (protocol: no beat source)', () => {
  const core = createMidiCore();
  core.feed(noteOn(60, 100), 0);
  deepStrictEqual(core.poll(0.01).beatPhase, 0);
});

test('CC_MAP table is protocol-shaped (documented surface)', () => {
  deepStrictEqual(CC_MAP[1], 'mid');
  deepStrictEqual(CC_MAP[11], 'mid');
  deepStrictEqual(CC_MAP[64], 'high');
  deepStrictEqual(CC_MAP[74], 'centroid');
});

test('channel bits are ignored (same behavior on channel 9)', () => {
  const core = createMidiCore();
  const p = play(core, [[noteOn(60, 100, 9), 1.0]], 1.01);
  deepStrictEqual(p.events[0].pitch, 60);
  ok(p.onset > 0.7);
});
