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

- **7e（暂缓待办）**：用户本机跑 `docs/rehearsal.md` 彩排清单——离线
  验证（断网全流程）、双屏物理验证、故障切换演练。条件允许时再做，
  做完写 Stage 7 log 收尾。
- Track 2 — minimal Unity project: URP + UnityGaussianSplatting + OSC
  listener (Room of Sounds OSC.cs), `/av/band/low` → splat scene
  breathing; protocol doc copied over as source of truth

## Track 2 plan — minimal Unity project (drafted 2026-10-26, **waiting for "go"**)

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
