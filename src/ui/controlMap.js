// Gamepad key map shown on the dual-screen console. Data only; `buttons` are
// standard-layout indices, `toggle` names a buttonFx toggle whose on-state is
// highlighted even after the button is released.
export const CONTROL_MAP = [
  { input: 'Left stick', action: 'Move (view-relative)', axes: [0, 1] },
  { input: 'Right stick', action: 'Turn / pitch', axes: [2, 3] },
  { input: 'D-pad ↑ / ↓', action: 'Rise / descend', buttons: [12, 13] },
  { input: 'Start', action: 'Next scene (transition: dissolve / particles, beat-gated with sound)', buttons: [9] },
  { input: 'LT', action: 'Feedback trails (all presets)', buttons: [6] },
  { input: 'RT', action: 'Current preset intensity', buttons: [7] },
  { input: 'LB / RB', action: 'Previous / next preset (10 total)', buttons: [4, 5] },
  { input: 'B', action: 'Clear reset: removes all effects', buttons: [1] },
  { input: 'A (hold)', action: 'White flash', buttons: [0] },
  { input: 'X (on/off)', action: 'RGB split', buttons: [2], toggle: 'shift' },
  { input: 'Y (on/off)', action: 'Neon edge', buttons: [3], toggle: 'edge' },
  { input: 'Back (on/off)', action: 'B&W high contrast', buttons: [8], toggle: 'mono' },
  { input: 'D-pad ← / →', action: 'Hue back / forward', buttons: [14, 15] },
  { input: 'L3 (on/off)', action: 'Pixelate', buttons: [10], toggle: 'pixel' },
  { input: 'R3 (hold)', action: 'Freeze picture', buttons: [11] },
  { input: 'Keys ↑ / ↓', action: '♪ Particle amplitude (sound-linked) 0–3× (keyboard, not gamepad)', keys: ['ArrowUp', 'ArrowDown'] },
  { input: 'Keys ← / →', action: '♪ Effect sync (sound-linked) 0–1 (keyboard, not gamepad)', keys: ['ArrowLeft', 'ArrowRight'] },
  { input: 'Key Space', action: 'Music play / pause', keys: ['Space'] },
];

// Row is "live" while any of its buttons/sticks is engaged or its toggle is on.
export function activeRows(pad, fx, deadzone = 0.15) {
  return CONTROL_MAP.map((row) => {
    if (row.toggle && fx?.toggles?.[row.toggle]) return true;
    if (!pad) return false;
    if (row.axes) return row.axes.some((i) => Math.abs(pad.axes?.[i] ?? 0) > deadzone);
    return (row.buttons ?? []).some((i) => pad.buttons?.[i]?.pressed || (pad.buttons?.[i]?.value ?? 0) > 0.03);
  });
}
