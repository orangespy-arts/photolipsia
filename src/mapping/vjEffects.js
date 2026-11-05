import { clampInput } from '../input/gamepad.js';

// Ten presets, each its own visual language; none duplicates a button layer
// (invert, RGB split, neon edge, mono, hue, pixelate, freeze — see buttonFx.js).
export const EFFECT_NAMES = ['回声', '波纹', '漩涡', '隧道', '扫描故障', '频闪', '色阶', '版画', '分屏', '液化'];
export const effectState = (preset = 0) => ({ preset, feedback: 0, distortion: 0,
  armed: false, lb: false, rb: false, reset: true });

export function advanceEffects(state, pad, dt) {
  if (!pad?.standard || !Number.isFinite(dt) || dt <= 0 || dt > 0.25) return effectState(state.preset);
  const lt = clampInput(pad.triggers?.[0], 0, 1), rt = clampInput(pad.triggers?.[1], 0, 1);
  const lb = !!pad.buttons[4]?.pressed, rb = !!pad.buttons[5]?.pressed;
  if (pad.buttons[1]?.pressed) return effectState(state.preset);
  if (!state.armed) {
    return { ...effectState(state.preset), armed: lt < 0.03 && rt < 0.03 && !lb && !rb, lb, rb };
  }
  const delta = Number(rb && !state.rb) - Number(lb && !state.lb);
  const preset = (state.preset + delta + EFFECT_NAMES.length) % EFFECT_NAMES.length;
  const smooth = (value, target) => {
    const next = value + (target - value) * (1 - Math.exp(-dt * (target > value ? 12 : 6)));
    return next < 0.001 && target === 0 ? 0 : next;
  };
  return { preset, feedback: smooth(state.feedback, lt < 0.03 ? 0 : lt),
    distortion: smooth(state.distortion, rt < 0.03 ? 0 : rt), armed: true, lb, rb, reset: preset !== state.preset };
}
