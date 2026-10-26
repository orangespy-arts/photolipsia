import { ok } from 'node:assert';
import test from 'node:test';

import { createBeatTracker, beatUpdate, beatPhase } from '../src/drivers/webaudio/beat.js';

const DT = 1 / 60;

// feed a synthetic onset train: hits every `period` s for `beats` beats
function feed(st, period, beats = 12, { jitter = 0, start = 0 } = {}) {
  for (let i = 0; i < beats; i++) {
    const t = start + i * period + (jitter ? (Math.sin(i * 7.3) * jitter) : 0);
    beatUpdate(st, t, true);
  }
}

test('steady 120 BPM onsets lock a grid and drive the phase', () => {
  const st = createBeatTracker();
  const P = 0.5;
  feed(st, P);
  ok(st.period != null, `should lock, score=${st.score}`);
  ok(st.score > 0.5, `score=${st.score}`);
  // right at the next expected hit: phase ≈ 0, confidence high
  const now = st.onsets[st.onsets.length - 1] + P;
  const { phase, confidence } = beatPhase(st, now);
  ok(phase < 0.1 || phase > 0.9, `phase at beat=${phase}`);
  ok(confidence > 0.5, `confidence=${confidence}`);
});

test('mid-beat phase is mid-range (0.25 period after a hit ≈ 0.25)', () => {
  const st = createBeatTracker();
  feed(st, 0.5);
  const last = st.onsets[st.onsets.length - 1];
  const { phase } = beatPhase(st, last + 0.125);
  ok(Math.abs(phase - 0.25) < 0.05, `phase=${phase}`);
});

test('speech-like irregular onsets never lock (confidence stays 0)', () => {
  const st = createBeatTracker();
  // syllable-ish: random-ish gaps 0.1–1.4s
  let t = 0;
  for (let i = 0; i < 30; i++) {
    t += 0.1 + Math.abs(Math.sin(i * 12.9) * 43758.5453 % 1) * 1.3;
    beatUpdate(st, t, true);
  }
  ok(st.period == null || st.score < 0.5, `should not lock: period=${st.period} score=${st.score}`);
  ok(beatPhase(st, t).confidence < 0.1, 'confidence near zero');
});

test('confidence decays after onsets stop (missed beats)', () => {
  const st = createBeatTracker();
  feed(st, 0.5);
  const last = st.onsets[st.onsets.length - 1];
  ok(beatPhase(st, last + 0.1).confidence > 0.5);
  ok(beatPhase(st, last + 2.5).confidence === 0, '4 missed beats → 0');
});

test('no onsets at all → phase 0, confidence 0', () => {
  const st = createBeatTracker();
  const { phase, confidence } = beatPhase(st, 10);
  ok(phase === 0 && confidence === 0);
});

test('beatUpdate ignores non-triggered frames', () => {
  const st = createBeatTracker();
  beatUpdate(st, 1.0, true);
  beatUpdate(st, 1.1, false);
  beatUpdate(st, 1.2, false);
  ok(st.onsets.length === 1);
});

test('doubled tempo (onsets on eighths) still locks a usable grid', () => {
  const st = createBeatTracker();
  feed(st, 0.25); // eighth notes of a 120 BPM beat
  ok(st.period != null, 'should lock');
  // eighths align perfectly to both the 0.25 and the 0.5 grid; whichever
  // locks, an onset must land ON a grid line (phase ≈ 0 or ≈ 0.5)
  const { phase, confidence } = beatPhase(st, st.onsets[st.onsets.length - 1] + 0.25);
  const offGrid = Math.min(phase, 0.5 - phase, phase - 0.5 < 0 ? phase : 1 - phase);
  ok(offGrid < 0.15 && confidence > 0.4, `phase=${phase} conf=${confidence}`);
});

test('slight human jitter stays locked', () => {
  const st = createBeatTracker();
  feed(st, 0.5, 14, { jitter: 0.02 });
  ok(st.score > 0.5, `score=${st.score}`);
  ok(st.period != null && Math.abs(st.period - 0.5) < 0.05, `period=${st.period}`);
});
