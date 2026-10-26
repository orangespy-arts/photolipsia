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

const gains = parseGains(url.get('gain') ?? '');

const driver = registry.get(driverId);
if (!driver) {
  setStatus(`unknown driver "${driverId}" — available: ${registry.ids().join(', ')}`, true);
} else {
  try {
    await driver.start();
    setStatus(`driver: ${driver.id}`);
  } catch (err) {
    setStatus(`driver "${driver.id}" failed to start: ${err.message}`, true);
  }
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
