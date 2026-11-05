import { advanceEffects, effectState, EFFECT_NAMES } from '../mapping/vjEffects.js';
import { loadHydra, createHydraStage } from '../render/hydraStage.js';
import { combineEffectDrive } from '../mapping/audioDrive.js';
import { advanceButtonFx, fxState, fxLabel } from '../mapping/buttonFx.js';

export function createVjEffects({ source, output, panel }) {
  const status = panel.querySelector('[data-effect-status]');
  const select = panel.querySelector('select');
  const previewButton = panel.querySelector('[data-effect-preview]');
  const resetButton = panel.querySelector('[data-effect-reset]');
  let state = effectState(), input = null, renderer = null, disposed = false, failed = false;
  let preview = false, wasActive = false, lastLabel = '', audio = null, bHeld = false, fx = fxState(), fxInput = null;
  panel.hidden = false;
  // options come from EFFECT_NAMES so the list never drifts from the presets
  select.replaceChildren(...EFFECT_NAMES.map((name, i) => new Option(`${i + 1}. ${name}`, String(i))));
  const reset = () => {
    state = effectState(state.preset); input = null; preview = false; fx = fxState();
    previewButton.textContent = '预览效果'; previewButton.setAttribute('aria-pressed', 'false');
    output.hidden = true;
  };
  function fail(error) {
    failed = true; reset(); renderer?.dispose(); renderer = null;
    status.textContent = `${error.message} · 已恢复原画，请刷新重试`;
    for (const element of [select, previewButton, resetButton]) element.disabled = true;
  }
  const onPreset = () => { reset(); state = effectState(Number(select.value)); };
  const onPreview = () => {
    preview = !preview;
    state = { ...effectState(state.preset), armed: true };
    previewButton.textContent = preview ? '结束预览' : '预览效果';
    previewButton.setAttribute('aria-pressed', String(preview));
  };
  const onVisibility = () => { if (document.hidden) reset(); };
  const onContextLost = event => { event.preventDefault(); fail(new Error('Hydra 图形上下文已丢失')); };
  select.addEventListener('change', onPreset);
  previewButton.addEventListener('click', onPreview);
  resetButton.addEventListener('click', reset);
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', onVisibility);
  output.addEventListener('webglcontextlost', onContextLost);
  loadHydra().then(Hydra => {
    if (disposed) return;
    try { renderer = createHydraStage({ Hydra, source, output }); }
    catch (error) { fail(error); }
  }).catch(error => { if (!disposed) fail(error); });
  return {
    // music drive from audioEffectDrive(); null = no show track
    setAudio(drive) { audio = drive; },
    get fx() { return fx; },
    setInput(pad) {
      // read before reset(): reset clears input, but B must keep muting music
      bHeld = !!pad?.buttons[1]?.pressed;
      fxInput = pad; // kept through reset(): buttonFx handles B itself
      input = pad;
      if (!pad && wasActive) reset();
      wasActive = !!pad;
      if (pad?.buttons[1]?.pressed) reset();
    },
    render(dt, ready) {
      if (disposed || failed) return;
      if (!renderer || !ready) { status.textContent = '正在准备 Hydra 与场景…'; lastLabel = ''; return; }
      let activeInput = input;
      if (preview && document.hasFocus() && !document.hidden) activeInput = { standard: true, triggers: [0.65, 0.65], buttons: [] };
      state = advanceEffects(state, activeInput, dt);
      fx = advanceButtonFx(fx, fxInput, dt);
      const display = combineEffectDrive(state, audio, bHeld);
      try { renderer.render(display, dt, fx); } catch (error) { fail(error); return; }
      select.value = String(state.preset);
      const label = `${state.preset + 1}/${EFFECT_NAMES.length} ${EFFECT_NAMES[state.preset]} · 拖影 ${Math.round(display.feedback * 100)}% / 扭曲 ${Math.round(display.distortion * 100)}%${fxLabel(fx) ? ` · ${fxLabel(fx)}` : ''}${state.armed ? '' : ' · 松开扳机与肩键准备'}`;
      if (label !== lastLabel) { status.textContent = label; lastLabel = label; }
    },
    dispose() {
      disposed = true; reset(); renderer?.dispose();
      select.removeEventListener('change', onPreset);
      previewButton.removeEventListener('click', onPreview);
      resetButton.removeEventListener('click', reset);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', onVisibility);
      output.removeEventListener('webglcontextlost', onContextLost);
    },
  };
}
