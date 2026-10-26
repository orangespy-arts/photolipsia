# Development Log

一次工作一段，新的在上。

## 2026-10-26 — Stage 0: repo skeleton

### What
- Initialized the standalone repo (decision: not the course fork; conventions
  borrowed from photolipsia-agentic-kit).
- AVParams protocol v1: `docs/protocol.md` (field spec, three iron rules,
  OSC address mapping) + `src/protocol/params.js` (emptyParams, sanitizeParams).
- Driver architecture: `src/drivers/registry.js` (pull-model interface,
  poll(now) → AVParams), first driver `src/drivers/mock.js` (pulse / ramp /
  silence synthetic signals).
- Mapping layer first pieces: `src/mapping/visual.js` (regionEnergy with
  0.1 floor — no dead regions, pulseScale, centroidHue) and
  `src/mapping/combine.js` (weighted multi-driver fusion, onset = max,
  events concatenated + tagged).
- Dev server `scripts/serve.mjs` (zero-dep static, port 5175) and
  `scripts/check.mjs` (unit tests + module-graph import smoke →
  `.check/report.json`).
- Front page `index.html` + `src/main.js`: driver selection via `?driver=`,
  bar-meter monitor of the protocol fields (`src/ui/monitor.js`).

### Verification
- `npm test` — 16 tests green (protocol shape, clamping, garbage tolerance,
  event filtering, registry, mock decay behavior, combiner, spatial mapping).
- `npm run check` — OK.

### Gotchas found
- Node v24 on this machine doesn't expand a bare directory arg for
  `node --test test/` — use the glob `node --test "test/**/*.test.js"`.
- First version of regionEnergy left dead zones at the extremes (y=0/y=1
  got zero energy for far bands); fixed with the 0.1 floor.

### Open questions
- Splat viewer library choice for Stage 1 (Spark vs gsplat.js vs
  gaussian-splats-3d) — evaluation criteria in strategy.md.
- Source of first test splats.
