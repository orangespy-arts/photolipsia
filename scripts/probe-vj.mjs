#!/usr/bin/env node
/**
 * VJ probe (G3b-a): Hydra effect-load audit without a real gamepad.
 * Opens ?vj=1&scene=s01 headless, clicks the "预览效果" button (the same
 * 65%-trigger preview path the UI uses), and compares frame timing:
 *   A — Hydra loaded but idle (passthrough, zero effects)
 *   B — Hydra active (preview at 65% triggers)
 *   C — &hydra=0 baseline (Hydra never loaded)
 * Also records canvas resolution × devicePixelRatio and screenshots the
 * idle vs active composite. NOT a substitute for real-gamepad verification
 * (G3b-b) or screen-recorder load measurement (G3b-c).
 *
 * Usage: node scripts/probe-vj.mjs [baseUrl]   (default http://localhost:5175)
 * Screenshots → .check/vj-hydra-before.png / .check/vj-hydra-active.png
 */
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';

const base = (process.argv[2] ?? 'http://localhost:5175').replace(/\/$/, '');
const vjUrl = `${base}/?vj=1&scene=s01`;
const noHydraUrl = `${base}/?vj=1&scene=s01&hydra=0`;
const PORT = 9225;

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
let problems = 0;
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
    if (msg.params.type === 'error' && /favicon/i.test(text)) return; // benign 404
    if (msg.params.type === 'error') { console.log(`[console.error] ${text}`); problems++; }
    else if (!text.includes('X3203')) console.log(`[console.${msg.params.type}] ${text}`);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    console.log(`[EXCEPTION] ${d.exception?.description ?? d.text}`);
    problems++;
  } else if (msg.method === 'Log.entryAdded') {
    const e = msg.params.entry;
    // favicon 404 is a known-benign network error in this repo
    // (the URL lives in e.url, the text only says "Failed to load resource")
    if (e.level === 'error' && !/favicon/i.test(`${e.text} ${e.url ?? ''}`)) {
      console.log(`[error] ${e.source}: ${e.text} ${e.url ?? ''}`); problems++;
    }
  }
};

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return res.result.value;
};

// poll until the splat is ready; requireHydra also waits for the effect
// panel's live label (only rendered once the Hydra renderer exists)
const waitReady = async (requireHydra) => {
  for (let i = 0; i < 80; i++) {
    const s = JSON.parse(await evaluate(`JSON.stringify({
      ready: window.__DIAG__?.ready ?? false,
      status: document.getElementById('status')?.textContent ?? '',
      error: window.__APP_ERROR__ ?? null,
      effect: document.querySelector('[data-effect-status]')?.textContent ?? '',
      panelHidden: document.getElementById('effect-controls')?.hidden ?? true,
    })`));
    if (s.error) return { ...s, failed: true };
    const hydraReady = !requireHydra || (/拖影/.test(s.effect) && !s.panelHidden);
    if (s.ready && hydraReady) return s;
    await sleep(500);
  }
  return null;
};

// same 300-frame rAF audit as probe.mjs --fps
const fpsAudit = async () => {
  const stamps = JSON.parse(await evaluate(`
    new Promise((resolve) => {
      const stamps = [];
      function tick(t) {
        stamps.push(t);
        if (stamps.length < 300) requestAnimationFrame(tick);
        else resolve(JSON.stringify(stamps));
      }
      requestAnimationFrame(tick);
    })
  `));
  const dt = [];
  for (let i = 1; i < stamps.length; i++) dt.push(stamps[i] - stamps[i - 1]);
  dt.sort((a, b) => a - b);
  const q = (p) => dt[Math.floor(p * (dt.length - 1))];
  return {
    fps: 1000 / (dt.reduce((s, x) => s + x, 0) / dt.length),
    p50: q(0.5), p95: q(0.95), max: dt[dt.length - 1],
    over34: dt.filter((x) => x > 34).length,
  };
};

const printFps = (name, f) => console.log(
  `${name}: fps ${f.fps.toFixed(1)} · p50 ${f.p50.toFixed(1)}ms · p95 ${f.p95.toFixed(1)}ms · max ${f.max.toFixed(1)}ms · >34ms ×${f.over34}`);

