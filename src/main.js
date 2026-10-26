import { sanitizeParams } from './protocol/params.js';
import { createDriverRegistry } from './drivers/registry.js';
import { createMockDriver } from './drivers/mock.js';
import { parseGains, applyGains } from './mapping/gains.js';
import { createSplatStage } from './render/stage.js';
import { createMonitor } from './ui/monitor.js';

const statusEl = document.getElementById('status');
const canvas = document.getElementById('stage');
const monitorEl = document.getElementById('monitor');

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
  if (isError) window.__APP_ERROR__ = text;
}

function setReady() {
  window.__APP_READY__ = true;
}

// ── driver selection via ?driver= (default: mock) ──
const url = new URLSearchParams(location.search);
const driverId = url.get('driver') ?? 'mock';

const registry = createDriverRegistry();
registry.register(createMockDriver({ kind: url.get('kind') ?? undefined }));

// web-audio driver is loaded lazily: it's browser-only (AudioContext) and
// mic permission should only be asked when actually requested
async function buildDriver(id) {
  if (id === 'web-audio') {
    const { createWebAudioDriver } = await import('./drivers/webaudio/index.js');
    const source = url.get('source') ?? 'mic';
    let file = null;
    if (source === 'file') {
      file = await pickAudioFile();
      if (!file) throw new Error('no file picked');
    }
    return createWebAudioDriver({ source, file });
  }
  if (id === 'osc') {
    const { createOscDriver } = await import('./drivers/osc/index.js');
    const osc = url.get('osc') ?? 'localhost:9128';
    return createOscDriver({ url: `ws://${osc}` });
  }
  if (id === 'midi') {
    const { createMidiDriver } = await import('./drivers/midi/index.js');
    // ?simulate=1 — scripted performance through the real byte path
    // (no controller needed); ?beat=0 still works to hide the beat row
    return createMidiDriver({ simulate: url.get('simulate') === '1' });
  }
  return registry.get(id);
}

function pickAudioFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = () => resolve(input.files[0] ?? null);
    // user cancel fires no change event in all browsers; also resolve on focus regain
    window.addEventListener('focus', () => setTimeout(() => resolve(null), 300), { once: true });
    input.click();
  });
}

const gains = parseGains(url.get('gain') ?? '');

const driverInfo = await buildDriver(driverId).catch((err) => ({ error: err }));
const driver = driverInfo?.error ? null : driverInfo;
if (driverInfo?.error) {
  setStatus(`driver "${driverId}" failed: ${driverInfo.error.message}`, true);
} else if (driver) {
  try {
    await driver.start();
    setStatus(`driver: ${driver.id}${driver.devices?.length ? ` — ${driver.devices.join(', ')}` : ''}`);
    wireBeatToggle(driver);
  } catch (err) {
    setStatus(`driver "${driver.id}" failed to start: ${err.message}`, true);
  }
}

// beat toggle button — only for drivers that estimate beat (web-audio).
// ?beat=0 starts it off.
function wireBeatToggle(d) {
  const btn = document.getElementById('beat-toggle');
  if (typeof d.setBeatEnabled !== 'function') return; // mock etc: keep hidden
  btn.hidden = false;
  const initial = url.get('beat') !== '0';
  d.setBeatEnabled(initial);
  const paint = () => {
    btn.textContent = `beat: ${d.beatEnabled ? 'on' : 'off'}`;
    btn.classList.toggle('on', d.beatEnabled);
  };
  paint();
  btn.addEventListener('click', () => { d.setBeatEnabled(!d.beatEnabled); paint(); });
}

// ── splat stage ──
const stage = createSplatStage({ canvas, splatUrl: '/splats/test.ply' });
stage.ready ? setStatus('splat loaded') : watchSplat();
function watchSplat() {
  const check = setInterval(() => {
    if (stage.ready) {
      clearInterval(check);
      setStatus(`splat loaded (${driver?.id ?? 'no driver'})`);
      window.__DIAG__ = stage.diag;
    } else if (stage.loadError) { clearInterval(check); setStatus(`splat failed: ${stage.loadError}`, true); }
  }, 100);
}

const monitor = createMonitor(monitorEl);

let last = performance.now() / 1000;
function frameLoop() {
  try {
    const now = performance.now() / 1000;
    const dt = Math.min(0.1, now - last);
    last = now;

    if (driver) {
      const frame = sanitizeParams(driver.poll(now)).params;
      stage.updateParams(applyGains(frame, gains), dt);
      monitor.update(frame);
    }
    stage.render(now);
  } catch (err) {
    // surface it on the page — a dead silent loop is the worst failure mode
    setStatus(`render loop error: ${err.message}`, true);
  }
  requestAnimationFrame(frameLoop);
}
requestAnimationFrame(frameLoop);
