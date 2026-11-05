import { formatClock } from '../mapping/audioDrive.js';

// VJ show-track transport + reactivity sliders. Audio needs a user gesture,
// so playback starts from the button (or Space) — never automatically.
export function createShowAudioControls({ driver, panel, doc = document }) {
  const button = panel.querySelector('[data-audio-toggle]');
  const clock = panel.querySelector('[data-audio-clock]');
  const splat = panel.querySelector('[data-audio-splat]');
  const effect = panel.querySelector('[data-audio-effect]');
  const splatValue = panel.querySelector('[data-audio-splat-value]');
  const effectValue = panel.querySelector('[data-audio-effect-value]');
  panel.hidden = false;
  let error = '';

  async function toggle() {
    const media = driver.media;
    if (!media) return;
    try {
      if (media.paused) await driver.play(); else driver.pause();
      error = '';
    } catch (err) { error = `播放失败：${err.message}`; }
  }
  const onKey = (event) => {
    if (event.code !== 'Space' || event.repeat || event.target.closest?.('input, select, textarea')) return;
    event.preventDefault(); toggle();
  };
  const paintSliders = () => {
    splatValue.textContent = Number(splat.value).toFixed(2);
    effectValue.textContent = Number(effect.value).toFixed(2);
  };
  button.addEventListener('click', toggle);
  splat.addEventListener('input', paintSliders);
  effect.addEventListener('input', paintSliders);
  doc.addEventListener('keydown', onKey);
  paintSliders();

  return {
    get splatAmount() { return Number(splat.value); },
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
