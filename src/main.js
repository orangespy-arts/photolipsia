import { sanitizeParams } from './protocol/params.js';
import { createDriverRegistry } from './drivers/registry.js';
import { createMockDriver } from './drivers/mock.js';
import { createMonitor } from './ui/monitor.js';

const statusEl = document.getElementById('status');
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
const params = new URLSearchParams(location.search);
const driverId = params.get('driver') ?? 'mock';

const registry = createDriverRegistry();
registry.register(createMockDriver());

const driver = registry.get(driverId);
if (!driver) {
  setStatus(`unknown driver "${driverId}" — available: ${registry.ids().join(', ')}`, true);
} else {
  try {
    await driver.start();
    setStatus(`driver: ${driver.id} — no splat renderer yet (Stage 1), showing protocol monitor`);
  } catch (err) {
    setStatus(`driver "${driver.id}" failed to start: ${err.message}`, true);
  }
}

const monitor = createMonitor(monitorEl);

// render loop: pull model — one poll per frame
function frameLoop() {
  if (driver) {
    const frame = sanitizeParams(driver.poll(performance.now() / 1000));
    monitor.update(frame);
  }
  requestAnimationFrame(frameLoop);
}
requestAnimationFrame(frameLoop);

setReady();
