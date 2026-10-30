import { portalOutline } from './portalState.js';

// The hole reveals a second live WebGL canvas, not a screenshot or crossfade.
// Shared contour drives both the CSS mask and the glowing particle perimeter.
export function createPortalEffect() {
  const canvas = document.createElement('canvas');
  canvas.className = 'portal-particles';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  function clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); }
  return {
    draw(target, progress, time) {
      const width = Math.max(1, window.innerWidth), height = Math.max(1, window.innerHeight);
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      clear();
      const points = portalOutline(progress, time, width, height);
      target.style.clipPath = `polygon(${points.map(([x, y]) => `${x}px ${y}px`).join(',')})`;
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.closePath();
      for (const [color, blur, size] of [['#d267ff', 30, 12], ['#ffbf80', 16, 5], ['#fff9dd', 8, 2]]) {
        ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.lineWidth = size; ctx.stroke();
      }
      ctx.shadowBlur = 5;
      for (let i = 0; i < 280; i++) {
        const age = (time * (0.7 + (i % 7) * 0.07) + i * 0.618) % 1;
        const index = (i * 37) % points.length;
        const [x, y] = points[index];
        const angle = index * Math.PI * 2 / points.length;
        const spread = age * (25 + i % 60);
        ctx.globalAlpha = (1 - age) * 0.9;
        ctx.fillStyle = i % 3 === 0 ? '#ce8dff' : '#ffe4a6';
        ctx.shadowColor = ctx.fillStyle;
        const size = 0.7 + (i % 4) * 0.45;
        ctx.fillRect(x + Math.cos(angle) * spread, y + Math.sin(angle) * spread + age * age * 22, size, size);
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    },
    clear,
    dispose() { canvas.remove(); },
  };
}
