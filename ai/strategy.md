# Photolipsia — Strategy

The agent's memory: plan, decisions, next steps. Read this first.
Human-readable project intro lives in `README.md`.

## Goal

A **generic** Gaussian-splat audiovisual visualizer. Any DSP source can drive
it; the visualizer only knows the AVParams protocol (`docs/protocol.md`),
never the source. Built as plain ES modules + Vite-less static dev server,
zero dependencies for now.

## Architecture (agreed 2026-10-26)

```
any DSP source → driver (AVParams) → mapping (pure fns) → splat render
```

Four drivers: `web-audio` (mic/file/display audio), `osc` (WebSocket bridge
← UDP ← Max/SC/PD), `midi` (Web MIDI), `mock` (synthetic + recorded playback).

## Plan

- [x] Stage 0 — repo skeleton: AGENTS.md/CLAUDE.md, protocol doc + validation
      with unit tests, driver registry + mock driver, dev server, check script
- [x] Stage 1 — splat rendering: **Spark** selected (v2.4.0, MIT, World Labs;
      Dyno shader-graph = per-splat GPU mutation, the decisive factor; gsplat.js
      and @mkkellogg/gaussian-splats-3d rejected). Test splat renders
      fullscreen, breathing verified. Import map added (zero-bundler cost).
- [x] Stage 2 — mapping layer: protocol → per-splat transforms (scale pulse,
      displacement, color), pure functions + unit tests. **Core landed as GPU
      dyno graph** (`src/render/avModifier.js`): region-band scale pulse,
      trig-wobble displacement, brightness response — all per-splat on GPU
      via `SplatMesh.objectModifier`. Hue rotation written but bypassed
      (YIQ path blackened colors; re-enable with a color-isolation test).
- [x] Stage 2b — hue rotation fixed (root cause: `dyno.vec3(a,b,c)`
      constructor corrupts output; rotated channels go straight into the
      vec4 combine — see log). Orientation verified via `?gain=` A/B
      (low → screen bottom ✓). `?gain=low=1.5,...` live-tuning params
      landed with unit tests; gain=0 mutes a field.
- [x] Stage 3 — web-audio driver (mic + file), auto-gain normalization,
      onset-grid beat estimation with HUD toggle (3a–3g complete)
- [x] Stage 4 — osc driver + dumb UDP↔WebSocket bridge (Node); E2E
      verified by user (test-sender → bridge → browser, monitor bars live)
- [x] Stage 5 — midi driver: note→events+onset, CC table→continuums,
      clock→beatPhase (real beat source); + simulate=1 scripted
      performance (no hardware needed); +6 sim/full-chain tests (94 total)
- [x] Stage 6 — param recorder/playback (.jsonl ring buffer → exact-frame
      binary-search playback driver, loop/t0), HUD rec button + ? help;
      E2E round trip verified by user
- [ ] Stage 7 — performance hardening: fixed 60fps path, latency check,
      multi-screen, full-offline rehearsal checklist
- [ ] Track 2 — minimal Unity project: URP + UnityGaussianSplatting +
      OSC listener (Room of Sounds OSC.cs), `/av/band/low` → splat scene
      breathing; protocol doc copied over as source of truth

## Decisions

- 2026-10-26: standalone repo, **not** the course fork; course conventions
  (AGENTS.md, strategy.md, check script) are borrowed but content is ours.
- 2026-10-26: pull-model drivers — render loop polls `driver.poll(now)`;
  smoothing/envelope/normalization belong to the driver, never the mapping.
- 2026-10-26: protocol v1 fields fixed in docs/protocol.md; sanitize on every
  untrusted ingress (OSC bridge, recordings).
- 2026-10-26: zero dependencies until splat rendering forces one (Stage 1).
- 2026-10-26 (revised): **two-track plan** — Unity is the live-performance
  destination; this web repo is its lab (cheap iteration on protocol/mapping)
  and the course deliverable. Unity project starts minimal (URP +
  UnityGaussianSplatting + OSC listener) and grows in parallel. Protocol doc
  is the single source of truth shared by both tracks.

## Next

- 2026-10-30：目录场景与边界传送闭环已实现；首页“开始探索 · 粒子传送门”进入 ?journey=1。已实际验证两个场景加载、前向自动触发、手动往返、输入恢复；164 项测试通过。下一步是扩大安全通道前的精确障碍/地形校准，以及完整过渡性能/显存实测，不能宣称任意扫描表面绝不穿透。
- 2026-10-30：首页“进入僵尸城”入口已接入（P2a）；启动或重启预览服务后可点击加载。实际取景尚未验证；随后继续 P1b 校准与双场景过渡。
- 2026-10-30：go 已收到；P1a 安全逻辑已实现，P1b 第一场景实景校准待完成。本地 5173–5180 无监听；需用户启动 npm run dev 后继续 P1b，再进入 P2。C3 性能工作并入 P4 的双场景实测。

