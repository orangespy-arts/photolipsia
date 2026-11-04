import { clampInput } from '../input/gamepad.js';

export const PITCH_LIMIT = Math.PI / 2 - 0.05;
export function flightInput(pad) {
  if (!pad?.standard) return null;
  return {
    strafe: pad.left.x, forward: -pad.left.y,
    rise: Number(pad.buttons[12]?.pressed ?? false) - Number(pad.buttons[13]?.pressed ?? false),
    yaw: -pad.right.x, pitch: -pad.right.y,
  };
}
export const neutralFlightInput = input => input && Object.values(input).every(value => Math.abs(value) < 0.001);
export const stopFlight = state => ({ ...state, velocity: [0, 0, 0], angular: [0, 0] });

function integrate(value, target, dt, rate) {
  const decay = Math.exp(-rate * dt);
  return { value: target + (value - target) * decay,
    distance: target * dt + (value - target) * (1 - decay) / rate };
}

// Camera yaw/pitch follow Three's YXZ convention; local forward is -Z.
export function advanceFlight(state, input, dt, speed = 1.5) {
  if (!input || !Number.isFinite(dt) || dt <= 0 || dt > 0.25) return stopFlight(state);
  const safeSpeed = Number.isFinite(speed) ? Math.max(0.1, Math.min(10, speed)) : 1.5;
  const turning = [input.yaw, input.pitch].map((v, i) => integrate(state.angular[i], clampInput(v) * 1.15, dt, 10));
  const yaw = state.yaw + turning[0].distance;
  const pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, state.pitch + turning[1].distance));
  const midYaw = (state.yaw + yaw) / 2, midPitch = (state.pitch + pitch) / 2;
  const forward = [-Math.sin(midYaw) * Math.cos(midPitch), Math.sin(midPitch), -Math.cos(midYaw) * Math.cos(midPitch)];
  const right = [Math.cos(midYaw), 0, -Math.sin(midYaw)];
  const direction = forward.map((v, i) => v * clampInput(input.forward) + right[i] * clampInput(input.strafe) + (i === 1 ? clampInput(input.rise) : 0));
  const norm = Math.max(1, Math.hypot(...direction));
  const motion = direction.map((v, i) => integrate(state.velocity[i], v / norm * safeSpeed, dt, 8));
  return {
    position: state.position.map((v, i) => v + motion[i].distance),
    velocity: motion.map(v => v.value), yaw, pitch,
    angular: [turning[0].value, Math.abs(pitch) === PITCH_LIMIT ? 0 : turning[1].value],
  };
}
