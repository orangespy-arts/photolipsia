// Pure ground-plane movement. Coordinates are world-space x/z.
export function movementDirection(keys, forward) {
  const length = Math.hypot(forward[0], forward[1]);
  const x = length > 1e-6 ? forward[0] / length : 0;
  const z = length > 1e-6 ? forward[1] / length : -1;
  const vertical = Number(keys.up) - Number(keys.down);
  const horizontal = Number(keys.right) - Number(keys.left);
  const dx = x * vertical - z * horizontal;
  const dz = z * vertical + x * horizontal;
  const norm = Math.max(1, Math.hypot(dx, dz));
  return [dx / norm, dz / norm];
}

export function advanceMotion(position, velocity, direction, dt) {
  // Exact integration of dv/dt = acceleration - damping * velocity.
  const decay = Math.exp(-3.2 * dt);
  const integral = (1 - decay) / 3.2;
  const target = direction.map((v) => v * 6.5 / 3.2);
  return {
    position: position.map((p, i) => p + target[i] * dt + (velocity[i] - target[i]) * integral),
    velocity: velocity.map((v, i) => target[i] + (v - target[i]) * decay),
  };
}

export const followWeight = (rate, dt) => 1 - Math.exp(-rate * dt);
