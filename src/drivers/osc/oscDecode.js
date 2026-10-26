/**
 * Minimal OSC 1.0 decoder — pure bytes in, plain objects out.
 * Zero dependencies, no DOM, unit-testable in Node.
 *
 * Supports what the protocol doc needs: messages with typetags
 * i (int32) f (float32) s (string) b (blob), and bundles (#bundle,
 * timetag parsed but IGNORED — we process immediately, no scheduling).
 * Strict 4-byte alignment everywhere. Malformed input throws
 * OscError (caller decides: drop the packet, never crash the loop).
 */

export class OscError extends Error {}

export function decodePacket(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new OscError('packet is not bytes');
  if (bytes.length === 0) throw new OscError('empty packet');
  return isBundle(bytes) ? decodeBundle(bytes) : [decodeMessage(bytes)];
}

function isBundle(b) {
  return b.length >= 8 && b[0] === 0x23 && b[1] === 0x62 && b[2] === 0x75 && b[3] === 0x6e; // "#bun"
}

function decodeMessage(b) {
  const st = { o: 0 };
  const address = readStringAt(b, st.o, st);
  if (!address.startsWith('/')) throw new OscError(`address must start with "/", got "${address}"`);
  const types = readStringAt(b, st.o, st);
  if (!types.startsWith(',')) throw new OscError(`missing typetags, got "${types}"`);
  const args = [];
  for (const t of types.slice(1)) {
    if (t === 'i') args.push(dv(b, st.o).getInt32(st.o, false)), st.o += 4;
    else if (t === 'f') args.push(dv(b, st.o).getFloat32(st.o, false)), st.o += 4;
    else if (t === 's') args.push(readStringAt(b, st.o, st));
    else if (t === 'b') {
      const len = dv(b, st.o).getInt32(st.o, false); st.o += 4;
      if (len < 0 || st.o + len > b.length) throw new OscError('blob length out of range');
      args.push(b.slice(st.o, st.o + len)); st.o += align4(len);
    } else throw new OscError(`unsupported typetag "${t}"`);
  }
  return { address, args };
}

function decodeBundle(b) {
  let o = 8; // past "#bundle"
  if (b.length < o + 8) throw new OscError('bundle without timetag');
  o += 8; // timetag — deliberately unread: we act immediately, no schedule
  const out = [];
  while (o < b.length) {
    if (o + 4 > b.length) throw new OscError('bundle element size truncated');
    const size = dv(b, o).getInt32(o, false); o += 4;
    if (size < 0 || o + size > b.length) throw new OscError('bundle element size out of range');
    const el = b.subarray(o, o + size); o += size;
    out.push(...(isBundle(el) ? decodeBundle(el) : [decodeMessage(el)]));
  }
  return out;
}

// zero-padded OSC string starting at offset o; returns the string,
// o is advanced past the terminator pad (via the mutable state object)
function readStringAt(b, o, st) {
  const end = b.indexOf(0, o);
  if (end < 0) throw new OscError('unterminated string');
  const s = new TextDecoder().decode(b.subarray(o, end));
  st.o = o + align4(end - o + 1);
  return s;
}

function align4(n) { return Math.ceil(n / 4) * 4; }
function dv(b, o) {
  if (o + 4 > b.length) throw new OscError('truncated argument');
  return new DataView(b.buffer, b.byteOffset, b.byteLength);
}