- 玻璃球修订已完成（半径 0.22，透明反光近似）；下一步仍为 C3 性能实测。

- 2026-10-27 连贯体验 C1 已实现并通过自动检查；C2 用户指定的透明球、静态环境与实体叶片已实现并浏览器查看。下一步 C3 性能实测；地形碰撞及 HUD 收起仍待后续，每回合一步。
- ~~附记 4 跑图球~~ 已落地（`?play=1` 原型可玩）。下一步候选（等用户选）：
  跑图手感调参（速度/相机距离/复绿半径）、多场景机制规划（portal +
  场景清单，等第一批 AI 场景）、地面高度逐场景配置（`?ground=` 或清单）。
- ruin1 文件本身的绿/品红色偏仍是 Marble 导出问题——修复路径：Marble
  侧重导或文件预处理。
- **7e（暂缓待办）**：用户本机跑 `docs/rehearsal.md` 彩排清单——离线
  验证（断网全流程）、双屏物理验证、故障切换演练。条件允许时再做，
  做完写 Stage 7 log 收尾。
- ~~Track 2 — Unity project~~ **搁置（2026-10-27）**：演出方向改为
  多场景跑图（见 2026-10-27 附记 3），机制先在 Web 端跑通，Unity 需求
  等机制定了再评估。协议文档不变；重建路径见 docs/unity-setup-guide.md。

## Track 2 plan — minimal Unity project (drafted 2026-10-26, **SHELVED 2026-10-27**)

Goal: the performance destination gets a pulse. A minimal Unity project
(URP) hosting UnityGaussianSplatting, receiving OSC from a UDP listener,
mapping `/av/*` addresses to a splat scene breathing. The web repo stays
the lab; Unity becomes the live show.

Key constraints/decisions:
- **Protocol doc is the contract**: copy `docs/protocol.md` into the
  Unity project (`Docs/protocol.md`) at setup — any Unity-side mapping
  ambiguity is resolved against it, not re-decided.
- **OSC.cs from Room of Sounds** as the listener (the user's known-good
  reference); no third-party OSC asset.
- **Iron rules apply unchanged** — driver-side smoothing stays on the
  sender side (web-audio driver etc.); Unity consumes complete frames
  and maps only. Smoothing added inside Unity = protocol violation.
- One Unity mapping behavior per step, testable by eye with the
  existing `scripts/osc-test-sender.mjs` (it already speaks the protocol).

- [ ] 2.0. **Project skeleton**: Unity version pin (LTS, URP template);
      drop UnityGaussianSplatting in (git submodule or vendored — decide
      when we see how it wants its splat assets); a single scene with one
      splat asset; `Docs/protocol.md` copied. Acceptance: splat visible
      in Play mode, no console errors.
- [ ] 2.1. **OSC listener**: OSC.cs wired on a UDP port (match the
      bridge's 9129? — no: the DSP side sends UDP directly; pick 9000
      default, documented), address→float table accumulated per frame,
      `/av/*` only, unknown addresses ignored. Acceptance: a debug HUD
      or inspector shows live `/av/band/low` values while test-sender
      runs.
- [ ] 2.2. **Frame assembly + sanitize**: values clamped to 0–1 on
      ingress (iron rule 2 enforcement point on this side), missing
      fields → 0 (silence, never stale). Acceptance: sender stops →
      values decay/drop, never freeze (same release-decay question as
      the web osc driver — reuse its decision: no packets for 0.5s →
      release-decay toward 0).
- [ ] 2.3. **First mapping — breathing**: `/av/rms` → global splat scale
      pulse (the web repo's pulseScale equivalent, CPU-side since
      UnityGaussianSplatting mutation is C#-side; start with a single
      global multiplier before per-splat work). Acceptance: test-sender
      ramp makes the splat breathe on the beat.
- [ ] 2.4. **Verify — user**: run bridge-free path (DSP → UDP → Unity
      directly) with test-sender; user confirms breathing and that
      silence is still. Then decide next: per-band regions (like web
      mapping) or on to the show.

Non-goals: no per-splat GPU mutation yet (Unity side starts CPU/global),
no timeline/sequencer, no visual parity with the web repo.

## Stage 7 plan — performance hardening (drafted 2026-10-26, GO received)

Goal: the web repo becomes a dependable live instrument — predictable
frame rate, known latency, multi-screen capable, and a rehearsal checklist
that proves it runs fully offline.

- [x] 7a. **Frame-rate audit** (`scripts/probe.mjs --fps`): 300-frame
      rAF timing audit → fps/p50/p95/max + >34ms count, PASS/FAIL exit
      code. Result: **60.0fps, p95 16.8ms, max 16.9ms, 0 frames >34ms —
      PASS on first run**. No suspects needed fixing (monitor DOM writes
      and ring-buffer shift are cheap at these sizes).
