#!/usr/bin/env node
/**
 * One-shot bridge smoke test: spawn the bridge, send one UDP OSC packet,
 * connect a raw WS client, assert the same bytes come back, exit 0/1.
 * Not part of npm test (needs ports); run manually: node scripts/smoke-osc-bridge.mjs
 */
import { spawn } from 'node:child_process';
import { createSocket } from 'node:dgram';
import { connect } from 'node:net';
import { createHash } from 'node:crypto';

const WS_PORT = 9231, UDP_PORT = 9232; // non-default ports to avoid collisions
const bridge = spawn(process.execPath, ['scripts/osc-bridge.mjs', '--udp', String(UDP_PORT), '--ws', String(WS_PORT)], { stdio: 'pipe' });
let failed = false;
const fail = (m) => { console.error('FAIL:', m); failed = true; };
const timeout = setTimeout(() => { fail('timeout'); finish(); }, 5000);

function finish() {
  clearTimeout(timeout);
  bridge.kill();
  process.exit(failed ? 1 : 0);
}

bridge.stdout.on('data', async (d) => {
  if (!String(d).includes(`ws listening on :${WS_PORT}`)) return;

  // 1. raw WS client: handshake then await one binary frame
  const sock = connect(WS_PORT, () => {
    const key = createHash('sha1').update(String(Math.random())).digest('base64');
    sock.write(`GET / HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
  });
  let handshaken = false;
  sock.on('data', (d) => {
    if (!handshaken) {
      if (!d.toString('latin1').includes('101 Switching Protocols')) { fail('no 101'); return finish(); }
      handshaken = true;
      // 2. UDP packet → should appear verbatim on the WS
      const udp = createSocket('udp4');
      // a real /av/rms message: "/av/rms" + NULs, ",f" + NULs, f32 0.5
      const pkt = Buffer.from('2f 61 76 2f 72 6d 73 00 2c 66 00 00 3f 00 00 00'.replaceAll(' ', ''), 'hex');
      udp.send(pkt, UDP_PORT, '127.0.0.1', () => udp.close());
    } else {
      // unmask a server binary frame: [0x82, len, payload...]
      const len = d[1] & 0x7f;
      const payload = d.subarray(2, 2 + len);
      const expected = Buffer.from('2f61762f726d73002c6600003f000000', 'hex');
      if (!payload.equals(expected)) fail(`payload mismatch: ${payload.toString('hex')}`);
      else console.log('OK: UDP packet relayed verbatim over WS');
      finish();
    }
  });
  sock.on('error', (e) => { fail(e.message); finish(); });
});
bridge.stderr.on('data', (d) => console.error('[bridge-err]', String(d)));
