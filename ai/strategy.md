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
- [ ] Stage 2b — verify region orientation with mock `ramp` (low must light
      the screen-bottom red zone), re-enable hue shift, parametrize response
      gains (?gain= URL overrides for live tuning)
- [ ] Stage 3 — web-audio driver (mic + file), auto-gain normalization
- [ ] Stage 4 — osc driver + dumb UDP↔WebSocket bridge script (Node)
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

- Stage 2b: region-orientation A/B via mock `ramp`, hue-shift isolation fix,
  `?gain=` URL params for live tuning
- Stage 3 next after that: web-audio driver (mic + file) — first real sound
  source, auto-gain normalization
- Open question: user visual confirmation of Stage 2 breathing/wobble before
  commit
