import { advanceEffects, effectState, EFFECT_NAMES } from '../mapping/vjEffects.js';
import { loadHydra, createHydraStage } from '../render/hydraStage.js';

export function createVjEffects({ source, output, panel }) {
  const status = panel.querySelector('[data-effect-status]');
  const select = panel.querySelector('select');
  const previewButton = panel.querySelector('[data-effect-preview]');
  const resetButton = panel.querySelector('[data-effect-reset]');
  let state = effectState(), input = null, renderer = null, disposed = false, failed = false;
  let preview = false, wasActive = false, lastLabel = '';
  panel.hidden = false;
  const reset = () => {
    state = effectState(state.preset); input = null; preview = false;
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
    setInput(pad) {
      input = pad;
      if (!pad && wasActive) reset();
      wasActive = !!pad;
      if (pad?.buttons[1]?.pressed) reset();
    },
    render(dt, ready) {
      if (disposed || failed) return;
      if (!renderer || !ready) { status.textContent = '正在准备 Hydra 与场景…'; return; }
      let activeInput = input;
      if (preview && document.hasFocus() && !document.hidden) activeInput = { standard: true, triggers: [0.65, 0.65], buttons: [] };
      state = advanceEffects(state, activeInput, dt);
      try { renderer.render(state, dt); } catch (error) { fail(error); return; }
      select.value = String(state.preset);
      const label = `${EFFECT_NAMES[state.preset]} · 拖影 ${Math.round(state.feedback * 100)}% / 扭曲 ${Math.round(state.distortion * 100)}%${state.armed ? '' : ' · 松开扳机与肩键准备'}`;
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
