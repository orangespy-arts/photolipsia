import { findSpawn } from '../mapping/spawnFinder.js';

// Per-scene automatic entrance (W6b), computed once from the loaded splat
// and cached by scene id. Returns a flight view { camPos, lookAt } or null.
export function createAutoSpawn({ stage }) {
  const cache = new Map();
  return {
    forScene(id) {
      if (cache.has(id)) return cache.get(id);
      const t0 = performance.now();
      const pts = stage.samplePoints();
      const spawn = pts ? findSpawn(pts) : null;
      const ms = Math.round(performance.now() - t0);
      // true distance to the nearest sampled splat (grid clearance is approximate)
      let nearest = Infinity;
      if (spawn) for (let i = 0; i < pts.length; i += 3) {
        nearest = Math.min(nearest, Math.hypot(pts[i] - spawn.camPos[0], pts[i + 1] - spawn.camPos[1], pts[i + 2] - spawn.camPos[2]));
      }
      const view = spawn ? { camPos: spawn.camPos, lookAt: spawn.lookAt } : null;
      // printed so a good result can later be baked into sceneCatalog.js
      console.info(`[spawn] ${id}: ${spawn ? `${spawn.mode} cam=${spawn.camPos.map((v) => v.toFixed(3))} look=${spawn.lookAt.map((v) => v.toFixed(3))} clear=${spawn.clearance.toFixed(3)} nearest=${nearest.toFixed(3)}` : 'none'} (${pts ? pts.length / 3 : 0} pts, ${ms} ms)`);
      window.__SPAWNS__ = { ...(window.__SPAWNS__ ?? {}), [id]: spawn && { ...spawn, ms, nearest } };
      cache.set(id, view);
      return view;
    },
  };
}
