import { advanceFade } from '../mapping/fadeAlpha.js';

// Dual-screen console: one 2D canvas holding exactly what the audience sees
// (splat frame, Hydra overlay when active, scene-switch black). It is the
// console preview and the source of the output window's live video stream.
// draw() must run in the same frame callback as the WebGL renders, before the
// browser presents and discards their drawing buffers.
export function createCompositor({ canvas, sources, size, isFading, overlay = null }) {
  canvas.width = size.width; canvas.height = size.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  let fade = 0, frame = 0;
  const stream = canvas.captureStream?.(60) ?? null;
  return {
    stream,
    canvas,
    // output.html copies the canvas only when this advances
    get frame() { return frame; },
    draw(dt) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const source of sources) {
        if (source && !source.hidden && source.width > 0) ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      }
      // dissolve transition still (ui/stillFrame.js) over the live frame
      if (overlay && overlay.alpha > 0) {
        ctx.globalAlpha = overlay.alpha; ctx.drawImage(overlay.canvas, 0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1;
      }
      fade = advanceFade(fade, isFading(), dt);
      if (fade > 0) {
        ctx.globalAlpha = fade; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1;
      }
      frame++;
    },
  };
}
