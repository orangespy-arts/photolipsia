# Development Log

一次工作一段，新的在上。

## 2026-10-26 — Stage 2b: hue rotation fixed, orientation verified, gain params

### What
- **灰度根因找到了**：不是自定义 Dyno 节点的问题（那个也真有问题，但被这个
  掩盖着）——是 `dyno.vec3(a, b, c)` 标量构造器本身产生错误输出。A/B 二分：
  ① hueAngle 钉 0（hueRotate 应恒等）→ 仍灰度，排除三角函数；② 换成纯
  swizzle→vec3 恒等重建 → 仍灰度，锁定 vec3 构造器；③ 对照 transcript 里
  colors-restored 版本，唯一差异就是中间那层 `dyno.vec3(...)`。
- 修复：`hueRotateChannels()` 返回三个**标量**通道 rp/gp/bp，直接进
  `dyno.combine({vectorType:'vec4'})`（此路径已验证可靠），不经任何 vec3
  构造。hue 重新启用，真实 centroid 驱动：`angle = (centroid−0.5)·π`。
- Probe 截图验证：mock centroid≈0.27 → 整体色相偏移 ~−40°（底部品红、
  顶部黄绿），ramp 模式下色相随 centroid 扫频连续旋转。颜色饱和、无灰度。
- `?gain=` URL 参数（`src/mapping/gains.js` + 单测）：`?gain=low=1.5,onset=2`
  逐字段乘增益、clamp 0..1；onset 乘峰不乘底；**gain=0 = 静音该字段**
  （第一版 `if (gains.x)` 把 0 当 falsy 跳过——0 是有意义的增益，改成
  `!== undefined` 判断，补了单测）。
- main.js 透传 `?kind=` 到 mock driver（ramp 调试入口）。
- probe.mjs 移除 dyno 内省临时块；avModifier.js 移除废弃的 HUE_GLSL 常量。

### Region orientation A/B（通过 ?gain= 隔离单频段）
- low-only（gain=high=0,mid=0,low=2）：球体下半鼓胀，下蛋形 ✓
- high-only（gain=low=0,mid=0,high=2）：上半鼓胀 ✓
- ramp 起点（low=0.58, high=0.02）：下坠形 ✓
- 结论：**low → 屏幕底部（暖色区）、high → 顶部（冷色区），取向正确**；
  同时验证了 gain 链路端到端工作（monitor 数值 0.375×2=0.75 可见）。

### Dyno API lessons（追加）
- `dyno.vec3(a,b,c)` / `dyno.vec4(vec3val)` 作**构造器**时输出错误
  （vec3 标量构造 → 灰度；vec4(vec3) → alpha 缺失编译错）。可靠路径：
  标量通道直接进 `dyno.combine({vectorType, x, y, z, w})`。
  wobble 位移里的 `dyno.vec3(wob1, m, wob2)` 恰好没暴露问题（位移对
  填充模式不敏感？），但按此结论应视为可疑——Stage 3 前替换掉。

### Verification
- `npm test` 22 绿（+6 gains）；`npm run check` OK；probe 无异常，
  截图存档 .check/（ab-low/ab-high/ramp-*）。

### Next
- Stage 3：web-audio driver（mic + file），auto-gain。
- 遗留：wobble 的 dyno.vec3 待换；自定义 Dyno 节点致黑根因仍 TBD
  （vec3 构造器问题解释了它的一部分症状，未必是全部）。

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
