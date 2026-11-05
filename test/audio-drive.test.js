import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleReactivity, audioEffectDrive, combineEffectDrive, formatClock,
  AUDIO_FEEDBACK_MAX, AUDIO_DISTORTION_MAX } from '../src/mapping/audioDrive.js';

const loud = { rms: 1, onset: 1, bands: { low: 1, mid: 0.5, high: 0.25 }, time: 3 };

test('reactivity scales bands/onset/rms, 0 is fully still, garbage clamps', () => {
  const half = scaleReactivity(loud, 0.5);
  assert.deepEqual(half.bands, { low: 0.5, mid: 0.25, high: 0.125 });
  assert.equal(half.onset, 0.5); assert.equal(half.time, 3);
  const still = scaleReactivity(loud, 0);
  assert.deepEqual([still.onset, still.rms, still.bands.low, still.bands.mid, still.bands.high], [0, 0, 0, 0, 0]);
  assert.equal(scaleReactivity({ ...loud, onset: NaN }, 2).onset, 0);
  assert.equal(scaleReactivity(loud, 7).bands.low, 1);
});

test('music drive: rms → capped feedback, onset → capped distortion', () => {
  assert.deepEqual(audioEffectDrive(loud, 1), { feedback: AUDIO_FEEDBACK_MAX, distortion: AUDIO_DISTORTION_MAX });
  assert.deepEqual(audioEffectDrive(loud, 0), { feedback: 0, distortion: 0 });
  assert.deepEqual(audioEffectDrive(null, 1), { feedback: 0, distortion: 0 });
  assert.ok(audioEffectDrive({ rms: 0.5, onset: 0 }, 1).feedback < AUDIO_FEEDBACK_MAX);
});

test('manual and music combine by max; B suppresses music; other fields untouched', () => {
  const state = { preset: 2, feedback: 0.9, distortion: 0, armed: true, reset: false };
  const mixed = combineEffectDrive(state, { feedback: 0.4, distortion: 0.7 });
  assert.equal(mixed.feedback, 0.9); assert.equal(mixed.distortion, 0.7); assert.equal(mixed.preset, 2);
  assert.equal(combineEffectDrive({ ...state, reset: true }, { feedback: 0.1, distortion: 0 }).reset, false);
  assert.equal(combineEffectDrive(state, { feedback: 1, distortion: 1 }, true), state);
  assert.equal(combineEffectDrive(state, null), state);
});

test('clock formats mm:ss and rejects non-finite', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(723.9), '12:03');
  assert.equal(formatClock(NaN), '--:--');
});
