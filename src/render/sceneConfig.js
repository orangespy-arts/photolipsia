import { parseVec3, parseView } from './framing.js';

// Ground and spawn are authored in final world coordinates.
// tf places the source splat in that world; it is not a world transform.
export function sceneConfig(url) {
  const play = url.get('play') === '1';
  const groundText = url.get('ground');
  const ground = groundText?.trim() ? Number(groundText) : NaN;
  const spawn = parseVec3(url.get('spawn')) ?? [0, -0.23, 0];
  const groundY = Number.isFinite(ground) ? ground : spawn[1];
  const offset = parseVec3(url.get('follow')) ?? [0, 1.6, 3.2];
  if (Math.hypot(offset[0], offset[2]) < 0.1) offset[2] = 3.2;
  return {
    play,
    staticEnvironment: play || url.get('mode') === 'static',
    splatUrl: url.get('splat') ?? (play ? '/splats/ruin1.ply' : '/splats/test.ply'),
    tf: url.get('tf') ?? undefined,
    view: parseView(url.get('view')) ?? undefined,
    explorer: {
      groundY, spawn: [spawn[0], groundY, spawn[2]], cameraOffset: offset,
    },
  };
}
