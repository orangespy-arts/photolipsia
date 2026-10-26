# Development Log

一次工作一段，新的在上。

## 2026-10-26 — Stage 2: per-splat GPU audio deformation (dyno)

### What
- `src/render/avModifier.js`: a `dynoBlock` Gsplat→Gsplat modifier wired to
  `SplatMesh.objectModifier`. Audio state travels as 6 uniforms
  (uLow/uMid/uHigh/uOnset/uCentroid/uTime) updated per frame from JS;
  per-splat math runs in GLSL:
  - region-band scale pulse (mirrors mapping/visual.js regionEnergy,
    triangular weights 0.15/0.5/0.85 + 0.1 floor)
  - trig-wobble displacement scaled by band energy (breathing drift)
  - brightness response to band energy
  - hue rotation via custom statement Dyno (YIQ) — **written, bypassed**:
    colors went black through that path; needs an isolation test (Stage 2b)
- `stage.js` updateParams feeds uniforms with a light extra smoothing
  (dt*30 ramp) to avoid pops on live edits.
- Height mapping: object-space y is flipped by the y-down→y-up quaternion,
  so screen height = 0.5 − cy·0.5 (verified visually via the red zone).

### Dyno API lessons (hard-won, keep for Unity-era reference)
- `dyno.float(x)` is a **cast of a DynoVal**, NOT a literal constructor —
  numeric literals go through `dyno.dynoConst('float', x)`.
- `dyno.splitGsplat(g)` returns a Dyno node; fields live on `.outputs`
  (center/scales/rgba/rgb/opacity/x/y/z/...).
- DynoVals have no `.x/.y` JS accessors — components need `dyno.swizzle`
  or the pre-split outputs.
- `dyno.vec4(vec3val)` compiles to GLSL `vec4(v)` (alpha implicit) which
  fails validation ("not enough data for construction") — build vec4 via
  `dyno.combine({vectorType:'vec4', x,y,z,w})`.
- Custom GLSL: `new dyno.Dyno({ statements, globals })` works fine for
  inline helper functions (avHueShift lives in globals).
- `dynoBlock` construct callback receives `(inputs, outputs, {roots})` —
  inputs are used directly, not via `.outputs`.
- Full dyno API surface introspectable at runtime via the probe
  (`Object.keys(dyno)`).

### Verification
- `npm run check` OK; probe: shader compiles (only a benign
  signed/unsigned warning), 6500 splats, ready, breathing + wobble visible
  in screenshots (.check/probe.png), monitor bars live.
- User screenshots archived: `ai/stage1.png` (Stage 1 — static ring,
  whole-object breathing only) vs `ai/stage2.png` (Stage 2 — ring visibly
  warped by the wobble displacement, brightness pulsing). The ring is the
  tell: it deforms non-uniformly, which only per-splat displacement can do.

### Next
- Stage 2b: orientation A/B via mock ramp, hue isolation test, gain params.

## 2026-10-26 — Stage 1: Spark rendering, first splat breathing

### What
- Engine selection: **Spark** (`@sparkjsdev/spark@2.4.0`, MIT, World Labs,
  released 2026-10-20). Decisive factor: Dyno shader-graph compiles JS→GLSL
  running **on the GPU**, injected via `SplatMesh.objectModifier` — audio
  params as per-frame uniforms drive per-splat center/scales/rgba with zero
  CPU per-splat cost. Alternatives rejected: gsplat.js (fading, no per-splat
  mutation API), @mkkellogg/gaussian-splats-3d (static viewer, last release
  2025-01).
- Self-written test-splat generator `scripts/make-test-splat.mjs`
  (6500 splats: spectrum sphere red=low bottom → violet=high top + gray ring;
  3DGS binary .ply, SH DC coefficients, y-down convention). Doubles as a
  visual verification instrument for the Stage 2 region mapping. Course
  kit's equivalent script was downloaded-then-rejected: external code stays
  out of the repo.
- `src/render/stage.js`: three.js scene + Spark SplatMesh, y-down→y-up flip,
  Stage-1 global response (low-weighted breathing scale + onset punch,
  exp-smoothed toward target; hue shift stored but not yet applied —
  per-splat color belongs to the Stage 2 dyno, by design).
- `index.html`: fullscreen canvas + import map for three/spark bare imports.
- `scripts/check.mjs`: now auto-generates the test splat if missing.
- `scripts/serve.mjs`: added `/splats/*` → `public/splats/*` mapping
  (Vite convention our zero-dep server didn't have; 404 found via curl).

### Verification
- `npm run check` OK (16 tests + splat generation + module graph).
- Dev server: page 200, splat 200. Visual confirmation by user pending.

### Gotchas found
- Node 24 `node --test <dir>` doesn't expand directory args — use globs.
- Bare imports (`import from 'three'`) fail in the browser without a
  bundler; fixed with an import map in index.html pointing at
  `three/build/three.module.js` and `@sparkjsdev/spark/dist/spark.module.js`.
  This is the price of our zero-bundler setup; Vite is the fallback if the
  import map ever fights us.

### Open questions
- `splat.quaternion.array = [...]` — unverified Spark API for the y-down
  flip; check browser console / spark docs when user reports the visual.

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
