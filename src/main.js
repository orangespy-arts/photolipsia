import { sanitizeParams } from './protocol/params.js';
import { createDriverRegistry } from './drivers/registry.js';
import { createMockDriver } from './drivers/mock.js';
import { parseGains, applyGains } from './mapping/gains.js';
import { createRecorder, recordingName } from './rec/record.js';
import { createSplatStage } from './render/stage.js';
import { createExplorer } from './render/explorer.js';
import { fmtVec3, fmtTf } from './render/framing.js';
import { createMonitor } from './ui/monitor.js';
import * as THREE from 'three';
import { sceneConfig } from './render/sceneConfig.js';
import { createJourney } from './render/journey.js';
import { createFlightController } from './render/flightController.js';
import { createVjEffects } from './ui/vjEffects.js';
import { createSceneSwitcher } from './ui/sceneSwitcher.js';
import { createShowAudioControls } from './ui/showAudio.js';
import { performAction, performFromUrl } from './ui/performKeys.js';
import { parseRes } from './render/resolution.js';
import { createCompositor } from './ui/compositor.js';
import { createConsolePanel } from './ui/consolePanel.js';
import { audioEffectDrive } from './mapping/audioDrive.js';

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
document.getElementById('scene-home').hidden = !(url.has('scene') || url.get('journey') === '1');
// ?vj=1&audio=show — the fixed show track (served from audio/) drives the
// scene and Hydra through the web-audio driver; playback starts on a gesture.
const showAudio = url.get('vj') === '1' && url.get('audio') === 'show';
const SHOW_TRACK_URL = '/audio/5songDJ.wav';
const driverId = showAudio ? 'web-audio' : (url.get('driver') ?? 'mock');

const DRIVERS = ['mock', 'web-audio', 'osc', 'midi', 'playback'];
// clickable driver row: switching drivers is a navigation — each driver owns
// page-lifecycle state (AudioContext, WS socket, MIDI access) that a reload
// releases cleanly
function wireDriverRow(current) {
  const row = document.getElementById('driver-row');
  if (!row) return;
  for (const id of DRIVERS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toggle' + (id === current ? ' current' : '');
    btn.textContent = id;
    btn.addEventListener('click', () => {
      if (id === current) return;
      const next = new URLSearchParams(location.search);
      next.set('driver', id);
      next.delete('kind'); next.delete('source'); next.delete('simulate');
      next.delete('rec'); // driver-specific params would mislead the next driver
      location.href = `?${next}`;
    });
    row.appendChild(btn);
  }
}
wireDriverRow(driverId);

const registry = createDriverRegistry();
registry.register(createMockDriver({ kind: url.get('kind') ?? undefined }));

