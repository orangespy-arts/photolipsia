import { formatClock } from '../mapping/audioDrive.js';
import { stepAmplitude, clampAmplitude, stepEffectSync } from '../mapping/amplitude.js';
import { isLikelyAudio, displayName, AUDIO_ACCEPT } from '../mapping/audioFile.js';
import { reduceInput, inputState, inputLabels } from '../mapping/inputMode.js';

// VJ show-track transport + reactivity sliders. Audio needs a user gesture,
// so playback starts from the button (or Space) — never automatically.
export function createShowAudioControls({ driver, panel, hint = null, defaultName = '', doc = document }) {
  const button = panel.querySelector('[data-audio-toggle]');
  const clock = panel.querySelector('[data-audio-clock]');
  const seek = panel.querySelector('[data-audio-seek]');
  const splat = panel.querySelector('[data-audio-splat]');
  const effect = panel.querySelector('[data-audio-effect]');
  const splatValue = panel.querySelector('[data-audio-splat-value]');
  const effectValue = panel.querySelector('[data-audio-effect-value]');
  const pick = panel.querySelector('[data-audio-pick]');
  const fileInput = panel.querySelector('[data-audio-file]');
  const nameLabel = panel.querySelector('[data-audio-name]');
  const inputButton = panel.querySelector('[data-input-toggle]');
  const inputStatus = panel.querySelector('[data-input-status]');
  const deviceSelect = panel.querySelector('[data-input-device]');
  panel.hidden = false;
  let error = '', hintTimer = null, busy = false, input = inputState();
  const dispatch = (event) => { input = reduceInput(input, event); };
  // current track: the served default or a picked local file (blob URL)
  let track = { src: driver.media?.src ?? '', name: defaultName, blob: false };
  nameLabel.textContent = displayName(track.name);
  fileInput.accept = AUDIO_ACCEPT;

  async function loadFile(file) {
    if (!file) return;
    if (!isLikelyAudio(file)) { error = `Not an audio file: ${displayName(file.name)}`; return; }
    const url = URL.createObjectURL(file);
    const previous = track;
    busy = true; error = ''; nameLabel.textContent = `Loading… ${displayName(file.name)}`;
    try {
      await driver.loadSource(url);
      track = { src: url, name: file.name, blob: true };
      if (previous.blob) URL.revokeObjectURL(previous.src);
    } catch (err) {
      URL.revokeObjectURL(url);
      error = `${err.message}：${displayName(file.name)}`;
      // keep the show going on the previous track
      await driver.loadSource(previous.src).catch(() => {});
    } finally {
      busy = false;
      nameLabel.textContent = displayName(track.name);
      nameLabel.title = track.name;
    }
  }
  // ── live microphone (W3i) ──
  const micError = (err) => (err?.name === 'NotAllowedError' ? 'Microphone permission denied'
    : err?.name === 'NotFoundError' ? 'No microphone found' : `Could not use the microphone: ${err?.message ?? err}`);
  async function openMic(deviceId = '') {
    try {
      const { label, deviceId: used } = await driver.useMic(deviceId, () => dispatch({ type: 'mic-ended' }));
      dispatch({ type: 'mic-ok', label });
      // labels are only readable after permission: fill the device list now
      const inputs = await driver.listInputs();
      deviceSelect.replaceChildren(...inputs.map((d) => new Option(d.label, d.id, false, d.id === used)));
      deviceSelect.hidden = inputs.length < 2;
    } catch (err) { dispatch({ type: 'mic-failed', error: micError(err) }); }
  }
  inputButton.addEventListener('click', async () => {
    inputButton.blur();
    const was = input.mode;
    dispatch({ type: 'toggle' });
    if (was === 'mic') { driver.useMusic(); deviceSelect.hidden = true; } else if (input.pending) await openMic();
  });
  // switching device re-requests the mic; the reducer waits for its answer
  deviceSelect.addEventListener('change', () => {
    if (input.mode !== 'mic') return;
    input = { ...input, pending: true };
    openMic(deviceSelect.value);
  });

  // progress bar: follows playback; dragging previews the time, releasing
  // jumps there (and hands the arrow keys back to amplitude / effect sync)
  let seeking = false;
  const seekTime = () => (Number(seek.value) / 1000) * (driver.media?.duration || 0);
  seek.addEventListener('input', () => { seeking = true; });
  seek.addEventListener('change', () => {
    const media = driver.media;
    if (media && Number.isFinite(media.duration)) media.currentTime = seekTime();
    seeking = false; seek.blur();
  });

  pick.addEventListener('click', () => { pick.blur(); fileInput.click(); });
  fileInput.addEventListener('change', () => { loadFile(fileInput.files?.[0]); fileInput.value = ''; });

  async function toggle() {
    const media = driver.media;
    if (!media || busy || !inputLabels(input).canPlay) return;
    button.blur(); // Space must not also re-click a focused button
    try {
      if (media.paused) await driver.play(); else driver.pause();
      error = '';
    } catch (err) { error = `Playback failed: ${err.message}`; }
  }
  const showHint = (text) => {
    if (!hint) return;
    hint.textContent = text;
    hint.classList.add('on'); clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.remove('on'), 1200);
  };
  const onKey = (event) => {
    if (event.target.closest?.('input, select, textarea') || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.code === 'Space' && !event.repeat) { event.preventDefault(); toggle(); return; }
    // ↑/↓: particle amplitude, ←/→: effect sync — both sound-linked
    // (key repeat = keep changing)
    const vertical = { ArrowUp: 1, ArrowDown: -1 }[event.code];
    const horizontal = { ArrowRight: 1, ArrowLeft: -1 }[event.code];
    if (!vertical && !horizontal) return;
    event.preventDefault();
    if (vertical) {
      splat.value = String(stepAmplitude(Number(splat.value), vertical));
      paintSliders(); showHint(`♪ Particle amplitude (sound-linked) ${Number(splat.value).toFixed(2)}×`);
    } else {
      effect.value = String(stepEffectSync(Number(effect.value), horizontal));
      paintSliders(); showHint(`♪ Effect sync (sound-linked) ${Number(effect.value).toFixed(2)}`);
    }
  };
  const paintSliders = () => {
    splatValue.textContent = `${Number(splat.value).toFixed(2)}×`;
    effectValue.textContent = Number(effect.value).toFixed(2);
  };
  button.addEventListener('click', toggle);
  splat.addEventListener('input', paintSliders);
  effect.addEventListener('input', paintSliders);
  doc.addEventListener('keydown', onKey);
  paintSliders();

  return {
    get trackName() { return track.name; },
    get splatAmount() { return clampAmplitude(Number(splat.value)); },
    get effectAmount() { return Number(effect.value); },
    update() {
      const media = driver.media;
      const playing = media && !media.paused && !media.ended;
      const io = inputLabels(input, track.name);
      if (inputButton.textContent !== io.button) inputButton.textContent = io.button;
      if (inputStatus.textContent !== io.status) inputStatus.textContent = io.status;
      inputButton.disabled = input.pending;
      button.disabled = !io.canPlay;
      const label = playing ? '❚❚ Pause music' : media?.ended ? '↺ Replay' : media?.currentTime > 0 ? '▶ Resume music' : '▶ Start music';
      if (button.textContent !== label) button.textContent = label;
      const duration = media?.duration;
      const known = Number.isFinite(duration) && duration > 0;
      seek.disabled = !known || !io.canPlay;
      if (!seeking) seek.value = String(known ? Math.round((media.currentTime / duration) * 1000) : 0);
      const shown = seeking ? seekTime() : media?.currentTime;
      const text = error || `${formatClock(shown)} / ${formatClock(duration)}`;
      if (clock.textContent !== text) clock.textContent = text;
    },
    get inputMode() { return input.mode; },
    // sound is actually coming in (track playing or live mic) — beat gate
    get live() { const m = driver.media; return input.mode === 'mic' || (!!m && !m.paused && !m.ended); },
    dispose() { button.removeEventListener('click', toggle); doc.removeEventListener('keydown', onKey); driver.pause(); driver.useMusic?.(); },
  };
}
