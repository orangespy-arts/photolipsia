// Free gamepad buttons → Hydra post layers (W3c). Pure; levels are 0 when
// off so the post chain is an identity. Standard-layout indices.
export const FX_BUTTONS = { A: 0, B: 1, X: 2, Y: 3, BACK: 8, L3: 10, R3: 11, LEFT: 14, RIGHT: 15 };
const TOGGLES = { shift: FX_BUTTONS.X, kaleid: FX_BUTTONS.Y, mono: FX_BUTTONS.BACK, pixel: FX_BUTTONS.L3 };
const HOLDS = { invert: FX_BUTTONS.A, freeze: FX_BUTTONS.R3 };
export const HUE_RATE = 0.2; // turns per second while ← / → is held
export const FX_LABELS = { invert: '闪白', shift: '色彩分离', kaleid: '万花筒', mono: '黑白', pixel: '像素化', freeze: '冻结' };

const zeroLevels = () => ({ invert: 0, shift: 0, kaleid: 0, mono: 0, pixel: 0, freeze: 0 });
export const fxState = () => ({ armed: false, prev: [], toggles: { shift: false, kaleid: false, mono: false, pixel: false },
  levels: zeroLevels(), hue: 0 });

const pressed = (pad, i) => pad.buttons?.[i]?.pressed === true;

export function advanceButtonFx(state, pad, dt) {
  // no pad / paused / bad frame / B: everything off at once (safety + B clear)
  if (!pad?.standard || !Number.isFinite(dt) || dt <= 0 || dt > 0.25 || pressed(pad, FX_BUTTONS.B)) return fxState();
  const now = pad.buttons.map((b) => b?.pressed === true);
  // first frame after a reset only records what is held: no phantom toggles
  if (!state.armed) return { ...fxState(), armed: true, prev: now };
  const toggles = { ...state.toggles };
  for (const [name, i] of Object.entries(TOGGLES)) if (now[i] && !state.prev[i]) toggles[name] = !toggles[name];
  const targets = { ...Object.fromEntries(Object.keys(toggles).map((n) => [n, toggles[n] ? 1 : 0])),
    invert: now[HOLDS.invert] ? 1 : 0, freeze: now[HOLDS.freeze] ? 1 : 0 };
  const levels = {};
  for (const [name, target] of Object.entries(targets)) {
    const value = state.levels[name];
    const next = value + (target - value) * (1 - Math.exp(-dt * (target > value ? 20 : 6)));
    levels[name] = target === 0 && next < 0.001 ? 0 : target === 1 && next > 0.999 ? 1 : next;
  }
  const turn = Number(now[FX_BUTTONS.RIGHT]) - Number(now[FX_BUTTONS.LEFT]);
  const hue = ((state.hue + turn * HUE_RATE * dt) % 1 + 1) % 1;
  return { armed: true, prev: now, toggles, levels, hue };
}

export const fxActive = (fx) => !!fx && (fx.hue !== 0 || Object.values(fx.levels).some((v) => v > 0));

export function fxLabel(fx) {
  if (!fxActive(fx)) return '';
  const parts = Object.entries(fx.levels).filter(([, v]) => v > 0.05).map(([n]) => FX_LABELS[n]);
  if (fx.hue !== 0) parts.push(`色相 ${Math.round(fx.hue * 360)}°`);
  return parts.join(' · ');
}
