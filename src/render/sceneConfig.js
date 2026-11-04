import { parseVec3, parseView } from './framing.js';
import { parseNavigation } from './navigation.js';
import { sceneById, sceneAssetUrl } from './sceneCatalog.js';

// Ground and spawn are authored in final world coordinates.
// tf places the source splat in that world; it is not a world transform.
export function sceneConfig(url) {
  const vj = url.get('vj') === '1';
  const journey = !vj && url.get('journey') === '1';
  const play = !vj && (journey || url.get('play') === '1');
  const preset = url.has('scene') || vj ? sceneById(url.get('scene')) : null;
  const start = preset?.explorer;
  const flightView = vj && !url.has('splat') && start ? {
    camPos: start.spawn.map((v, i) => v + start.cameraOffset[i]),
    lookAt: start.spawn.map((v, i) => v + (i === 1 ? start.cameraOffset[1] : i === 2 ? -2 : 0)),
  } : undefined;
  const groundText = url.get('ground');
  const ground = groundText?.trim() ? Number(groundText) : NaN;
  const spawn = parseVec3(url.get('spawn')) ?? [0, -0.23, 0];
  const groundY = Number.isFinite(ground) ? ground : spawn[1];
  const offset = parseVec3(url.get('follow')) ?? [0, 1.6, 3.2];
  if (Math.hypot(offset[0], offset[2]) < 0.1) offset[2] = 3.2;
  return {
    play,
    vj,
    journey,
    staticEnvironment: vj || play || url.get('mode') === 'static',
    splatUrl: url.get('splat') ?? (preset ? sceneAssetUrl(preset) : (play ? '/splats/ruin1.ply' : '/splats/test.ply')),
    tf: url.get('tf') ?? undefined,
    view: parseView(url.get('view')) ?? flightView,
    explorer: {
      groundY, spawn: [spawn[0], groundY, spawn[2]], cameraOffset: offset,
      navigation: parseNavigation(url.get('nav')),
    },
  };
}
