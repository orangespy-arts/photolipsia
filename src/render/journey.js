import { createSplatStage } from './stage.js';
import { createExplorer } from './explorer.js';
import { SCENES, sceneAssetUrl } from './sceneCatalog.js';
import { advancePortal, boundaryClearance, initialPortalState } from './portalState.js';
import { createPortalEffect } from './portalEffect.js';

export function createJourney({ canvas, startId, onLookStatus }) {
  let current = Math.max(0, SCENES.findIndex((s) => s.id === startId));
  let state = initialPortalState(), elapsed = 0, dt = 0, requested = false, disposed = false;
  const worlds = [null, null];
  const input = document.createElement('div');
  input.className = 'journey-input'; input.tabIndex = 0;
  input.setAttribute('aria-label', '探索场景：WASD 或方向键移动，右键拖动视角');
  document.body.append(input);
  const effect = createPortalEffect();
  const label = document.getElementById('journey-status');
  const button = document.getElementById('portal-open');
  label.hidden = false; button.hidden = false;

  function makeWorld(index, suppliedCanvas) {
    const surface = suppliedCanvas ?? document.createElement('canvas');
    surface.classList.add('journey-world'); surface.style.pointerEvents = 'none';
    if (!suppliedCanvas) { surface.setAttribute('aria-hidden', 'true'); document.body.append(surface); }
    surface.style.opacity = index === current ? '1' : '0';
    const profile = SCENES[index];
    const stage = createSplatStage({ canvas: surface, splatUrl: sceneAssetUrl(profile),
      spin: 0, staticEnvironment: true, interactive: false, splatBudget: 500000 });
    const explorer = createExplorer({ scene: stage.scene, camera: stage.camera, canvas: input,
      config: profile.explorer, isStageReady: () => stage.ready,
      onLookStatus: (message) => { if (index === current) onLookStatus(message); } });
    explorer.setEnabled(index === current);
    const world = { stage, explorer, canvas: surface, warmFrames: 0,
      started: performance.now(), timedOut: false, renderError: null };
    surface.addEventListener('webglcontextlost', (event) => {
      event.preventDefault(); world.renderError = 'Graphics context lost';
    });
    return world;
  }
  worlds[current] = makeWorld(current, canvas);
  const active = () => worlds[current];
  const targetIndex = () => 1 - current;
  const failure = (world) => world?.stage.loadError || world?.timedOut || world?.renderError;
  const warm = (world) => world?.stage.ready && world.warmFrames >= 12 && !failure(world);
  function retryOrRequest() {
    const index = targetIndex(), world = worlds[index];
    if (state.phase === 'opening' || state.phase === 'cooldown') return;
    if (failure(world)) {
      world.explorer.dispose(); world.stage.dispose(); world.canvas.remove();
      worlds[index] = makeWorld(index);
    }
    requested = true;
  }
  button.addEventListener('click', retryOrRequest);

  const explorer = {
    update(delta) { dt = document.hidden ? 0 : delta; active().explorer.update(dt); },
    updateParams(params) { active().explorer.updateParams(params); },
    setOnsetSize(value) {
      onsetSize = value;
      return active().explorer.setOnsetSize(value);
    },
    get navigationStatus() { return active().explorer.navigationStatus; },
    get position() { return active().explorer.position; },
    get view() { return active().explorer.view; },
    get ball() { return active().explorer.ball; },
    get seedsReady() { return true; },
    get grown() { return active().explorer.grown; },
    get coverage() { return active().explorer.coverage; },
    get plantAudioScale() { return active().explorer.plantAudioScale; },
  };
  let onsetSize = 1;
  let lastMessage = '';
  let lastRender = 0, frameCount = 0, frameTotal = 0;
  function render(time) {
    if (disposed || document.hidden) return;
    if (lastRender && active().stage.ready) {
      frameTotal += (time - lastRender) * 1000; frameCount++;
      if (frameCount >= 60) {
        label.dataset.frameMs = (frameTotal / frameCount).toFixed(1);
        frameCount = 0; frameTotal = 0;
      }
    }
    lastRender = time;
    elapsed += dt;
    const source = active(), nextIndex = targetIndex();
    // Start the second download only once the first world is usable.
    if (source.stage.ready && !worlds[nextIndex]) worlds[nextIndex] = makeWorld(nextIndex);
    const target = worlds[nextIndex];
    source.stage.render(time);
    if (source.stage.ready) source.warmFrames++;
    if (target && !failure(target)) {
      if (!target.stage.ready && performance.now() - target.started > 60000) target.timedOut = true;
      if (!warm(target) || state.phase === 'opening') {
        try {
          target.stage.render(time);
          if (target.stage.ready) target.warmFrames++;
        } catch (error) { target.renderError = error.message; }
      }
    }
    state = advancePortal(state, {
      dt, clearance: boundaryClearance(explorer.position.toArray(), SCENES[current].explorer.navigation),
      ready: warm(target), failed: Boolean(failure(target)), requested: requested && source.stage.ready,
    });
    requested = false;
    source.explorer.setEnabled(state.phase !== 'opening' && state.phase !== 'waiting');
    if (state.phase === 'opening') {
      target.canvas.style.zIndex = '1'; source.canvas.style.zIndex = '0';
      target.canvas.style.opacity = '1';
      effect.draw(target.canvas, state.progress, elapsed);
    } else if (!state.commit) {
      effect.clear();
      if (target) target.canvas.style.opacity = '0';
    }
    if (state.commit) {
      source.canvas.style.opacity = '0'; source.canvas.style.clipPath = 'none';
      source.explorer.setEnabled(false); source.explorer.reset(); source.warmFrames = 0;
      current = nextIndex;
      target.canvas.style.opacity = '1'; target.canvas.style.clipPath = 'none';
      target.explorer.setOnsetSize(onsetSize); target.explorer.setEnabled(true);
      effect.clear();
      const nextUrl = new URL(location.href);
      nextUrl.searchParams.set('scene', SCENES[current].id);
      history.replaceState(null, '', nextUrl);
    }
    const destination = SCENES[targetIndex()].name;
    const message = state.phase === 'error' ? '下一场景加载失败，仍留在安全区。可点击重试。'
      : state.phase === 'waiting' ? `正在准备${destination}，请稍候…`
      : state.phase === 'opening' ? `穿越中 · ${destination}`
      : `${SCENES[current].name} · 靠近边界自动开启传送门${warm(worlds[targetIndex()]) ? '' : ' · 下一场景准备中'}`;
    if (message !== lastMessage) { label.textContent = message; lastMessage = message; }
    label.dataset.scene = SCENES[current].id;
    label.dataset.phase = state.phase;
    label.dataset.position = explorer.position.toArray().join(',');
    label.dataset.residentWorlds = String(worlds.filter(Boolean).length);
    button.textContent = state.phase === 'error' ? '重试加载下一场景' : `传送至${destination}`;
    button.disabled = !source.stage.ready || state.phase === 'opening' || state.phase === 'cooldown' || state.phase === 'waiting';
  }
  function dispose() {
    if (disposed) return; disposed = true;
    button.removeEventListener('click', retryOrRequest);
    for (const world of worlds) if (world) { world.explorer.dispose(); world.stage.dispose(); world.canvas.remove(); }
    input.remove(); effect.dispose();
    window.removeEventListener('pagehide', onPageHide);
  }
  function onPageHide(event) { if (!event.persisted) dispose(); }
  window.addEventListener('pagehide', onPageHide);
  return {
    explorer, render, dispose,
    updateParams(params, delta) { active().stage.updateParams(params, delta); },
    get ready() { return active().stage.ready; },
    get loadError() { return active().stage.loadError || active().renderError; },
    get scene() { return active().stage.scene; },
    get camera() { return active().stage.camera; },
    get diag() { return { ...active().stage.diag, sceneId: SCENES[current].id,
      portal: { ...state }, nextReady: warm(worlds[targetIndex()]), residentWorlds: worlds.filter(Boolean).length }; },
  };
}
