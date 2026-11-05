import { formatClock } from '../mapping/audioDrive.js';
import { stepAmplitude, clampAmplitude } from '../mapping/amplitude.js';
import { isLikelyAudio, displayName, AUDIO_ACCEPT } from '../mapping/audioFile.js';

// VJ show-track transport + reactivity sliders. Audio needs a user gesture,
// so playback starts from the button (or Space) — never automatically.
export function createShowAudioControls({ driver, panel, hint = null, defaultName = '', doc = document }) {
  const button = panel.querySelector('[data-audio-toggle]');
  const clock = panel.querySelector('[data-audio-clock]');
  const splat = panel.querySelector('[data-audio-splat]');
  const effect = panel.querySelector('[data-audio-effect]');
  const splatValue = panel.querySelector('[data-audio-splat-value]');
  const effectValue = panel.querySelector('[data-audio-effect-value]');
  const pick = panel.querySelector('[data-audio-pick]');
  const fileInput = panel.querySelector('[data-audio-file]');
  const nameLabel = panel.querySelector('[data-audio-name]');
  panel.hidden = false;
  let error = '', hintTimer = null, busy = false;
  // current track: the served default or a picked local file (blob URL)
  let track = { src: driver.media?.src ?? '', name: defaultName, blob: false };
  nameLabel.textContent = displayName(track.name);
  fileInput.accept = AUDIO_ACCEPT;

  async function loadFile(file) {
    if (!file) return;
    if (!isLikelyAudio(file)) { error = `不是音频文件：${displayName(file.name)}`; return; }
    const url = URL.createObjectURL(file);
    const previous = track;
    busy = true; error = ''; nameLabel.textContent = `载入中… ${displayName(file.name)}`;
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
  pick.addEventListener('click', () => { pick.blur(); fileInput.click(); });
  fileInput.addEventListener('change', () => { loadFile(fileInput.files?.[0]); fileInput.value = ''; });

  async function toggle() {
    const media = driver.media;
    if (!media || busy) return;
    button.blur(); // Space must not also re-click a focused button
    try {
      if (media.paused) await driver.play(); else driver.pause();
      error = '';
    } catch (err) { error = `播放失败：${err.message}`; }
  }
  const showHint = () => {
    if (!hint) return;
    hint.textContent = `粒子幅度 ${Number(splat.value).toFixed(2)}×`;
    hint.classList.add('on'); clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.remove('on'), 1200);
  };
  const onKey = (event) => {
    if (event.target.closest?.('input, select, textarea') || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.code === 'Space' && !event.repeat) { event.preventDefault(); toggle(); return; }
    // ↑/↓: particle music-motion amplitude (key repeat = keep changing)
    const dir = event.code === 'ArrowUp' ? 1 : event.code === 'ArrowDown' ? -1 : 0;
    if (!dir) return;
    event.preventDefault();
    splat.value = String(stepAmplitude(Number(splat.value), dir));
    paintSliders(); showHint();
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
      const label = playing ? '❚❚ 暂停音乐' : media?.ended ? '↺ 重新播放' : media?.currentTime > 0 ? '▶ 继续音乐' : '▶ 开始音乐';
      if (button.textContent !== label) button.textContent = label;
      const text = error || `${formatClock(media?.currentTime)} / ${formatClock(media?.duration)}`;
      if (clock.textContent !== text) clock.textContent = text;
    },
    dispose() { button.removeEventListener('click', toggle); doc.removeEventListener('keydown', onKey); driver.pause(); },
  };
}
