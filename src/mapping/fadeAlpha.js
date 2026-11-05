// Linear black-fade level for the composited output (the CSS fade overlay
// only covers the single-window page). Pure; 0.6 s matches the CSS transition.
export const FADE_SECONDS = 0.6;
export function advanceFade(alpha, on, dt) {
  const a = Number.isFinite(alpha) ? alpha : 0;
  const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) / FADE_SECONDS : 0;
  return Math.max(0, Math.min(1, a + (on ? step : -step)));
}
