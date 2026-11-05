import { SCENES, sceneAssetUrl } from '../render/sceneCatalog.js';
import { sceneConfig } from '../render/sceneConfig.js';
import { advanceSceneSwitch, sceneSwitchState } from '../mapping/sceneSwitch.js';
import { skyFor } from '../mapping/skyPresets.js';
import { transitionState, startTransition, advanceTransition } from '../mapping/transition.js';

// VJ scene switching. The page's first load fades in from black; every Start
// after that runs a transition (mapping/transition.js, W2c): wait for the next
// beat, then either freeze-frame dissolve or particle scatter/gather — the
// scene swap and its loading hide behind the still frame or the scattered
// splats, never behind a black screen.
// onReady(sceneId) → view|null runs once a scene has loaded, before it is
// revealed, so an automatic entrance jump is never seen (W6b).
export function createSceneSwitcher({ stage, flight, startId, fade, label, still, getType = () => 'dissolve',
  onReady = () => null, skipFirstReady = false }) {
  let switchState = sceneSwitchState(Math.max(0, SCENES.findIndex((s) => s.id === startId)));
  let initial = true; // first page load: black → scene
  let tr = transitionState(), captureNow = false;
  const scene = () => SCENES[switchState.index];

  function show() {
    const s = scene(), n = `Scene ${switchState.index + 1}/${SCENES.length} · ${s.name}`;
    const busy = { wait: 'waiting for beat…', out: 'switching…', hold: 'switching…', load: 'loading…', in: 'switching…' }[tr.phase];
    label.textContent = stage.loadError ? `${n} · load failed: ${stage.loadError}`
      : initial ? `${n} · loading…` : busy ? `${n} · ${busy}` : `${n} · Start for next scene`;
  }

  function swap() {
    const s = scene();
    stage.swapSplat(sceneAssetUrl(s));
    stage.setSky?.(skyFor(s));
    flight.setHome(sceneConfig(new URLSearchParams(`vj=1&scene=${s.id}`)).view);
    const next = new URL(location.href);
    next.searchParams.set('scene', s.id);
    next.searchParams.delete('view'); next.searchParams.delete('tf');
    history.replaceState(null, '', next);
  }

  function arrive() {
    const view = onReady(scene().id);
    if (view) flight.setHome(view);
  }

  fade.classList.add('on');
  show();
  return {
    // fed with the flight snapshot: null while paused/loading, so presses
    // there never count (the pure state also requires a release first)
    input(pad) {
      const idle = !initial && tr.phase === 'idle';
      const r = advanceSceneSwitch(switchState, idle ? pad : null, SCENES.length);
      switchState = r.state;
      if (r.switched) tr = startTransition(tr, getType());
    },
    // sound: { hasSound, onset } for the beat gate
    update(dt, sound = {}) {
      if (initial) {
        if (stage.ready || stage.loadError) {
          if (stage.ready && !skipFirstReady) arrive();
          fade.classList.remove('on');
          initial = false;
        }
        show();
        return;
      }
      const r = advanceTransition(tr, { dt, onset: sound.onset ?? 0, hasSound: !!sound.hasSound,
        ready: stage.ready, failed: !!stage.loadError });
      tr = r.state;
      if (r.events.capture) captureNow = true; // taken after this frame renders
      if (r.events.swap) swap();
      if (r.events.arrived && stage.ready) arrive();
      still?.setAlpha(r.still);
      stage.setScatter?.(r.scatter);
      show();
    },
    // call right after the WebGL renders of this frame
    afterRender(sources) {
      if (captureNow) { still?.capture(sources); captureNow = false; }
    },
    get phase() { return initial ? 'initial' : tr.phase; },
    dispose() {},
  };
}
