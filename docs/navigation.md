# Exploration safety calibration

Exploration requires an explicitly authored navigation volume. Without one,
movement and mouse-look are paused and the page shows a calibration message.
Viewing mode is unaffected. The two-scene journey (`?journey=1`) uses restricted
corridor profiles in `src/render/sceneCatalog.js`; custom `?play=1` still requires
an explicit profile. These proxies constrain movement but are not a full mesh
of the scanned geometry, and small debris/uneven ground remain an approximation.

The `nav` URL parameter is JSON with this shape (numbers below are illustrative,
not measured ruin1 coordinates):

```json
{
  "bounds": { "min": [-5, 0, -5], "max": [5, 4, 5] },
  "obstacles": [ { "min": [1, 0, -2], "max": [1.1, 4, 2] } ]
}
```

Use `URLSearchParams.set('nav', JSON.stringify(profile))` to encode it.
Every coordinate is final world-space x/y/z, matching `spawn` and `ground`.
The splat `tf` does not transform this profile: recalibrate after changing it.
Bounds include floor and ceiling. Obstacles are solid axis-aligned boxes.
The ball reserves 0.22 world units around its center; the camera reserves 0.12.
Spawn must fit completely inside the bounds and outside inflated obstacles.
Invalid JSON, invalid bounds, absent profiles and unsafe spawns all hold movement.

Calibration requires the actual rendered scene: verify ground, ceiling, outer
edges and every obstacle bordering the proposed walkable area. Start with a
small verified area and expand only after inspecting it. A splat bounding box
is not proof of traversable space. Split complex walls into conservative boxes;
this implementation does not follow slopes or stairs or infer splat collisions.

Before accepting a profile, hold movement against every edge and corner, turn
the camera through a full circle near each wall, and check the chase camera
around obstacles. Tests validate proxy collision math, not correspondence with
the scanned environment. Camera motion retracts immediately when blocked.

To continue the pending ruin1 calibration, start `npm run dev` yourself and open
the local preview. AGENTS.md prohibits agents from starting this server.

## Two-scene journey

The homepage's “开始探索 · 粒子传送门” link opens the ruin corridor, preloads the
city and warms its renderer before permitting a transition. Both assets are
served directly from `/3dscene/`; neither depends on the Download folder.
At 0.85 units from the protected x/z boundary, input pauses and the target world
appears inside an animated irregular mask with a bright rim and outward sparks.
Only after the hole covers all screen corners is the active world swapped.
The target's safe spawn replaces the old position; held input is cleared.

The camera remains constrained during exploration; the transition is a
screen-space portal wipe showing a live target view, not a world-space portal
that can be circled from behind. Two WebGL worlds are kept in a fixed-size pool
for return journeys; the inactive world stops rendering after warmup. Journey
stages use Spark LoD with a 500,000-splat target per world. This is a rendering
budget, not a frame-rate guarantee. Plants
persist in each world and the audio driver/clock is shared throughout.
Failure or a 60-second preload timeout keeps the current world and its hard
bounds; use the retry button to rebuild only the failed target. Leaving the page
disposes both stages and their explorers. The rendering path follows Spark's
[documented renderer lifecycle](https://sparkjs.dev/docs/spark-renderer/).

Visual inspection covered both entry views and the automatic forward transition.
It does not establish a collision guarantee against every Gaussian or debris
surface. Expand these corridors only with further scene-specific calibration.
