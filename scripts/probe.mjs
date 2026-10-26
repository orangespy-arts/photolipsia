#!/usr/bin/env node
/**
 * Headless probe: opens the app in headless Edge/Chrome via CDP, collects
 * console messages + runtime exceptions for N seconds, saves a screenshot.
 * Zero dependencies (Node 24 built-in WebSocket + fetch).
 *
 * Usage: node scripts/probe.mjs [url] [seconds] [--fps]
 *   --fps  run a 300-frame rAF timing audit instead of a screenshot:
 *          frame-time p50/p95/max + fps, printed as a table
 * Env:   BROWSER=path\to\msedge.exe (default: auto-locate)
 */
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';

const url = process.argv[2] ?? 'http://localhost:5175/?driver=mock';
const seconds = Number(process.argv[3] ?? 8);
const fpsAudit = process.argv.includes('--fps');
const latencyAudit = process.argv.includes('--latency');
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
    if (text.includes('FRAGMENT') || text.includes('VERTEX')) {
      // three.js logs shader source after the error marker — keep it visible
      setTimeout(() => {}, 0);
    }
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
await sleep(2500);

if (latencyAudit) {
  // audio→visual latency audit on the mock driver: mock's onset decays
  // from 1.0 at each beat (0.5s apart). We track (a) the protocol onset
  // value the page sees (via a hook into monitor updates) with rAF
  // timestamps, and (b) when the canvas pixels actually respond, by
  // sampling a strip of canvas pixels each frame. The gap between the
  // protocol onset jump and the pixel response is the render-side
  // latency (driver→uniform→GPU→screen); driver-side audio latency is
  // documented separately in docs/rehearsal.md.
  const res = await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const frames = [];
        const canvas = document.getElementById('stage');
        const probeCtx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        function tick(t) {
          frames.push({ t, onset: window.__LAST_ONSET__ ?? -1,
            bright: sampleBrightness(canvas, probeCtx) });
          if (frames.length < 240) requestAnimationFrame(tick);
          else resolve(JSON.stringify(frames));
        }
        function sampleBrightness(c, ctx) {
          try {
            ctx.drawImage(c, 0, 0, 64, 64);
            const d = ctx.getImageData(0, 0, 64, 64).data;
            let s = 0; for (let i = 0; i < d.length; i += 16) s += d[i] + d[i+1] + d[i+2];
            return s;
          } catch { return -1; }
        }
        requestAnimationFrame(tick);
      })
    `,
    awaitPromise: true,
    returnByValue: true,
  });
  // hook: main.js stores the last frame's onset for this audit
  const frames = JSON.parse(res.result.value).filter((f) => f.bright >= 0);
  if (frames.length < 100) {
    console.log('FAIL — canvas unreadable (tainted or not rendering)');
  } else {
    // find onset jumps (protocol) and the bright-response they cause
    let samples = [];
    for (let i = 1; i < frames.length; i++) {
      const jump = frames[i].onset - frames[i - 1].onset;
      if (jump > 0.3) {
        // search forward for a brightness rise > noise
        const base = frames[i].bright;
        for (let j = i; j < Math.min(i + 30, frames.length); j++) {
          if (frames[j].bright > base * 1.02) { samples.push(frames[j].t - frames[i].t); break; }
        }
      }
    }
    samples = samples.filter((x) => x < 500); // sane window only
    if (samples.length === 0) {
      console.log('latency: no onset→pixel response detected — check brightness threshold');
    } else {
      const mean = samples.reduce((s, x) => s + x, 0) / samples.length;
      console.log('── audio(protocol)→pixel latency (mock, n=' + samples.length + ') ──');
      console.log(`mean ${mean.toFixed(1)}ms  min ${Math.min(...samples).toFixed(1)}ms  max ${Math.max(...samples).toFixed(1)}ms`);
    }
  }
  ws.close();
  proc.kill();
  process.exit(0);
}

if (fpsAudit) {
  // 300-frame rAF timing audit — the frame loop is already running on the
  // page; we just record rAF timestamps via a temporary observer hook
  const res = await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const stamps = [];
        function tick(t) {
          stamps.push(t);
          if (stamps.length < 300) requestAnimationFrame(tick);
          else resolve(JSON.stringify(stamps));
        }
        requestAnimationFrame(tick);
      })
    `,
    awaitPromise: true,
    returnByValue: true,
  });
  const stamps = JSON.parse(res.result.value);
  const dt = [];
  for (let i = 1; i < stamps.length; i++) dt.push(stamps[i] - stamps[i - 1]);
  dt.sort((a, b) => a - b);
  const q = (p) => dt[Math.floor(p * (dt.length - 1))];
  const mean = dt.reduce((s, x) => s + x, 0) / dt.length;
  const fps = 1000 / mean;
  const over34 = dt.filter((x) => x > 34).length;
  console.log('── frame timing (300 frames) ──');
  console.log(`fps mean     : ${fps.toFixed(1)}`);
  console.log(`frame p50    : ${q(0.5).toFixed(1)}ms`);
  console.log(`frame p95    : ${q(0.95).toFixed(1)}ms`);
  console.log(`frame max    : ${dt[dt.length - 1].toFixed(1)}ms`);
  console.log(`frames >34ms : ${over34}`);
  console.log(over34 === 0 && q(0.95) <= 17
    ? 'PASS (60Hz path: p95 ≤ 17ms, no frame > 34ms)'
    : 'FAIL — see suspects: monitor DOM writes / recorder shift / allocations');
  ws.close();
  proc.kill();
  process.exit(q(0.95) <= 17 && over34 === 0 ? 0 : 1);
}

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
