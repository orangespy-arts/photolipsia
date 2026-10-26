import { deepStrictEqual, ok } from 'node:assert';
import test from 'node:test';

import { createOscFrameAssembler } from '../src/drivers/osc/oscMap.js';
import { decodePacket } from '../src/drivers/osc/oscDecode.js';

// helper: decode bytes and feed whatever came out
function feed(assembler, bytes, now = 0) {
  for (const m of decodePacket(bytes)) assembler.feed(m, now);
}

test('one 60Hz cycle of messages assembles into a full frame', () => {
  const asm = createOscFrameAssembler();
  feed(asm, bytes('/av/rms', 0.5), 12.3);
  feed(asm, bytes('/av/band/low', 0.9));
  feed(asm, bytes('/av/band/mid', 0.4));
  feed(asm, bytes('/av/band/high', 0.1));
  feed(asm, bytes('/av/centroid', 0.42));
  feed(asm, bytes('/av/flatness', 0.2));
  feed(asm, bytes('/av/onset', 0.8));
  feed(asm, bytes('/av/beat', 0.25));
  const { params } = asm.takeFrame(12.3);
  ok(Math.abs(params.rms - 0.5) < 1e-6);
  ok(Math.abs(params.bands.low - 0.9) < 1e-6, `low=${params.bands.low}`);
  ok(Math.abs(params.bands.mid - 0.4) < 1e-6);
  ok(Math.abs(params.bands.high - 0.1) < 1e-6);
  ok(Math.abs(params.centroid - 0.42) < 1e-6);
  ok(Math.abs(params.flatness - 0.2) < 1e-6);
  ok(Math.abs(params.onset - 0.8) < 1e-6);
  ok(Math.abs(params.beatPhase - 0.25) < 1e-6);
  deepStrictEqual(params.source, 'osc');
  ok(Math.abs(params.time - 12.3) < 1e-9);
});

test('/av/event sff becomes a protocol event', () => {
  const asm = createOscFrameAssembler();
  asm.feed({ address: '/av/event', args: ['note', 60, 0.8] });
  const { params } = asm.takeFrame();
  deepStrictEqual(params.events, [{ type: 'note', value1: 60, value2: 0.8 }]);
});

test('unknown addresses are ignored (forward compat)', () => {
  const asm = createOscFrameAssembler();
  asm.feed({ address: '/av/future_thing', args: [1, 2, 3] });
  asm.feed({ address: '/unrelated', args: ['x'] });
  const { params, errors } = asm.takeFrame();
  deepStrictEqual(params.rms, 0);
  deepStrictEqual(errors, []);
});

test('out-of-range values get clamped by sanitize (untrusted ingress)', () => {
  const asm = createOscFrameAssembler();
  asm.feed({ address: '/av/rms', args: [7] });
  asm.feed({ address: '/av/band/low', args: [-2] });
  const { params, errors } = asm.takeFrame();
  deepStrictEqual(params.rms, 1);
  deepStrictEqual(params.bands.low, 0);
  ok(errors.length >= 2);
});

test('non-numeric args to numeric addresses are dropped, frame still valid', () => {
  const asm = createOscFrameAssembler();
  asm.feed({ address: '/av/rms', args: ['loud'] });
  const { params } = asm.takeFrame();
  deepStrictEqual(params.rms, 0);
});

test('assembler resets after takeFrame (next cycle starts clean)', () => {
  const asm = createOscFrameAssembler();
  asm.feed({ address: '/av/rms', args: [0.9] });
  asm.takeFrame(1);
  const { params } = asm.takeFrame(2);
  deepStrictEqual(params.rms, 0, 'stale rms must not leak into the next frame');
});

test('fields absent this cycle fall back to 0 (silence, not stuck values)', () => {
  const asm = createOscFrameAssembler();
  asm.feed({ address: '/av/rms', args: [0.9] });
  asm.takeFrame(1);
  asm.feed({ address: '/av/onset', args: [0.5] }); // sender stopped sending rms
  const { params } = asm.takeFrame(2);
  deepStrictEqual(params.rms, 0);
  ok(Math.abs(params.onset - 0.5) < 1e-6);
});

// tiny byte builder (dup of decode-test helpers, kept local for clarity)
function bytes(address, n) {
  const enc = new TextEncoder();
  const s = (t) => { const b = enc.encode(t); const p = 4 - (b.length % 4); return [...b, ...new Array(p).fill(0)]; };
  const f = (v) => { const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, v, false); return [...b]; };
  return Uint8Array.of(...s(address), ...s(',f'), ...f(n));
}