- [x] 7b. **Latency measurement** (`scripts/probe.mjs --latency`): mock
      onset jump → canvas pixel response, sampled per frame via a
      drawImage strip. Result: **~16.5ms mean (n=2) — exactly one frame**,
      the architectural floor (uniform update in frame N renders in N+1).
      Driver-side numbers documented in docs/rehearsal.md §5. Hook:
      main.js sets `window.__LAST_ONSET__` per frame.
- [x] 7c. **Multi-screen**: Spark has no native multi-viewport; the
      supported path is one fullscreen window per output. Verified two
      concurrent probe instances each hold 60fps p95 16.8ms — no
      cross-window contention at this splat count. Physical two-monitor
      confirmation left to the user (needs real displays).
- [x] 7d. **Full-offline rehearsal checklist** (`docs/rehearsal.md`):
      pre-gig steps (npm ci → fps audit → splat present), offline
      verification (all imports resolve to local node_modules — no CDN,
      the zero-dependency decision pays off), driver-specific rehearsals
      each with a recorded fallback, failover drill (kill live source →
      playback takes over), known-latency section, show-day flow.
- [ ] 7e. **Verify — user**（暂缓 2026-10-26：用户暂时无法本机验证，
      移入 Next 待办）：run the docs/rehearsal.md checklist on this
      machine, including the offline pass (disconnect network, full show
      flow) and, when two monitors are available, the multi-screen path.

Non-goals: no WebGPU migration, no worker-thread DSP, no new drivers.

## Stage 6 plan — recorder/playback + session UI (drafted 2026-10-26, GO received)

Goal: record any driver's AVParams frame stream to `.jsonl`, play it back
later through the normal pipeline (`?driver=playback`). Use cases: show
fallback (record a good take, replay it when the live source dies),
offline visual tuning against a real performance, regression material
for the mapping layer.

- [x] 6a. **Pure recorder** (`src/rec/record.js`): createRecorder ring
      buffer (default 18000 frames = 60Hz×5min), add/length/dropped/
      toJSONL; recordingName() sortable filenames. Format = the protocol
      frame itself, one JSON object per line.
- [x] 6b. **Pure playback reader** (`src/rec/play.js`): parseRecording —
      garbage lines (JSON errors AND sanitize errors) dropped whole and
      counted (stricter than clamping: a recording that fails validation
      is suspect); time-ascending sort defensively; frameAt binary
      search, exact-frame semantics (last frame with time ≤ t; before
      start → null). No smoothing added — recorded frames are already
      driver-smoothed (iron rule 1 across the round trip).
- [x] 6c. **Playback driver** (`src/drivers/playback.js`): wall clock →
      recording time anchored at first poll, `?t0=` offset, loop by
      default (wrap), no-loop clamps+holds. Frames re-emitted verbatim,
      source-tagged 'playback', never mutated.
- [x] 6d. **Record wiring**: HUD `rec: off/●/time` toggle records
      post-gain (render-visible) frames; stop → Blob download with
      recordingName filename; status shows saved count.
- [x] 6e. **Verify**: `npm test` 107 green (+8 rec, +5 playback driver);
      round-trip, ring buffer, garbage tolerance, loop/offset semantics,
      untrusted-file gate all tested. **Remaining: user E2E** — record
      ~30s, download, `?driver=playback` + file picker (or drop the file
      in `public/rec/` + `?rec=name`), watch the same performance replay.
- [x] 6f. **Session UI polish**: HUD button row (beat / rec / ?), `?`
      help panel listing every URL param.

Non-goals: no compression (jsonl of 60Hz frames ≈ 20MB/h — fine for
5-min performance capture; revisit if sessions get long), no server-side
storage, no audio recording (visual params only).

## Stage 5 plan — MIDI driver (drafted 2026-10-26, GO received)

Goal: `?driver=midi` — a MIDI controller/keyboard drives the splats live.
Web MIDI API (Chrome/Edge; permission model like web-audio: lazy load,
ask only when selected). Unlike web-audio (we analyze), here the *device*
is the DSP side: note velocity IS the normalized value (0–127 → /127),
protocol iron rule 2 mostly comes free — the driver's job is assembly,
not analysis.

- [x] 5a. **Pure MIDI→AVParams core** (`src/drivers/midi/midiCore.js`,
      Node-testable): note on (vel>0) → event + velocity-scaled onset
      charge; note off (incl. vel-0 note-on per MIDI spec) → velocity-0
      event; CC_MAP {1,11→mid, 64→high, 74→centroid} with follower
      smoothing on band targets, centroid direct; pitch bend 14-bit →
      centroid; clock 0xF8 → beatPhase = ticks%24/24 (real beat source),
      0xFA/0xFB reset ticks, stall >2s → clockInactive → phase 0.
      Channel bits ignored. poll() assembles complete frames (iron rule 3).
