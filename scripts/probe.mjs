#!/usr/bin/env node
/**
 * Headless probe: opens the app in headless Edge/Chrome via CDP, collects
 * console messages + runtime exceptions for N seconds, saves a screenshot.
 * Zero dependencies (Node 24 built-in WebSocket + fetch).
 *
 * Usage: node scripts/probe.mjs [url] [seconds]
 * Env:   BROWSER=path\to\msedge.exe (default: auto-locate)
 */
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';

const url = process.argv[2] ?? 'http://localhost:5175/?driver=mock';
const seconds = Number(process.argv[3] ?? 8);
const PORT = 9223;

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

// wait for the debug endpoint
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
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
    console.log(`[console.${msg.params.type}] ${text}`);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    console.log(`[EXCEPTION] ${d.exception?.description ?? d.text}`);
  } else if (msg.method === 'Log.entryAdded') {
    const e = msg.params.entry;
    console.log(`[${e.level}] ${e.source}: ${e.text} ${e.url ?? ''}`);
  }
};

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });

await sleep(seconds * 1000);

const shot = await send('Page.captureScreenshot', { format: 'png' });
await mkdir('.check', { recursive: true });
await writeFile('.check/probe.png', Buffer.from(shot.data, 'base64'));
console.log(`\nscreenshot → .check/probe.png`);

// read the app's own status line + ready flag
const evalRes = await send('Runtime.evaluate', {
  expression: `JSON.stringify({
    ready: window.__APP_READY__ ?? null,
    error: window.__APP_ERROR__ ?? null,
    status: document.getElementById('status')?.textContent ?? null,
    diag: window.__DIAG__ ?? null,
  })`,
  returnByValue: true,
});
console.log('app state:', evalRes.result.value);

ws.close();
proc.kill();
process.exit(0);
