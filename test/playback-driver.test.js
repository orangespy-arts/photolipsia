import { deepStrictEqual, ok } from 'node:assert';
import test from 'node:test';

import { createRecorder } from '../src/rec/record.js';
import { parseRecording } from '../src/rec/play.js';
import { createPlaybackDriver } from '../src/drivers/playback.js';
import { emptyParams } from '../src/protocol/params.js';

// build a 1s recording: low pulses at t=0 and t=0.5
function makeRecording() {
  const r = createRecorder();
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const p = emptyParams('mock', t);
    p.bands.low = t % 0.5 < 0.1 ? 0.8 : 0.1;
    r.add(p);
  }
  return parseRecording(r.toJSONL());
}

test('playback: wall clock maps to recording time, frames re-emitted', () => {
  const rec = makeRecording();
  const d = createPlaybackDriver(rec);
  d.start();
  const p = d.poll(10.0); // first poll anchors wall 10s → rec start
  deepStrictEqual(p.source, 'playback');
  ok(p.bands.low === rec.frames[0].bands.low);
  // 0.5s later we're at rec t=0.5 → pulse value
  const later = d.poll(10.5);
  ok(Math.abs(later.bands.low - rec.frames[30].bands.low) < 1e-9);
});

test('playback: t0 offset starts mid-recording', () => {
  const rec = makeRecording();
  const d = createPlaybackDriver(rec, { t0: 0.5 });
  d.start();
  const p = d.poll(0); // wall 0 → rec start + 0.5
  ok(Math.abs(p.bands.low - rec.frames[30].bands.low) < 1e-9);
});

test('playback: loops by default (past the end wraps to the start)', () => {
  const rec = makeRecording();
  const d = createPlaybackDriver(rec);
  d.start();
  d.poll(0); // anchor
  const p = d.poll(2.0); // 1s past the end of a 1s recording → wrapped
  const wrappedT = rec.start + ((2.0 - rec.start) % rec.duration);
  ok(Math.abs(p.bands.low - frameAtLo(rec, wrappedT)) < 1e-9);
});

test('playback: no-loop clamps to the last frame and holds', () => {
  const rec = makeRecording();
  const d = createPlaybackDriver(rec, { loop: false });
  d.start();
  d.poll(0);
  const p = d.poll(100);
  ok(Math.abs(p.bands.low - rec.frames[rec.frames.length - 1].bands.low) < 1e-9);
});

test('playback: recorded frames are not mutated (source stays mock on disk)', () => {
  const rec = makeRecording();
  const d = createPlaybackDriver(rec);
  d.start();
  d.poll(0);
  deepStrictEqual(rec.frames[0].source, 'mock');
});

// frameAt with a numeric fallback for compare
function frameAtLo(rec, t) {
  let best = rec.frames[0];
  for (const f of rec.frames) if (f.time <= t) best = f;
  return best.bands.low;
}
