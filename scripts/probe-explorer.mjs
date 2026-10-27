#!/usr/bin/env node
/**
 * Explorer E2E probe: opens ?play=1, reads ball position + camera, holds
 * ArrowUp via CDP key events for N seconds, reads again, screenshots before
 * and after. Verifies: ball moved, camera followed, keydown listeners work
 * through the real input path.
 *
 * Usage: node scripts/probe-explorer.mjs [url] [holdSeconds]
 * Screenshot → .check/explorer-before.png / .check/explorer-after.png
 */
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';

const url = process.argv[2] ?? 'http://localhost:5175/?driver=mock&kind=silence&splat=/splats/ruin1.ply&play=1';
const holdSeconds = Number(process.argv[3] ?? 3);
const PORT = 9224;

const CANDIDATES = [
  process.env.BROWSER,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

const { spawnSync } = await import('node:child_process');
const browserPath = CANDIDATES.find((p) => {
  const r = spawnSync(p, ['--version'], { timeout: 5000, stdio: 'ignore' });
  return r.status === 0;
});
if (!browserPath) { console.error('no Edge/Chrome found'); process.exit(1); }

const proc = spawn(browserPath, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--window-size=1280,800',
  '--no-first-run', '--no-default-browser-check',
  'about:blank',
], { stdio: 'ignore' });
process.on('exit', () => { try { proc.kill(); } catch {} });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets = null;
for (let i = 0; i < 40; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    targets = await res.json();
    if (targets.length) break;
  } catch {}
  await sleep(250);
}
if (!targets) { console.error('debug endpoint never came up'); process.exit(1); }
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

let id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const msgId = ++id;
  pending.set(msgId, { resolve, reject });
  ws.send(JSON.stringify({ id: msgId, method, params }));
});
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    return;
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    console.log(`[EXCEPTION] ${d.exception?.description ?? d.text}`);
  } else if (msg.method === 'Log.entryAdded') {
    const e = msg.params.entry;
    if (e.level === 'error') console.log(`[error] ${e.source}: ${e.text}`);
  }
};

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(3000);

// read the explorer's own state via the __EXPLORER__ hook main.js installs
const readState = async () => {
  const res = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      error: window.__APP_ERROR__ ?? null,
      status: document.getElementById('status')?.textContent ?? null,
      diag: window.__DIAG__ ?? null,
      explorer: window.__EXPLORER__ ?? null,
    })`,
    returnByValue: true,
  });
  return JSON.parse(res.result.value);
};
const key = (code, type) => send('Input.dispatchKeyEvent', {
  type,
  code,
  key: code,
  windowsVirtualKeyCode: code.startsWith('Arrow') ? {
    ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39,
  }[code] : 0,
  nativeVirtualKeyCode: 0,
});

await sleep(2000); // let seeds initialize too

const before = await readState();
const shot1 = await send('Page.captureScreenshot', { format: 'png' });
await mkdir('.check', { recursive: true });
await writeFile('.check/explorer-before.png', Buffer.from(shot1.data, 'base64'));

// hold ArrowUp via the real CDP input path (keyboard goes to the page)
for (let i = 0; i < holdSeconds * 10; i++) {
  await key('ArrowUp', 'keyDown');
  await sleep(80);
}
await key('ArrowUp', 'keyUp');

const after = await readState();
const shot2 = await send('Page.captureScreenshot', { format: 'png' });
await writeFile('.check/explorer-after.png', Buffer.from(shot2.data, 'base64'));

const camA = before.diag?.camPos, camB = after.diag?.camPos;
const moved = camA && camB ? Math.hypot(camB[0] - camA[0], camB[2] - camA[2]) : 0;
console.log('before camPos:', camA?.map((v) => v.toFixed(2)).join(', '));
console.log('after  camPos:', camB?.map((v) => v.toFixed(2)).join(', '));
console.log(`planar camera travel: ${moved.toFixed(2)}m over ${holdSeconds}s hold`);
if (before.explorer && after.explorer) {
  const pe = before.explorer.pos, ae = after.explorer.pos;
  console.log(`ball pos before: (${pe.map((v) => v.toFixed(2)).join(', ')}) after: (${ae.map((v) => v.toFixed(2)).join(', ')})`);
  console.log(`seedsReady: ${after.explorer.seedsReady}  grown: ${before.explorer.grown} → ${after.explorer.grown}  coverage: ${after.explorer.coverage.toFixed(4)}`);
} else {
  console.log('explorer hook missing (splat not ready?)');
}
console.log(`status: "${after.status}"  error: ${after.error ?? 'none'}`);
const grownDelta = after.explorer && before.explorer ? after.explorer.grown - before.explorer.grown : 0;
console.log(moved > 1 && grownDelta > 0 ? 'PASS — ball moved and seeds bloomed' : 'FAIL');

ws.close();
proc.kill();
process.exit(moved > 1 ? 0 : 1);
