#!/usr/bin/env node
/**
 * OSC test sender — scripts a 60Hz signal to the bridge for verifying the
 * osc driver end-to-end without Max/SC. 8s loop: RMS ramp up, centroid
 * sweep low→high, a 120bpm kick on /av/band/low + /av/onset.
 *
 * Usage: node scripts/osc-test-sender.mjs [--udp 9129] [--host 127.0.0.1]
 */
import { createSocket } from 'node:dgram';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && i + 1 < process.argv.length
    ? (name === 'host' ? process.argv[i + 1] : Number(process.argv[i + 1]))
    : def;
};
const PORT = arg('udp', 9129);
const HOST = arg('host', '127.0.0.1');

const udp = createSocket('udp4');

// OSC string: NUL-terminated, padded to 4
function str(s) {
  const b = Buffer.from(s, 'latin1');
  return Buffer.concat([b, Buffer.alloc(4 - (b.length % 4))]);
}
function f32(n) { const b = Buffer.alloc(4); b.writeFloatBE(n, 0); return b; }
function message(address, n) {
  return Buffer.concat([str(address), str(',f'), f32(n)]);
}
function bundle(msgs) {
  const size = Buffer.alloc(4);
  const head = Buffer.concat([str('#bundle'), Buffer.alloc(8)]); // timetag 0 = immediate
  const parts = msgs.map((m) => {
    size.writeUInt32BE(m.length, 0);
    return Buffer.concat([Buffer.from(size), m]);
  });
  return Buffer.concat([head, ...parts]);
}

let t = 0;
setInterval(() => {
  t += 1 / 60;
  const cyc = (t % 8) / 8;
  const beat = (t * 2) % 1;
  const kick = Math.exp(-beat * 6);
  const msgs = [
    message('/av/rms', 0.2 + 0.6 * cyc),
    message('/av/band/low', kick),
    message('/av/band/mid', 0.3 + 0.2 * Math.sin(t * 1.7)),
    message('/av/band/high', 0.25 + 0.1 * Math.sin(t * 9.3)),
    message('/av/centroid', cyc),
    message('/av/flatness', 0.15),
    message('/av/onset', Math.exp(-beat * 10)),
    message('/av/beat', beat),
  ];
  udp.send(bundle(msgs), PORT, HOST, (err) => { if (err) console.error(err.message); });
  if (t < 0.1 || Math.floor(t * 2) !== Math.floor((t - 1 / 60) * 2)) {
    console.log(`[test-sender] t=${t.toFixed(2)} rms=${(0.2 + 0.6 * cyc).toFixed(2)} kick=${kick.toFixed(2)}`);
  }
}, 1000 / 60);

console.log(`[test-sender] sending to udp:${HOST}:${PORT} at 60Hz — Ctrl+C to stop`);
