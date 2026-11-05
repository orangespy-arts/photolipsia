import { SCENES, sceneAssetUrl } from '../render/sceneCatalog.js';
import { sceneConfig } from '../render/sceneConfig.js';
import { advanceSceneSwitch, sceneSwitchState } from '../mapping/sceneSwitch.js';

const FADE_MS = 600;

// VJ scene switching: Start → fade to black, swap the splat in place, jump
// the camera to the new entrance, fade back in once the scene has loaded.
export function createSceneSwitcher({ stage, flight, startId, fade, label }) {
  let switchState = sceneSwitchState(Math.max(0, SCENES.findIndex((s) => s.id === startId)));
  let phase = 'idle', timer = null; // idle | fading | loading
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
      flight.setHome(sceneConfig(new URLSearchParams(`vj=1&scene=${s.id}`)).view);
      const next = new URL(location.href);
      next.searchParams.set('scene', s.id);
      next.searchParams.delete('view'); next.searchParams.delete('tf');
      history.replaceState(null, '', next);
      phase = 'loading'; show();
    }, FADE_MS);
  }

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
        phase = 'idle'; if (stage.ready) fade.classList.remove('on');
      }
      show();
    },
    dispose() { clearTimeout(timer); },
  };
}