- [x] 5b. **Browser wrapper** (`src/drivers/midi/index.js`):
      requestMIDIAccess({sysex:false}), binds ALL inputs, routes with
      ev.timeStamp/1000 as atSec (same performance.now clock), hot-plug
      via onstatechange, device list exposed for the status line.
- [x] 5c. **Wire-up**: `?driver=midi` lazy import; status line shows
      connected device names.
- [x] 5d. **Verify**: `npm test` 88 green (+15 MIDI), `npm run check` OK
      (midiCore in import smoke). **Remaining: user verifies with a real
      controller** — keys → onset punch + note events in monitor; mod
      wheel → mid swells; sustain → high presence; sequencer clock →
      beat row stepping at true tempo.

Non-goals held: no MPE, no sysex, no per-note polyphonic expression.

Non-goals: no MPE, no sysex, no per-note polyphonic expression, no
audio-rate MIDI. Events stay sparse/protocol-shaped (no per-splat notes
yet — that's a mapping-layer question for later).

## Stage 4 plan — OSC driver + dumb bridge (drafted 2026-10-26, GO received)

Goal: Max/SC/PD sends OSC over UDP → Node bridge relays raw packets over
WebSocket → browser osc driver decodes and assembles AVParams. The bridge
stays dumb (forwards bytes, understands nothing) per protocol doc; OSC
decoding lives in the browser driver, as pure testable modules.

- [x] 4a. **Minimal OSC decoder** (`src/drivers/osc/oscDecode.js`, pure,
      zero-dep): typetags `i f s b`, strict 4-byte alignment, bundles
      (#bundle, timetag skipped — immediate processing), nested bundles
      flatten. Malformed input throws OscError (drop packet, never crash
      the loop). 13 tests incl. hand-built byte packets.
- [x] 4b. **Address→AVParams mapping** (`src/drivers/osc/oscMap.js`, pure):
      OscFrameAssembler — feed(msg) accumulates, takeFrame(now) returns a
      sanitized frame and resets (stale values never leak across frames;
      absent fields fall back to 0). Unknown addresses ignored. 6 tests.
- [x] 4c. **Bridge** (`scripts/osc-bridge.mjs`, Node, zero-dep): dgram UDP
      + hand-rolled minimal RFC6455 WS server (handshake, binary frames
      out, ping/pong, client frames read+discarded). Every UDP packet
      broadcast verbatim. `--udp/--ws` flags (default 9129/9128).
- [x] 4d. **Browser driver** (`src/drivers/osc/index.js`): WS client with
      exponential-backoff reconnect (0.5→8s). Link-death guard: no packets
      for 0.5s → all fields release-decay toward 0, centroid to neutral
      (a dropped link must not freeze visuals in a stuck pose). OscError
      packets dropped silently, real errors surface.
- [x] 4e. **Wire-up**: `?driver=osc&osc=localhost:9128` lazy-imported in
      main.js. Test sender `scripts/osc-test-sender.mjs` (8s scripted loop
      at 60Hz: ramp + centroid sweep + 120bpm kick). Smoke test
      `scripts/smoke-osc-bridge.mjs` (spawn bridge → UDP packet in →
      assert verbatim WS out → exit) — **passed**.
- [x] 4f. **Verify**: `npm test` 73 green (+19 OSC), `npm run check` OK
      (oscDecode/oscMap in import smoke). **Remaining: user end-to-end** —
      run bridge + test-sender + browser, monitor bars must move; then
      optionally with real Max/SC.

Non-goals: no bidirectional OSC (visual→DSP) yet; no timetag scheduling;
no TCP OSC.

## Stage 3 plan — web-audio driver (drafted 2026-10-26, GO received)

Goal: `?driver=web-audio` drives the splats from real sound — mic or an
audio file — through the AVParams protocol, with auto-gain so quiet/loud
rooms both produce full-range visuals.

- [x] 3a. **Pure DSP core first, unit-tested** (`src/drivers/webaudio/dsp.js`):
      band binning (protocol edges), energy = band's share of total spectral
      energy (sqrt-compressed — shares are scale-free), centroid on a true
      log 20Hz–20kHz scale (silence → neutral 0.5), flatness with relative
      floor (sparse tone reads tonal, silence → 0), spectral flux +
      adaptive running mean/variance for onset ratio.
- [x] 3b. **Auto-gain** (`src/drivers/webaudio/autogain.js`): per-field
      decaying peak tracker (instant rise, tau=8s decay, warmup holds the
      first peak, 0.02 floor) → divide + clamp. centroid/flatness pass
      through (scale-free by construction).
- [x] 3c. **Driver wrapper** (`src/drivers/webaudio/index.js`):
      AudioContext + AnalyserNode (fftSize 2048, smoothingTimeConstant 0 —
      we own smoothing), mic via getUserMedia (echoCancellation etc. OFF)
      or file via MediaElementSource (loops, also connected to destination).
      dB→linear magnitude conversion happens here. poll(now) full pipeline.
      Smoothing/envelope/autogain all in-driver per iron rule 1.
- [x] 3d. **Wire-up**: main.js lazy-imports the driver only when
      `?driver=web-audio` (`?source=mic|file`, file picker via dynamic
      input element; cancel handled). Mock stays default; registry keeps
      sync registration for the common case.
- [x] 3e. **Cleanup carried in**: `dyno.vec3(wob1, m, wob2)` replaced with
      per-component `dyno.combine({vectorType:'vec3', x,y,z})` on swizzled
      center — the proven-reliable path.
- [x] 3f. **Verify**: unit tests + check green (54 tests incl. beat).
      **Remaining: user listens/looks** — mic → bass pulses the bottom,
      hi-hats flicker the top, hits punch; `?source=file` with an audio
      file; confirm autogain makes a quiet room still move the splats.
- [x] 3g. **Beat estimation from onsets** (`src/drivers/webaudio/beat.js`,
      user-requested): pure onset-grid autocorrelation — scan candidate
      periods 60–300 BPM against a 6s onset window, densest consistent
      grid wins; phase anchored at the last onset (onset = phase 0);
      confidence = alignment score × missed-beat decay, gated at 0.6 so
      speech never drives beatPhase (stays protocol-0). UI toggle button
      in the HUD (`beat: on/off`), runtime switchable via
      driver.setBeatEnabled(); `?beat=0` starts off. 8 new tests.

Non-goals: no OSC/MIDI yet, no recording, no fancy latency tuning (Stage 7).

## 2026-10-27 附记 — 自定义 splat 场景接入（用户扫描件）

- 用户新扫描的视频 3DGS 训练件（951,554 splats，226MB，标准 62 属性
  二进制 PLY）已接入：拷到 `public/splats/scan.ply`（**本地文件，不进
  git**——AGENTS.md 禁大二进制）。
- 新参数：`?view=look@cam`（自定义场景相机基准，如
  `?view=0.26,1.3,-0.2@0.26,1.5,5`）、`?spin=0`（关掉 idle 自转——
  扫描件不该被转）。默认 test.ply 路径不受影响。
- 取景教训：扫描场景本体在 y≈1.13–1.56（ ply 顶点百分位实测），
  默认相机 (0,0.4,4.5) 看原点 → 场景缩在左上角。`?view` 用实测
  中心 (0.26,1.3,-0.2) 对准即可。相机距离 1.8 会钻进场景过曝，
  5 左右框住全场景。
- `npm test` 107 绿。Unity 工程已由用户建在
  `photolipsia-unity/`（6000.3.9f1）——**位置待定**（在 Web 仓库
  里面还是移出去），定下来后继续 Track 2 步 2.0。

## 2026-10-27 附记 2 — 交互取景 + ?tf= 模型变换（交互式取景完成）

- 用户要求"像 3D 软件一样调整模型位置和大小"。落地三层：
  1. **鼠标取景**：左键拖 = orbit、右键/Shift 拖 = pan、滚轮 = dolly。
     手写 ~80 行（不引 OrbitControls，零依赖惯例保持）。仅在 ?spin=0
     时激活——idle 自转和拖拽会打架。
  2. **?tf=x,y,z@rx,ry,rz@s**：splat 本体变换（位置@欧拉角(度)@均匀
     缩放），缺省段回静息态。呼吸缩放改为**乘以** tf 基准缩放而非覆盖。
  3. **copy framing 按钮**：把当前相机（?view）+ 变换（?tf）+ spin=0
     序列化回 URL 复制——调好的取景是可分享的 URL，不靠截图抄数字。
- 纯解析层 `src/render/framing.js` + 13 个单测（parseVec3 严格三有限数、
  空段拒绝、fmtTf 静息态输出空串省参数）。
- E2E：合成 CDP pointer 事件验证 orbit/pan/wheel 都动相机、复制链接
  重载后取景精确复原。全程 headless。
- 调试教训：`[...threeEuler]` 不可迭代（Euler 无迭代器），序列化要用
  `.x/.y/.z`；`__DIAG__` 原是加载时快照，probe 读不到拖拽后的相机——
  改为 live getter。
- `npm test` 120 绿（+13 framing）。

## 2026-10-27 附记 4 — 第三人称跑图球（GO received 2026-10-27）

用户请求："第三人称的球，可以跑图的，球经过的地方长出绿叶，上下左右键移动"。
这是跑图演出的第一个可玩原型（探索者 + 复绿机制），不是最终演出形态。

**核心机制设计：**

- **球**：three.js 常规网格（`SphereGeometry` + 基础材质，自发光小球），
  不用 splat——它是演员，场景才是 splat。第三人称相机跟在球后上方
  （lookAt 球，位置 = 球位 + 后偏移，带阻尼跟随）。
- **移动**：方向键（↑↓←→）在**相机朝向的地面平面**上移动（按下方向
  相对相机 yaw 解出世界方向），球贴地滑动 + 移动时自转（滚动感）。
  地面高度：不引入物理引擎——用场景地形的近似（ruin1 是室内地牢，
  y≈0 平面起步，逐场景可配 `?ground=` 或场景清单字段）。
- **复绿（长绿叶）**：预生成一批"种子 splat"（绿色叶片状小高斯，
  程序化生成 ~2-5k 颗，一次性生成进 `public/splats/green-seeds.ply`，
  复用 make-test-splat.mjs 的写 PLY 路径）。种子**平时不可见**
  （opacity≈0），球经过时其附近种子的 opacity 以每帧增量的方式升起
  （CPU 侧直接改 Spark splat 数据数组，或者用第二个 SplatMesh +
  per-splat uniform 距离场）。选 CPU 直改：种量小（千级），每帧只
  更新激活邻域，60fps 无压力，且逻辑全可单测。
  - 复绿映射纯函数 `src/mapping/greening.js`：`bloom(spots, ballPos,
    radius, dt) → 每 spot 的新透明度`——球位置 + 种子位置 → 距离衰减
    升透明度，纯、可测，渲染层只喂参数。
- **音频联动（协议不变）**：onset → 球发光脉冲（材质 emissive）；
  band → 复绿半径/速度增益（低音 = 大范围涌出）。仍是映射层纯函数。
- **相机/模式切换**：`?mode=explore`（或 `?play=1`）进入跑图模式；
  此模式下禁用 idle spin 与拖拽 orbit（相机被球占用）。
  默认观赏模式完全不变。
- **场景**：先用现有 ruin1.ply 当第一张图，方向键在废墟里跑，
  身后长绿。场景清单/多场景切换（portal）不在本步。

**步骤：**

- [x] 4a. 纯函数先行：`src/mapping/greening.js`（种子位置表 + 球位 +
      参数 → 每 seed 目标 opacity/增量），单测覆盖：未经过=0、经过后
      按距离升起、离开后保持（复绿是单向不可逆）、audio 增益作用。
- [x] 4b. 种子生成：`scripts/make-green-seeds.mjs`（程序化叶片小高斯，
      贴地散布在 ruin1 地面范围内——从 ruin1.ply 顶点采样地面区域），
      输出 `public/splats/green-seeds.ply`（本地，不进 git）。
- [x] 4c. explore 模式（`src/render/explorer.js` 新文件）：球网格 +
      键盘输入状态机 + 阻尼跟随第三人称相机 + 贴地 y；种子 SplatMesh
      常驻场景，每帧调 greening 更新其 opacity 数组（只写变化的 splat）。
- [x] 4d. main.js 接线：`?play=1` 启用；stage 传入 `interactive: !play`
      禁用拖拽 orbit/wheel（相机是球的）；帮助面板加 `&play=1` 行；
      copy framing 在该模式下隐藏。默认路径行为不变。
- [x] 4e. 验证：`npm test` 131 绿（120+11 greening）+ `npm run check` OK；
      新增 `scripts/probe-explorer.mjs`（CDP Input.dispatchKeyEvent 真实
      键盘路径）：按住 ↑ 3 秒 → 球从 (0,-0.23,0) 走到 (0,-0.23,-5.02)，
      追相机跟随，grown 种子 106→446（含等待期起点 bloom），coverage
      0.056；截图 .check/explorer-before.png / explorer-after.png；默认
      路径 probe 相机不受影响（camPos 停在 (0,0.4,4.5)）。

## 2026-10-27 附记 3 — 原生颜色 + 只抖动模式（用户请求，待 go）


用户请求："所有互动方式都不改变，颜色保持原生的颜色，只抖动"。
解读：交互层（拖拽取景、驱动切换、录制回放、URL 参数）全部不动；音频
视觉响应里**颜色相关的全关**（亮度响应、hue 旋转）、**缩放响应也关**
（per-splat band 脉冲/onset punch、整体呼吸缩放），唯一保留的是
**位移抖动**（wobble）。默认路径（不带新参数）行为完全不变。

注意：ruin1 的绿/品红色偏是 Marble 导出管线烤进文件的（上段日志已诊断
为文件层问题），本改动不改文件颜色；修复路径仍是 Marble 侧重导或
预处理。这里只保证渲染层不额外动颜色。

- [x] 3a. `?mode=shake`：main.js 解析 → createSplatStage →
      createAvModifier。shake 模式下 dyno 图：rgb 原样进 rgba（无亮度乘、
      无 hue 旋转）、scales 原样（无脉冲）、仅 center wobble 保留
      （bandEnergy + uTime 驱动；onset 并入抖动幅度——敲击=猛抖）。
      stage.js 整体呼吸缩放在此模式恒定 = tfScale。
- [x] 3b. 验证：`npm test` 120 绿；probe A/B——同一 ramp 帧，
      ?mode=shake 颜色原生、splatScale=1；默认路径满屏色偏 +
      splatScale 1.03（旧行为不变）。截图 .check/shake-ramp.png /
      default-ramp.png。

## 2026-10-27 — 美学、性能与连贯体验（GO received，C1 已实现）

目标：以“探索废墟、声音唤醒植物”为统一体验；保留原生场景色彩，
优先稳定空间、输入与声音因果关系。实施进度见以下清单。

- [x] C0. 静态审查渲染、探索、复绿、音源切换及 HUD；实时画面和当前场景性能未验证，历史 60fps 不能作为本轮性能结论。
- [x] C1. 单场景连贯性：修正左右输入符号，失焦清键，场景配置统一出生点/地面/变换/相机；初始化等待场景与种子就绪。135 项测试通过，包含 30/60/144Hz 运动和跟随数学测试；check OK。真实场景视觉与手感尚未验证。
- [x] C2. 按用户明确方向收敛：探索球全透明、锚点与植物共用地面、环境完全静止，实体茎叶逐渐生长留存；浏览器已看到绿叶。HUD 收起与复杂地形碰撞留待后续。
- [ ] C3. 性能基线与热点：固定场景/路径/分辨率记录帧时间分布及长帧；种子空间索引+变化索引，复用临时对象，HUD 降频；测量纹理更新成本后决定是否迁移 GPU。
- [ ] C4. 会话连续性：音源热切换、错误恢复与加载状态；相机/复绿状态保留；统一 driver 平滑与过渡职责，避免重复平滑造成响应延迟。
- [ ] C5. 多场景：预加载、统一尺度及入口出口方向、保留音频时钟与进度；过渡前验证内存峰值和旧资源释放，再验证连续游玩。

决策：先单场景体验，再多场景；不新增依赖，不改 AVParams 协议。
决策：动态分辨率、资产精简、GPU 复绿均由实测瓶颈决定，不预设收益。
决策：本轮只写分析计划；按照 AGENTS.md，收到 go 后才改实现代码。
决策（C1）：用户 go 已收到；本轮只实施 C1，不提前开展 C2–C5。
决策（C1）：地面、出生点和种子均采用最终世界坐标；tf 只定位扫描件，不自动推断或旋转地形。自定义场景需提供匹配种子与地面配置。
决策（C1）：探索默认 ruin1，观赏默认 test；加载期间不接收移动，种子加载失败显示错误；相机直接初始化到出生点，消除开场飞入。
决策（C1）：运动采用阻尼方程精确积分，相机使用指数跟随；没有引入依赖或更改音频协议。

## C2 用户明确方向 — 2026-10-27（延续已授权美学步骤）

- [x] C2a. 探索球完全透明（不可见），中心严格为 ground + radius；保留移动和跟随。
- [x] C2b. 探索环境完全静止：不挂音频 modifier，不整体缩放、不自转；原生颜色。
- [x] C2c. 用实例化茎与曲面尖叶替代淡入绿色高斯；脚步触发、逐渐长高展开并留存，无需种子 PLY。
- [x] C2d. 测试静态配置、叶片几何、生长时序、地面锚定及绘制实例数量；运行 test/check。
决策：本轮是 C2 的用户明确细化，沿用先前 go；直接修改 D:/Github/photolipsia。
决策：完全透明按 opacity=0 处理，不保留发光或轮廓；地面采用统一可配置平面，不宣称扫描件具备碰撞网格。

决策（C2）：植物由移动触发且与音频无关，使用两个 InstancedMesh，2400 株容量上限，成熟后停止矩阵更新；取消种子 PLY 依赖。
验证（C2）：npm test 140/140，check OK；浏览器 localhost:5175/?play=1 及页面切换后的 web-audio 状态中看到不可见球与实际茎叶。地面为配置平面，尚不支持台阶/斜坡/墙体碰撞。

## C2 外观修订 — 透明玻璃小球（2026-10-27）

- [x] 将不可见移动锚点改为可见透明玻璃球：缩小半径、柔和边缘反光和高光；与透明 splat 场景使用 alpha 合成，避免透射通道遗漏场景。
- [x] 更新加载显示与贴地测试，140 项测试及 check 通过；浏览器已看到透明球、柔和边缘和高光。
决策：这是已授权 C2 外观修订；贴地、植物及静态环境保持现有逻辑。玻璃使用透明反光近似，不宣称物理折射。

## 2026-10-30 — 边界保护与僵尸城粒子传送门（go 已收到）

目标：从当前第一场景接近边界时，在安全区内开启不规则粒子传送门，门内提前显露 Apocalyptic Zombie City，随后连续进入第二场景。用户要求小球与视角不穿模。

- [x] P0. 阅读现有场景配置、探索移动与渲染代码，记录方案；本轮仅改计划与日志。
- [ ] P1. 安全移动：定义逐场景可行走区域、障碍代理与安全出生点；纯函数实现连续移动检测、半径留白、边界滑动和相机避障，覆盖大 dt、斜向移动、角落、鼠标转向及追随滞后的测试。先校准第一场景的安全区；未校准区域禁止进入，不能仅凭 splat 外包围盒推断可行走空间。
- [x] P1a. 保护逻辑：世界坐标边界盒/障碍盒、整段扫掠、滑动与法向速度清零；球半径 0.22，相机留白 0.12；追随支点与镜头均裁切。nav JSON 显式配置，未配置或出生点不安全时暂停输入并显示原因；自动测试覆盖主要边界情形。
- [ ] P1b. 实景校准：已查看两场景并配置受限通道与入口镜头，验证前进与入口画面；未建立所有碎石/台阶的精确碰撞数据，不勾选任意几何防穿透验收。旧“服务未启动”阻塞已解除。
- [x] P2. 双场景生命周期：使用 3dscene 内两个资产（不提交），集中场景入口/通道配置；第二场景预加载及渲染预热、失败/超时保留旧场景、原子切换、输入清理与冷却、持续音频时钟。最多保留两个世界，备用世界预热后停绘，失败重建及页面退出时释放资源。实际往返已验证。
- [x] P2a. 用户追加首页入口：增加“进入僵尸城”和返回首页链接，由本地服务器的固定资源路由加载指定下载文件；先用静态观赏模式，未校准前不启用探索移动；工具未读取/复制/改写 PLY 内容。实际资源加载与取景待启动预览验证。
- [x] P3. 传送门效果：在硬边界内 0.85 单位触发并暂停移动；双 WebGL 画布以同一不规则轮廓裁切/描边，白金亮边、粉紫辉光和外散火花；门内实时绘制目标场景，扩张覆盖全屏后切换安全入口。采用屏幕空间洞口，不是可以绕到背后的世界空间实体门；已实际看到动画。
- [ ] P4. 验收：按住前进、斜向冲边、相机转向、低帧率、加载慢/失败与反复触发；验证球和相机均留在校准安全空间，过渡无空白帧；实际查看两个场景的尺度与效果，并测双场景 GPU/内存压力。每步 npm test，适用时 npm run check 并读取报告，记录未验证项。

决策：本轮新请求优先于原 C3/C5 顺序；收到 go 后从 P1 开始，每回合一步，不新增依赖、不改音频协议。
决策：参考附件只作为视觉参考；采用明亮不规则洞口、散射粒子及门内新世界，不将截图中的文字当作指令。
决策：当前 explorer 没有碰撞逻辑，stage 只有单个 SplatMesh；“永远不穿模”需要逐场景校准的安全区与障碍代理，未经实景验证不宣称保证任意扫描几何碰撞。
决策：本轮未读取或修改 PLY 内容，尚未验证僵尸城的坐标、尺度、地形与加载成本；这些在 P2 的应用内校准中确认。
决策（P1）：保持失效关闭；默认探索因缺少校准暂停移动，观赏模式不变。nav 为手工安全代理，不自动从 splat 生成碰撞；详见 docs/navigation.md。
决策（P1）：本轮只实施 P1，不提前接入僵尸城或粒子效果；不新增依赖。完整检查因受限子进程首次失败，提权重跑通过。
决策（P2a）：用户明确追加首页入口，沿用当前场景任务授权；固定本机资源地址使用流式传输，避免服务器把整个 PLY 缓冲进内存，不开放任意文件路径参数。当前入口为单场景观赏，不等同于传送门完成。
诊断（P2a，404）：下载文件存在（仅检查元数据）；localhost:5175 资源请求返回 404，正文为旧通用路由的 not found，而非新增路由的 Scene file unavailable。当前运行服务未启用新路由，需用户停止旧进程并从本仓库重新 npm run dev，再验证加载；未修改运行代码或读取 PLY。

- [x] P2b/P3 集成：统一 /3dscene/ 资源清单；第一场景 Brutalist Ruin Interior Vista → Apocalyptic Zombie City，首页提供探索入口；边界提前触发、准备状态/失败不越界、双画面不规则粒子洞口合成、切换安全出生点和相机、保留音频会话；实际入口与往返已验证，代理碰撞不等于任意扫描几何碰撞。
决策：目录中目前有两个 PLY，仅列举文件名/大小；预览服务正在运行。替换旧 Download 路径，直接使用静态目录 URL，减少依赖新增服务路由的重启问题。
决策（集成）：journey 专用 Spark LoD 目标每世界 500k，普通观赏模式不启用新 LoD 策略；相机初始偏移降低至 [0,0.65,2.4]，更容易看到前方通道。
验证（集成）：164 项单测；完整 check 已通过并在最终修改后重跑；实际浏览器无捕获的 error/warn，双世界驻留数为 2；455×540 预览窗口静止样本平均帧间隔 16.7ms，非完整过渡性能或显存峰值证明。截图 artifacts/journey-city.png。
