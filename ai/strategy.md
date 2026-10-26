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
- [ ] Stage 5 — midi driver (note→onset events, CC→continuums, clock→beatPhase)
- [ ] Stage 6 — param recorder/playback (.jsonl), session UI polish
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

- Stage 5: midi driver (note→onset events, CC→continuums, clock→beatPhase)

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
