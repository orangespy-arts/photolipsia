import { deepStrictEqual, ok, throws } from 'node:assert';
import test from 'node:test';

import { decodePacket, OscError } from '../src/drivers/osc/oscDecode.js';

// ── byte builders (mirroring what a real sender produces) ──
// OSC strings are NUL-terminated THEN padded to multiple of 4 — always
// at least one NUL byte (a 12-char address is sent as 16 bytes).
function str(s) {
  const b = new TextEncoder().encode(s);
  const pad = 4 - (b.length % 4);
  return Uint8Array.of(...b, ...new Array(pad).fill(0));
}
function f32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, n, false); return b; }
function i32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, n, false); return b; }
function msg(address, tags, ...args) {
  // flatten one level of Uint8Arrays into byte numbers (Array.flat does
  // NOT flatten typed arrays; spread-of-iterable into Uint8Array.of
  // would collapse each one to a single NaN element)
  const parts = args.map((a) => (a instanceof Uint8Array ? [...a] : a)).flat();
  return Uint8Array.of(...str(address), ...str(tags), ...parts);
}
function bundle(elements) {
  const header = Uint8Array.of(...str('#bundle'), ...new Array(8).fill(0)); // + timetag
  const parts = elements.map((el) => {
    const size = i32(el.length);
    return Uint8Array.of(...size, ...el);
  });
  const total = header.length + parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  out.set(header);
  let o = header.length;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

test('message: /av/band/low with one float', () => {
  const [m] = decodePacket(msg('/av/band/low', ',f', f32(0.75)));
  deepStrictEqual(m, { address: '/av/band/low', args: [0.75] });
});

test('message: multiple args sff (the /av/event shape)', () => {
  const [m] = decodePacket(msg('/av/event', ',sff', str('note'), f32(60), f32(0.8)));
  deepStrictEqual(m.address, '/av/event');
  ok(m.args[0] === 'note');
  ok(Math.abs(m.args[1] - 60) < 1e-4, `int-through-f32: ${m.args[1]}`); // f32, not exact
  ok(Math.abs(m.args[2] - 0.8) < 1e-6);
});

test('message: int typetag decodes as integer', () => {
  const [m] = decodePacket(msg('/x', ',i', i32(-3)));
  deepStrictEqual(m.args, [-3]);
});

test('message: blob argument', () => {
  // blob content 3 bytes declared; the trailing 0 is 4-alignment pad,
  // NOT content — decoder must slice to the declared length
  const [m] = decodePacket(msg('/x', ',b', i32(3), Uint8Array.of(1, 2, 3, 0)));
  ok(m.args[0] instanceof Uint8Array);
  deepStrictEqual([...m.args[0]], [1, 2, 3]);
});

test('message: address padding with inner NULs handles 4-alignment', () => {
  // "/av" (3 chars) + pad → 4 bytes; ",f" (2 chars) + pad → 4 bytes
  const [m] = decodePacket(msg('/av', ',f', f32(1)));
  deepStrictEqual(m.address, '/av');
  deepStrictEqual(m.args, [1]);
});

test('bundle: two messages decode in order', () => {
  const b = bundle([
    msg('/av/rms', ',f', f32(0.5)),
    msg('/av/onset', ',f', f32(0.9)),
  ]);
  const ms = decodePacket(b);
  deepStrictEqual(ms.map((m) => m.address), ['/av/rms', '/av/onset']);
  ok(Math.abs(ms[1].args[0] - 0.9) < 1e-6);
});

test('bundle: nested bundle flattens', () => {
  const inner = bundle([msg('/av/rms', ',f', f32(0.25))]);
  const outer = bundle([msg('/av/beat', ',f', f32(0.5)), inner]);
  const ms = decodePacket(outer);
  deepStrictEqual(ms.map((m) => m.address), ['/av/beat', '/av/rms']);
});

test('malformed: not an OSC address → OscError, not a crash', () => {
  throws(() => decodePacket(Uint8Array.of(1, 2, 3, 4)), OscError);
  throws(() => decodePacket(new Uint8Array(0)), OscError);
});

test('malformed: missing typetags → OscError', () => {
  const bad = Uint8Array.of(...str('/no/tags'));
  throws(() => decodePacket(bad), OscError);
});

test('malformed: truncated float → OscError', () => {
  const bad = Uint8Array.of(...str('/x'), ...str(',f'), 0x3f, 0x80);
  throws(() => decodePacket(bad), OscError);
});

test('malformed: unsupported typetag → OscError (never silently wrong)', () => {
  const bad = msg('/x', ',h', i32(1), i32(2)); // 'h' = int64, unsupported
  throws(() => decodePacket(bad), OscError);
});

test('real packet: exactly what the protocol doc table sends', () => {
  // /av/centroid f 0.42 — the whole table is this shape
  const [m] = decodePacket(msg('/av/centroid', ',f', f32(0.42)));
  ok(Math.abs(m.args[0] - 0.42) < 1e-6);
});
