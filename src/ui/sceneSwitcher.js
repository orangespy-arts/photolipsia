import { SCENES, sceneAssetUrl } from '../render/sceneCatalog.js';
import { sceneConfig } from '../render/sceneConfig.js';
import { advanceSceneSwitch, sceneSwitchState } from '../mapping/sceneSwitch.js';
import { skyFor } from '../mapping/skyPresets.js';

const FADE_MS = 600;

// VJ scene switching: Start → fade to black, swap the splat in place, jump
// the camera to the new entrance, fade back in once the scene has loaded.
// onReady(sceneId) → view|null runs once a scene has loaded, before the
// fade-in, so an automatic entrance jump is never seen (W6b).
export function createSceneSwitcher({ stage, flight, startId, fade, label, onReady = () => null, skipFirstReady = false }) {
  let switchState = sceneSwitchState(Math.max(0, SCENES.findIndex((s) => s.id === startId)));
  // the page's first load goes through the same loading → ready path
  let phase = 'loading', timer = null, first = true; // idle | fading | loading
  const scene = () => SCENES[switchState.index];

  function show() {
    const s = scene(), n = `场景 ${switchState.index + 1}/${SCENES.length} · ${s.name}`;
    label.textContent = stage.loadError ? `${n} · 加载失败：${stage.loadError}`
      : phase !== 'idle' || !stage.ready ? `${n} · 正在加载…` : `${n} · Start 下一场`;
  }

  function begin() {
    phase = 'fading'; fade.classList.add('on'); show();
    timer = setTimeout(() => {
      timer = null;
      const s = scene();
      stage.swapSplat(sceneAssetUrl(s));
      stage.setSky?.(skyFor(s));
      flight.setHome(sceneConfig(new URLSearchParams(`vj=1&scene=${s.id}`)).view);
      const next = new URL(location.href);
      next.searchParams.set('scene', s.id);
      next.searchParams.delete('view'); next.searchParams.delete('tf');
      history.replaceState(null, '', next);
      phase = 'loading'; show();
    }, FADE_MS);
  }

  fade.classList.add('on');
  show();
  return {
    // fed with the flight snapshot: null while paused/loading, so presses
    // there never count (the pure state also requires a release first)
    input(pad) {
      const r = advanceSceneSwitch(switchState, phase === 'idle' ? pad : null, SCENES.length);
      switchState = r.state;
      if (r.switched) begin();
    },
    update() {
      if (phase === 'loading' && (stage.ready || stage.loadError)) {
        phase = 'idle';
        if (stage.ready) {
          if (!(first && skipFirstReady)) {
            const view = onReady(scene().id);
            if (view) flight.setHome(view);
          }
          fade.classList.remove('on');
        }
        first = false;
      }
      show();
    },
    dispose() { clearTimeout(timer); },
  };
}
