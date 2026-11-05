// Fixed render size for the dual-screen console (?res=1280x720). The output
// window shows this frame scaled to fit, so it never depends on window size.
export const DEFAULT_RES = { width: 1920, height: 1080 };

export function parseRes(text) {
  const m = /^\s*(\d{3,4})\s*[x×]\s*(\d{3,4})\s*$/i.exec(text ?? '');
  if (!m) return { ...DEFAULT_RES };
  const even = (v) => Math.round(Math.max(320, Math.min(3840, Number(v))) / 2) * 2;
  return { width: even(m[1]), height: even(m[2]) };
}
