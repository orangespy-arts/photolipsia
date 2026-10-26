import { deepStrictEqual, ok } from 'node:assert';
import test from 'node:test';

import { createRecorder, recordingName } from '../src/rec/record.js';
import { parseRecording, frameAt } from '../src/rec/play.js';
import { emptyParams } from '../src/protocol/params.js';

function frame(t, low = 0) {
  const p = emptyParams('mock', t);
  p.bands.low = low;
  return p;
}

test('record → parse round-trip preserves frames', () => {
  const r = createRecorder();
  r.add(frame(0.0, 0.1));
  r.add(frame(1 / 60, 0.5));
  r.add(frame(2 / 60, 0.9));
  const rec = parseRecording(r.toJSONL());
  deepStrictEqual(rec.frames.length, 3);
  ok(rec.badLines === 0);
  ok(Math.abs(rec.duration - 2 / 60) < 1e-9);
  deepStrictEqual(frameAt(rec, 1 / 60).bands.low, 0.5);
});

test('ring buffer: bounded memory, oldest frames fall off', () => {
  const r = createRecorder({ maxFrames: 10 });
  for (let i = 0; i < 25; i++) r.add(frame(i / 60, i / 25));
  deepStrictEqual(r.length, 10);
  ok(r.dropped === 15);
  const rec = parseRecording(r.toJSONL());
  deepStrictEqual(rec.frames[0].time, 15 / 60); // first 15 gone
  deepStrictEqual(rec.frames.length, 10);
});

test('exact-frame semantics: frameAt returns last frame with time ≤ t', () => {
  const r = createRecorder();
  r.add(frame(1.0, 0.2));
  r.add(frame(2.0, 0.8));
  const rec = parseRecording(r.toJSONL());
  ok(frameAt(rec, 1.5).bands.low === 0.2, 'between frames → earlier frame in effect');
  ok(frameAt(rec, 2.0).bands.low === 0.8, 'exact hit → that frame');
  ok(frameAt(rec, 99).bands.low === 0.8, 'past the end → last frame');
  ok(frameAt(rec, 0.5) === null, 'before the start → null');
});

test('garbage lines are skipped and counted, not fatal', () => {
  const text = [
    JSON.stringify(frame(0, 0.1)),
    'not json at all',
    '{"rms": "loud", "time": 1}',       // wrong types → sanitize errors
    JSON.stringify(frame(2, 0.3)),
    '',                                  // blank — not counted
  ].join('\n');
  const rec = parseRecording(text);
  deepStrictEqual(rec.frames.length, 2);
  deepStrictEqual(rec.badLines, 2);
  deepStrictEqual(rec.frames[1].bands.low, 0.3);
});

test('truncated last line (crash mid-write) loses only that line', () => {
  const r = createRecorder();
  r.add(frame(0, 0.2));
  r.add(frame(1, 0.4));
  const truncated = r.toJSONL() + '{"rms": 0.5, "ba'; // cut mid-frame
  const rec = parseRecording(truncated);
  deepStrictEqual(rec.frames.length, 2);
  deepStrictEqual(rec.badLines, 1);
});

test('malformed lines from an untrusted file are dropped whole (sanitize gate)', () => {
  // out-of-range values are sanitize ERRORS → the line is rejected
  // outright (stricter than clamping: a recording that failed validation
  // is suspect, drop the frame rather than repair it)
  const hostile = JSON.stringify({
    version: 1, rms: 5, bands: { low: -1, mid: 0.5, high: 0.5 },
    onset: 0, time: 3, source: 'mock',
  });
  const rec = parseRecording(hostile);
  deepStrictEqual(rec.frames.length, 0);
  deepStrictEqual(rec.badLines, 1);
  ok(frameAt(rec, 3) === null);
  // well-formed lines pass untouched
  const good = JSON.stringify({ ...emptyParams('mock', 1), rms: 0.7 });
  const rec2 = parseRecording(good);
  ok(frameAt(rec2, 1).rms === 0.7);
});

test('empty recording parses to something safe', () => {
  const rec = parseRecording('');
  deepStrictEqual(rec.frames.length, 0);
  deepStrictEqual(rec.duration, 0);
  ok(frameAt(rec, 0) === null);
});

test('recordingName: driver id + sortable timestamp', () => {
  const name = recordingName('mock', new Date(2026, 9, 26, 14, 5, 9).getTime());
  ok(name.startsWith('rec-mock-20261026-140509'));
  ok(name.endsWith('.jsonl'));
});
