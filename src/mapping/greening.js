/**
 * Mapping: explorer position → greening of seed spots (pure functions).
 *
 * The "running ball" leaves greenery behind it: seed spots near the ball's
 * path bloom (opacity rises toward 1) and stay green — greening is a
 * one-way, irreversible process. All smoothing lives in the render layer
 * applying these outputs; these functions are frameless math.
 */

/**
 * One seed spot: position on the ground plane plus its current bloom.
 * bloom is 0 (hidden) .. 1 (fully grown); the render layer maps it to
 * the splat's opacity.
 */
export function createSeeds(positions, initialBloom = 0) {
  return positions.map((p) => ({
    position: [p[0], p[1], p[2]],
    bloom: initialBloom,
  }));
}

/**
 * Advance every seed's bloom one frame. Seeds within `radius` of the ball
 * grow at a rate that falls off with distance (at the ball's feet: full
 * speed, at the rim: barely); everything else holds still — no decay,
 * the green stays. Audio widens the radius (low band) and speeds growth.
 *
 * seeds: array mutated in place (bloom field). Returns how many seeds
 * grew this frame (0 = nothing new greened).
 *
 * opts:
 *   radius    — base grow radius in world units (default 0.8)
 *   speed     — bloom gained per second at distance 0 (default 1.2)
 *   bandLow   — 0..1 protocol band; widens radius up to +60%
 *   onset     — 0..1 protocol envelope; speed bonus up to +50%
 */
export function growSeeds(seeds, ballPos, dt, {
  radius = 0.8,
  speed = 1.2,
  bandLow = 0,
  onset = 0,
} = {}) {
  const r = radius * (1 + 0.6 * clamp01(bandLow));
  const v = speed * (1 + 0.5 * clamp01(onset));
  const r2 = r * r;
  let grew = 0;
  for (const s of seeds) {
    const dx = s.position[0] - ballPos[0];
    const dz = s.position[2] - ballPos[2];
    // planar distance — the ball rolls on the ground, seeds live there too
    const d2 = dx * dx + dz * dz;
    if (d2 >= r2) continue;
    if (s.bloom >= 1) continue;
    const falloff = 1 - Math.sqrt(d2) / r;
    s.bloom = Math.min(1, s.bloom + v * falloff * dt);
    grew++;
  }
  return grew;
}

/**
 * Full-scene green coverage 0..1 — HUD/status can show progress, and the
 * future portal gate ("scene ends when fully green") reads this.
 */
export function coverage(seeds) {
  if (seeds.length === 0) return 0;
  let sum = 0;
  for (const s of seeds) sum += s.bloom;
  return sum / seeds.length;
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}