const screenshot = async (path) => {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(path, Buffer.from(shot.data, 'base64'));
  return shot.data;
};

await mkdir('.check', { recursive: true });

// ── phases A+B: Hydra page ──
await send('Page.navigate', { url: vjUrl });
await sleep(2500);
const ready = await waitReady(true);
if (!ready || ready.failed) {
  console.log(`FAIL — page not ready: ${ready ? `app error ${ready.error}` : 'timeout waiting for scene + Hydra panel'}`);
  ws.close(); proc.kill(); process.exit(1);
}
console.log(`scene ready (status: ${ready.status}) · effect: ${ready.effect}`);

const resolution = JSON.parse(await evaluate(`JSON.stringify({
  dpr: devicePixelRatio,
  inner: [innerWidth, innerHeight],
  stage: (() => { const c = document.getElementById('stage');
    return { buffer: [c.width, c.height], css: [c.clientWidth, c.clientHeight] }; })(),
  hydra: (() => { const c = document.getElementById('hydra-output');
    return { buffer: [c.width, c.height], hidden: c.hidden }; })(),
})`));
console.log(`resolution: window ${resolution.inner.join('×')} @ dpr ${resolution.dpr} · `
  + `stage buffer ${resolution.stage.buffer.join('×')} (css ${resolution.stage.css.join('×')}) · `
  + `hydra buffer ${resolution.hydra.buffer.join('×')}`);

// phase A — Hydra idle (passthrough): no preview, no gamepad
const idleFps = await fpsAudit();
printFps('A hydra-idle ', idleFps);
const beforePng = await screenshot('.check/vj-hydra-before.png');

// click 预览效果 through the real CDP mouse path
const btn = JSON.parse(await evaluate(`(() => {
  const b = document.querySelector('[data-effect-preview]');
  if (!b || b.disabled) return null;
  const r = b.getBoundingClientRect();
  return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
})()`));
if (!btn) {
  console.log('FAIL — preview button missing or disabled');
  ws.close(); proc.kill(); process.exit(1);
}
await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...btn, button: 'left', clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...btn, button: 'left', clickCount: 1 });

// wait for the ramp: output visible and the label reporting the 65% preview level
let active = null;
for (let i = 0; i < 20; i++) {
  active = JSON.parse(await evaluate(`JSON.stringify({
    hidden: document.getElementById('hydra-output').hidden,
    effect: document.querySelector('[data-effect-status]')?.textContent ?? '',
  })`));
  if (!active.hidden && active.effect.includes('65')) break;
  await sleep(500);
}
if (!active || active.hidden || !active.effect.includes('65')) {
  console.log(`FAIL — preview did not activate (output hidden=${active?.hidden}, effect: "${active?.effect}")`);
  ws.close(); proc.kill(); process.exit(1);
}
console.log(`preview active — effect: ${active.effect}`);

// phase B — Hydra active at preview level
const activeFps = await fpsAudit();
printFps('B hydra-active', activeFps);
const afterPng = await screenshot('.check/vj-hydra-active.png');
const compositeChanged = afterPng !== beforePng;
console.log(`composite changed vs idle: ${compositeChanged ? 'yes' : 'NO — effect may not be drawing'}`);
console.log(`screenshots → .check/vj-hydra-before.png / .check/vj-hydra-active.png`);

// ── phase C — no Hydra at all ──
await send('Page.navigate', { url: noHydraUrl });
await sleep(2500);
const ready2 = await waitReady(false);
if (!ready2 || ready2.failed) {
  console.log(`WARN — &hydra=0 baseline not ready: ${ready2 ? ready2.error : 'timeout'}`);
} else {
  const noHydraFps = await fpsAudit();
  printFps('C no-hydra   ', noHydraFps);
}

console.log(`console errors/exceptions during run: ${problems}`);
const pass = activeFps.p95 <= 17 && activeFps.over34 === 0 && compositeChanged && problems === 0;
console.log(pass
  ? 'PASS (hydra-active: p95 ≤ 17ms, no frame > 34ms, composite verified)'
  : 'FAIL — see numbers above (headless software rasterizer may understate; real-GPU numbers come from G3b-b/c)');
ws.close();
proc.kill();
process.exit(pass ? 0 : 1);
