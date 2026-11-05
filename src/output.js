// Output window for the dual-screen console: shows exactly the console's
// composited frame, nothing else. The console (window.opener) owns rendering,
// gamepad and music; this page never needs focus once fullscreen.
//
// Default: copy the console's #composite canvas every frame (works in
// Chromium and Firefox-based browsers alike). ?via=stream uses the live
// MediaStream instead — in Firefox/Zen a cross-window stream froze on its
// first frame, so it is opt-in only.
const via = new URLSearchParams(location.search).get('via') === 'stream' ? 'stream' : 'copy';
const canvas = document.getElementById('out-canvas');
const video = document.getElementById('out');
const note = document.getElementById('note');
const ctx = canvas.getContext('2d', { alpha: false });
let current = null, lastFrame = -1, lastSeen = 0, connected = false;

function link() {
  try { return window.opener?.__photolipsiaOutput ?? null; } catch { return null; }
}

function setConnected(on) {
  if (on === connected) return;
  connected = on;
  note.classList.toggle('gone', on);
}

const stats = { ticks: 0, copies: 0, pushes: 0, error: '' };

function present(src, frame, now) {
  if (!src || src.width === 0 || frame === lastFrame) return;
  if (canvas.width !== src.width || canvas.height !== src.height) { canvas.width = src.width; canvas.height = src.height; }
  ctx.drawImage(src, 0, 0);
  lastFrame = frame; lastSeen = now; stats.copies++;
}

// Push path (primary): the console calls this every frame with its composite.
// Works even when this window has no usable window.opener (seen in Zen) and
// when this window's own rAF is throttled.
window.__photolipsiaPresent = (src, frame) => {
  try { stats.pushes++; present(src, frame, performance.now()); setConnected(true); }
  catch (err) { stats.error = String(err?.message ?? err); }
};
function copyLoop(now) {
  // schedule first: an exception must never stop the loop (it froze on the
  // first frame once already)
  requestAnimationFrame(copyLoop);
  stats.ticks++;
  try {
    // pull path (fallback, needs window.opener): skipped frames already pushed
    const out = link();
    if (out?.canvas) present(out.canvas, out.frame, now);
    // nothing new from either path for 2 s → show the waiting note again
    setConnected(now - lastSeen < 2000);
  } catch (err) { stats.error = String(err?.message ?? err); }
}

function streamConnect() {
  const stream = link()?.stream ?? null;
  const live = stream && stream.active && stream.getVideoTracks().some((t) => t.readyState === 'live');
  if (live && stream !== current) { current = stream; video.srcObject = stream; video.play().catch(() => {}); }
  else if (!live && current) { current = null; video.srcObject = null; }
  setConnected(!!current);
}

if (via === 'copy') { video.hidden = true; requestAnimationFrame(copyLoop); }
else { canvas.hidden = true; streamConnect(); setInterval(streamConnect, 1000); }
if (!window.opener) note.innerHTML = 'Please open this page from the console\'s "Open output window" button';

const toggleFullscreen = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
};
window.addEventListener('dblclick', toggleFullscreen);
window.addEventListener('keydown', (e) => { if (e.code === 'KeyF' && !e.repeat) toggleFullscreen(); });
// centre pixel of what this window actually shows (diagnostics only)
const centre = () => { try { return [...ctx.getImageData(canvas.width / 2 | 0, canvas.height / 2 | 0, 1, 1).data.slice(0, 3)].join(','); } catch { return '?'; } };
window.__OUTPUT__ = () => ({ via, connected, frame: lastFrame, w: canvas.width, h: canvas.height, ...stats,
  pixel: via === 'copy' ? centre() : '-', visible: document.visibilityState });
// ?debug=1 (or D): counters overlay for diagnosing a frozen output
const debug = document.getElementById('debug');
let debugOn = new URLSearchParams(location.search).get('debug') === '1';
window.addEventListener('keydown', (e) => { if (e.code === 'KeyD' && !e.repeat) debugOn = !debugOn; });
let prev = { ticks: 0, copies: 0, t: performance.now() };
setInterval(() => {
  const t = performance.now(), dt = (t - prev.t) / 1000;
  debug.hidden = !debugOn;
  if (debugOn) {
    let consoleFrame = '—';
    try { consoleFrame = String(window.opener?.__photolipsiaOutput?.frame ?? 'none'); } catch (e) { consoleFrame = `error ${e.message}`; }
    debug.textContent = `via=${via} loop ${((stats.ticks - prev.ticks) / dt).toFixed(0)}/s · push ${((stats.pushes - prev.pushes) / dt).toFixed(0)}/s · copy ${((stats.copies - prev.copies) / dt).toFixed(0)}/s · console frame ${consoleFrame} · output frame ${lastFrame}${stats.error ? ` · error ${stats.error}` : ''}`;
  }
  prev = { ticks: stats.ticks, copies: stats.copies, pushes: stats.pushes, t };
}, 1000);
