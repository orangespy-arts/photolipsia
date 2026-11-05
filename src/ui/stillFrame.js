// Frozen last frame for the dissolve transition (W2c). capture() must run in
// the same frame callback as the WebGL renders (their buffers are discarded
// after presentation). In single-window mode the canvas itself is the overlay;
// in console mode it is hidden by CSS and the compositor draws it instead.
export function createStillFrame({ canvas }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let alpha = 0;
  return {
    canvas,
    capture(sources) {
      const base = sources.find((s) => s && s.width > 0);
      if (!base) return;
      if (canvas.width !== base.width || canvas.height !== base.height) { canvas.width = base.width; canvas.height = base.height; }
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const s of sources) if (s && !s.hidden && s.width > 0) ctx.drawImage(s, 0, 0, canvas.width, canvas.height);
    },
    setAlpha(a) {
      alpha = Math.max(0, Math.min(1, a));
      canvas.style.opacity = String(alpha);
      canvas.hidden = alpha === 0;
    },
    get alpha() { return alpha; },
  };
}
