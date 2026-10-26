# Architecture

System shape, constraints and stage-by-stage roadmap context.

## The one-protocol principle

Everything flows through the AVParams protocol (`docs/protocol.md`).
The visualizer core never imports a driver directly; drivers never touch
splat internals; mapping never smooths. Each layer is replaceable:

```
┌───────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
| DSP sources   |   | drivers      |   | mapping      |   | splat render |
| mic / files / |──▶| normalize,   |──▶| band→region, |──▶| Spark / gs-  |
| Max·SC·PD /   |   | smooth,      |   | onset→pulse, |   | plat.js /    |
| drum machine  |   | envelope     |   | centroid→hue |   | custom       |
└───────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
       any number          fixed iface       pure fns          replaceable
```

- **Drivers** (src/drivers): one file per source, all implementing
  `start() / stop() / poll(now) → AVParams`. Pull model — the render loop
  polls once per frame. Smoothing, envelopes and normalization are the
  driver's job (protocol iron rule 1).
- **Mapping** (src/mapping): pure functions `AVParams → visual params`.
  No I/O, no time, no smoothing — fully unit-testable with synthetic frames.
- **Render**: whichever splat engine wins Stage 1's evaluation. Per-splat
  attribute mutation per frame is the hard requirement (scale pulse,
  displacement, color shift) — a viewer that can only replay baked
  animations is not enough.

## Combiner (multiple drivers at once)

A pure function above the driver layer:
`combine(frameA, frameB, weights) → AVParams`. Use case: web-audio as
always-available fallback + osc for high-precision external analysis;
weight crossfade instead of if/else.

## Recording / playback

AVParams frames are plain JSON → a session can be recorded to `.jsonl`
(one frame per line) and replayed by the `playback` driver. Creative loop:
rehearse with a real driver → record → tune visuals against playback →
perform live.

## Two-track plan: web lab + Unity performance engine

Decided 2026-10-26, revised same day. **Unity is the live-performance
destination**; the web repo is its lab, not a replacement.

- **Web repo (this repo)**: where the protocol, driver split and mapping
  designs are iterated at the cheapest possible cycle time (edit → refresh).
  Doubles as the course deliverable. Ships its own small performances
  (Strudel/Flok same-page setups) when useful.
- **Unity project (separate, minimal)**: the performance engine —
  UnityGaussianSplatting + URP, OSC input via the Room of Sounds OSC.cs,
  reusing the AudioViz audio/state-machine experience. Goal from day one:
  `/av/band/low` in → splat scene breathing.

Both tracks share the AVParams protocol: the field names map 1:1 onto the
OSC addresses in `docs/protocol.md`, so moving a design from web to Unity
is a transport swap, not a redesign. `docs/protocol.md` is the single
source of truth — copy it into the Unity project when that is created.

## Why web-first (and when Unity takes over)

## Performance notes (live-show constraints)

- Target: stable 60fps render path; audio→visual latency budget ≤ 50ms
  end-to-end (driver poll → splat frame).
- Deterministic mock driver is the latency/measurement reference:
  inject a known pulse, measure when the canvas reacts.
- Per-splat work goes in the engine's update path (compute/CPU per frame),
  never per-splat JS objects allocated per frame — watch GC pauses.