// web-audio driver is loaded lazily: it's browser-only (AudioContext) and
// mic permission should only be asked when actually requested
async function buildDriver(id) {
  if (id === 'web-audio') {
    const { createWebAudioDriver } = await import('./drivers/webaudio/index.js');
    if (showAudio) return createWebAudioDriver({ source: 'url', url: SHOW_TRACK_URL });
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
  if (id === 'playback') {
    const [{ createPlaybackDriver }, { parseRecording }] = await Promise.all([
      import('./drivers/playback.js'),
      import('./rec/play.js'),
    ]);
    // recording source: a picked file (fresh recordings land in Downloads)
    // or ?rec=name for files served from public/rec/
    let text = null;
    const recName = url.get('rec');
    if (recName) {
      const res = await fetch(`/rec/${encodeURIComponent(recName)}`);
      if (!res.ok) throw new Error(`recording "${recName}" not found (${res.status})`);
      text = await res.text();
    } else {
      const file = await pickFile('.jsonl');
      if (!file) throw new Error('no recording picked');
      text = await file.text();
    }
    const rec = parseRecording(text);
    if (rec.frames.length === 0) throw new Error('recording has no valid frames');
    const d = createPlaybackDriver(rec, { t0: Number(url.get('t0') ?? 0) || 0 });
    setStatus(`playback: ${rec.frames.length} frames, ${rec.duration.toFixed(1)}s${rec.badLines ? `, ${rec.badLines} bad lines` : ''}`);
    return d;
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

function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files[0] ?? null);
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

// ── recording: HUD toggle records the render-visible (post-gain) frames ──
// Stop → .jsonl download. Nothing touches a server; the recording is a
// protocol-valid frame stream playable via ?driver=playback&rec=… (or
// the file picker in the playback driver row).
const recBtn = document.getElementById('rec-toggle');
let recorder = null;
let recStartedAt = 0;

recBtn.addEventListener('click', () => {
  if (recorder) stopRecording();
  else {
    recorder = createRecorder();
    recStartedAt = performance.now();
    recBtn.textContent = 'rec: ● stop';
    recBtn.classList.add('recording');
  }
});

function stopRecording() {
  const jsonl = recorder.toJSONL();
  const frames = recorder.length;
  recorder = null;
  recBtn.textContent = 'rec: off';
  recBtn.classList.remove('recording');
  if (frames === 0) { setStatus('recording empty — nothing saved'); return; }
  const name = recordingName(driver?.id ?? 'unknown', recStartedAt);
  const blob = new Blob([jsonl], { type: 'application/x-ndjson' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus(`saved ${frames} frames → ${name}`);
}

// ? help line
document.getElementById('help-toggle').addEventListener('click', () => {
  const h = document.getElementById('help');
  h.hidden = !h.hidden;
});

// copy framing link: current camera (?view) + splat transform (?tf) back
// into the URL — a framed shot is a shareable URL, not a screenshot
document.getElementById('frame-copy').addEventListener('click', () => {
  const cam = config.vj ? {
    camPos: stage.camera.position.toArray(),
    lookAt: stage.camera.getWorldDirection(new THREE.Vector3()).add(stage.camera.position).toArray(),
  } : stage.liveCameraState();
  const next = new URLSearchParams(location.search);
  next.set('view', `${fmtVec3(cam.lookAt)}@${fmtVec3(cam.camPos)}`);
  next.set('spin', '0');
  const tf = fmtTf({
    position: [...stage.splat.position.toArray()],
    rotationDeg: [
      stage.splat.rotation.x,
      stage.splat.rotation.y,
      stage.splat.rotation.z,
    ].map(THREE.MathUtils.radToDeg),
    scale: stage.splat.scale.x,
  });
  if (tf) next.set('tf', tf); else next.delete('tf');
  const link = `${location.origin}${location.pathname}?${next}`;
  navigator.clipboard.writeText(link)
    .then(() => setStatus('framing link copied'))
    .catch(() => setStatus('clipboard blocked — see console', true) ?? console.log(link));
});

// ── splat stage ──
// ?splat=/splats/your.ply — bring your own scene; any .ply (3DGS) or .splat
// file under public/ works. The y-down→y-up flip and dyno modifier apply to
// whatever loads here.
// ?view=look@cam — optional camera basis for non-default scenes, e.g.
// ?view=0,1.4,-0.3@0,1.4,2 aiming at a scene centered at (0,1.4,-0.3).
// ?play=1 — explorer mode: a third-person ball rolls through the scene on
// arrow keys (WASD too) and greens the ground it passes. The camera follows
// the ball, so idle spin, drag-orbit and copy-framing are disabled there.
const config = sceneConfig(url);
// ?vj=1&console=1 — dual-screen: this window is the console (renders at a
// fixed size, preview + key map); /output.html shows the clean stream.
const consoleMode = config.vj && url.get('console') === '1';
const renderSize = consoleMode ? parseRes(url.get('res')) : null;
if (config.journey) {
  document.body.classList.add('journey', 'controls-collapsed');
  document.getElementById('start-explore').hidden = true;
  const controlsToggle = document.getElementById('controls-toggle');
  controlsToggle.hidden = false;
  controlsToggle.addEventListener('click', () => {
    const collapsed = document.body.classList.toggle('controls-collapsed');
    controlsToggle.textContent = collapsed ? '声音与生长设置' : '收起设置';
    controlsToggle.setAttribute('aria-expanded', String(!collapsed));
  });
}
const { play, view } = config;
const onLookStatus = (message) => {
  const hint = document.getElementById('look-status');
  hint.hidden = false;
  hint.textContent = config.journey ? 'WASD / 方向键移动 · 右键拖动视角 · Esc 释放鼠标' : message;
};
const stage = config.journey ? createJourney({ canvas, startId: url.get('scene'), onLookStatus }) : createSplatStage({
  canvas,
  splatUrl: config.splatUrl,
  view,
  tf: config.tf,
  // show track: VJ scenes react to the music (native colors, shake only)
  staticEnvironment: config.staticEnvironment && !showAudio,
  spin: url.get('spin') === '0' || play || config.vj ? 0 : undefined,
  // ?mode=shake — colors and scales stay native; wobble jitter is the only
  // audio response (ruins scenes that must not recolor)
  shake: url.get('mode') === 'shake' || showAudio,
  // play mode: the explorer owns the camera — orbit/wheel handlers would fight it
  interactive: !play && !config.vj,
  renderSize,
});

let flight = null;
let effects = null;
let switcher = null;
let audioUi = null;
let compositor = null;
let consolePanel = null;
let lastPad = null;
if (config.vj) {
  document.body.classList.add('vj');
  document.getElementById('vj-controls').hidden = false;
  document.getElementById('scene-home').hidden = false;
  if (url.get('hydra') !== '0') effects = createVjEffects({ source: canvas,
    output: document.getElementById('hydra-output'), panel: document.getElementById('effect-controls') });
  flight = createFlightController({ camera: stage.camera, isReady: () => stage.ready && !stage.loadError,
    onInput: pad => { lastPad = pad; effects?.setInput(pad); switcher?.input(pad); },
    onStatus: message => { document.getElementById('flight-status').textContent = message; } });
  document.getElementById('flight-reset').addEventListener('click', () => flight.reset());
  if (consoleMode) {
    document.body.classList.add('console');
    document.getElementById('console-left').hidden = false;
    const fadeEl = document.getElementById('scene-fade');
    compositor = createCompositor({ canvas: document.getElementById('composite'),
      sources: [canvas, document.getElementById('hydra-output')], size: renderSize,
      isFading: () => fadeEl.classList.contains('on') });
    // output.html (window.opener) picks this up and polls for reconnects
    window.__photolipsiaOutput = compositor;
    consolePanel = createConsolePanel({ table: document.getElementById('control-map'),
      openButton: document.getElementById('open-output'), outputState: document.getElementById('output-state'),
      getPad: () => lastPad, getFx: () => effects?.fx,
      getFrame: () => ({ canvas: compositor.canvas, frame: compositor.frame }) });
  }
  // performance mode: H hides the whole console (+cursor), F fullscreen
  const hint = document.getElementById('perform-hint');
  let hintTimer = null;
  const setPerform = (on) => {
    document.body.classList.toggle('perform', on);
    clearTimeout(hintTimer);
    hint.classList.toggle('on', on);
    if (on) hintTimer = setTimeout(() => hint.classList.remove('on'), 2000);
  };
  setPerform(performFromUrl(url));
  window.addEventListener('keydown', (event) => {
    const action = performAction(event);
    if (!action) return;
    event.preventDefault();
    if (action === 'toggle-hud') setPerform(!document.body.classList.contains('perform'));
    else if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  });
  if (showAudio && driver?.media) audioUi = createShowAudioControls({ driver, panel: document.getElementById('audio-controls'),
    hint: document.getElementById('amp-hint'), defaultName: SHOW_TRACK_URL.split('/').pop() });
  // custom ?splat= assets are outside the show catalog: no Start switching
  if (!url.has('splat')) {
    const label = document.getElementById('scene-switch-status');
    label.hidden = false;
    switcher = createSceneSwitcher({ stage, flight, startId: url.get('scene'),
      fade: document.getElementById('scene-fade'), label });
  }
  const speed = document.getElementById('flight-speed');
  speed.addEventListener('input', () => {
    document.getElementById('flight-speed-value').textContent = `${flight.setSpeed(Number(speed.value)).toFixed(1)}`;
  });
  window.addEventListener('pagehide', () => { flight.dispose(); effects?.dispose(); switcher?.dispose(); audioUi?.dispose(); }, { once: true });
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
}

let explorer = null;
if (play) {
  explorer = config.journey ? stage.explorer : createExplorer({
    scene: stage.scene,
    camera: stage.camera,
    config: config.explorer,
    canvas,
    onLookStatus: (message) => {
      const hint = document.getElementById('look-status');
      hint.hidden = false;
      hint.textContent = message;
    },
    isStageReady: () => stage.ready,
  });
  document.getElementById('frame-copy').hidden = true;
  const onsetSlider = document.getElementById('onset-size');
  const onsetValue = document.getElementById('onset-size-value');
  document.getElementById('plant-controls').hidden = false;
  function setOnsetSize(value) {
    const size = explorer.setOnsetSize(value);
    onsetSlider.value = String(size);
    onsetValue.value = `${size.toFixed(1)}×`;
    onsetSlider.setAttribute('aria-valuetext', `${size.toFixed(1)} times onset response`);
    return size;
  }
  setOnsetSize(Number(url.get('onsetSize') ?? 1));
  onsetSlider.addEventListener('input', () => {
    const size = setOnsetSize(Number(onsetSlider.value));
    const next = new URL(location.href);
    next.searchParams.set('onsetSize', size.toFixed(1));
    history.replaceState(null, '', next);
  });
  setStatus('loading scene…');
}
watchSplat();
function watchSplat() {
  const check = setInterval(() => {
    if (stage.loadError || explorer?.loadError) {
      clearInterval(check);
      setStatus(`load failed: ${stage.loadError ?? explorer.loadError}`, true);
    } else if (stage.ready && (!explorer || explorer.seedsReady)) {
      clearInterval(check);
      setStatus(explorer ? (explorer.navigationStatus ?? 'arrow keys / WASD: move and grow leaves (glass ball)') : `splat loaded (${driver?.id ?? 'no driver'})`);
      // live getter, not a snapshot — probes read camera state after drags
      window.__DIAG__ = null;
      Object.defineProperty(window, '__DIAG__', { get: () => stage.diag });
      if (explorer) {
        // live getters again — the probe reads greening progress mid-run
        Object.defineProperty(window, '__EXPLORER__', { get: () => ({
          pos: explorer.position.toArray(),
          view: explorer.view,
          seedsReady: explorer.seedsReady,
          grown: explorer.grown,
          coverage: explorer.coverage,
          coverageKind: 'plant-pool-utilization',
          ballOpacity: explorer.ball.material.opacity,
          plantAudioScale: explorer.plantAudioScale,
        }) });
      }
    } else if (stage.loadError) { clearInterval(check); setStatus(`splat failed: ${stage.loadError}`, true); }
  }, 100);
}

const monitor = createMonitor(monitorEl);

let last = performance.now() / 1000;
function frameLoop() {
  try {
    const now = performance.now() / 1000;
    const elapsed = now - last;
    const dt = Math.min(0.1, elapsed);
    last = now;

    if (driver) {
      const frame = sanitizeParams(driver.poll(now)).params;
      const visible = applyGains(frame, gains);
      if (recorder) recorder.add({ ...visible, time: frame.time });
      if (audioUi) stage.setAmplitude(audioUi.splatAmount);
      stage.updateParams(visible, dt);
      effects?.setAudio(audioUi ? audioEffectDrive(visible, audioUi.effectAmount) : null);
      explorer?.updateParams(visible);

      monitor.update(frame);
      window.__LAST_ONSET__ = visible.onset; // probe latency audit hook
      if (recorder) {
        const secs = (performance.now() - recStartedAt) / 1000;
        recBtn.textContent = `rec: ● ${secs.toFixed(0)}s`;
      }
    }
    explorer?.update(dt);
    flight?.update(elapsed);
    switcher?.update();
    audioUi?.update();
    stage.render(now);
    effects?.render(elapsed, stage.ready && !stage.loadError);
    // same frame as the WebGL renders, before their buffers are presented
    compositor?.draw(elapsed);
    consolePanel?.update();
  } catch (err) {
    // surface it on the page — a dead silent loop is the worst failure mode
    setStatus(`render loop error: ${err.message}`, true);
  }
  requestAnimationFrame(frameLoop);
}
requestAnimationFrame(frameLoop);
