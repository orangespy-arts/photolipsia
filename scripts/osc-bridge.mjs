#!/usr/bin/env node
/**
 * OSC bridge — dumb UDP→WebSocket relay. Understands nothing.
 *
 *   Max/SC/PD --UDP:9129--> [this bridge] --WS:9128--> browser osc driver
 *
 * Every UDP packet is forwarded verbatim to all connected WS clients as a
 * binary frame. No OSC parsing here — the browser driver decodes (see
 * src/drivers/osc/oscDecode.js). This keeps the bridge replaceable and
 * the protocol doc the only contract.
 *
 * Usage: node scripts/osc-bridge.mjs [--udp 9129] [--ws 9128]
 *
 * Zero dependencies. The WebSocket server is a minimal RFC6455 subset:
 * handshake, binary frames client→bridge (read+discarded), ping/pong.
 */
import { createSocket } from 'node:dgram';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';

// ── args ──
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && i + 1 < process.argv.length ? Number(process.argv[i + 1]) : def;
};
const UDP_PORT = arg('udp', 9129);
const WS_PORT = arg('ws', 9128);

// ── WebSocket server (minimal RFC6455) ──
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const clients = new Set();

const wsServer = createServer((socket) => {
  socket.once('data', function onFirst(buf) {
    const req = buf.toString('latin1');
    const key = /^Sec-WebSocket-Key:\s*(\S+)/im.exec(req)?.[1];
    if (!key || !/upgrade:\s*websocket/im.test(req)) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }
    const accept = createHash('sha1').update(key + GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
    clients.add(socket);
    log(`client connected (${clients.size} total)`);
    // subsequent frames: read and discard (bridge is one-way). Any close
    // or error drops the client; the browser driver reconnects itself.
    socket.on('data', () => {});
    socket.on('close', () => { clients.delete(socket); log(`client left (${clients.size} total)`); });
    socket.on('error', () => { clients.delete(socket); socket.destroy(); });
    // respond to pings so the browser keeps the connection healthy
    socket.on('data', (d) => {
      if (d.length >= 2 && (d[0] & 0x0f) === 0x9) socket.write(frame(0x8a, d.subarray(2, 2 + (d[1] & 0x7f))));
    });
  });
});

// build one unmasked server frame (FIN + opcode, len 7/16/64-bit)
function frame(opcode, payload) {
  const len = payload.length;
  const head = len < 126 ? Buffer.from([opcode, len])
    : len < 65536 ? Buffer.from([opcode, 126, len >> 8, len & 0xff])
    : Buffer.from([opcode, 127, ...Array.from({ length: 8 }, (_, i) => (len / 256 ** (7 - i)) & 0xff)]);
  return Buffer.concat([head, payload]);
}

function broadcast(data) {
  const pkt = frame(0x82, data); // FIN + binary
  for (const c of clients) c.write(pkt);
}

// ── UDP listener ──
const udp = createSocket('udp4');
udp.on('message', (msg, rinfo) => {
  log(`udp ${msg.length}B from ${rinfo.address}:${rinfo.port} → ${clients.size} ws client(s)`);
  broadcast(msg);
});
udp.on('error', (err) => { console.error('udp error:', err.message); });

wsServer.listen(WS_PORT, () => log(`ws listening on :${WS_PORT}`));
udp.bind(UDP_PORT, () => log(`udp listening on :${UDP_PORT}`));

function log(s) { console.log(`[osc-bridge] ${s}`); }
