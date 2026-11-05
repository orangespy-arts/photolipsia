// Standard layout: https://www.w3.org/TR/gamepad/#remapping
export const BUTTON_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT',
  'Back', 'Start', 'L3 stick', 'R3 stick', '↑', '↓', '←', '→', 'Home'];

export function clampInput(value, min = -1, max = 1) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : 0;
}

// Radial dead zone preserves direction and caps diagonal movement at unit length.
export function normalizeStick(x, y, deadzone = 0.15) {
  x = clampInput(x);
  y = clampInput(y);
  const radius = Math.hypot(x, y);
  const dz = Number.isFinite(deadzone) ? Math.max(0, Math.min(0.95, deadzone)) : 0.15;
  if (radius <= dz || radius === 0) return { x: 0, y: 0 };
  const scale = (Math.min(radius, 1) - dz) / ((1 - dz) * radius);
  return { x: x * scale, y: y * scale };
}

export function selectGamepad(pads, preferredIndex = null) {
  const connected = Array.from(pads ?? []).filter(pad => pad?.connected);
  return connected.find(pad => pad.index === preferredIndex) ?? connected[0] ?? null;
}

export function readGamepad(pad, deadzone = 0.15) {
  if (!pad?.connected) return null;
  const axes = Array.from(pad.axes ?? [], value => clampInput(value));
  const buttons = Array.from(pad.buttons ?? [], button => ({
    value: clampInput(button?.value, 0, 1), pressed: button?.pressed === true,
  }));
  const standard = pad.mapping === 'standard';
  return {
    id: pad.id, index: pad.index, standard, axes, buttons,
    left: standard ? normalizeStick(axes[0], axes[1], deadzone) : null,
    right: standard ? normalizeStick(axes[2], axes[3], deadzone) : null,
    triggers: standard ? [buttons[6]?.value ?? 0, buttons[7]?.value ?? 0] : null,
  };
}
