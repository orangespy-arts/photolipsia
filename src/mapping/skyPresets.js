// Procedural sky presets for scans whose sky was never captured (W6c).
// Colours are hex strings so they can be tweaked by hand; numbers are 0..1
// unless noted. skyFor() normalises a scene's `sky` field (preset name or
// object with overrides) into a complete, clamped config — or null.
export const SKY_PRESETS = {
  // s02 空城: grey-blue overcast dawn, thick slow clouds
  // colours sampled toward the scan's own pale sky so the seam stays soft
  overcast: {
    top: '#b6c4d8', horizon: '#dfe3ec', bottom: '#c9cfda', cloud: '#f4f6fa', shade: '#a7b2c3',
    cover: 0.46, softness: 0.28, opacity: 0.75, scale: 1.6, speed: 0.012,
  },
  // s09 云海遗迹: bright warm sky, thin scattered clouds
  bright: {
    top: '#8fb6dc', horizon: '#eadfe2', bottom: '#e3dde0', cloud: '#ffffff', shade: '#d6cbd2',
    cover: 0.56, softness: 0.22, opacity: 0.75, scale: 1.2, speed: 0.008,
  },
};

const HEX = /^#[0-9a-f]{6}$/i;
const clamp01 = (v, d) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d);

export function hexToRgb(hex) {
  if (!HEX.test(hex ?? '')) return null;
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

export function skyFor(scene) {
  const spec = scene?.sky;
  if (!spec) return null;
  const base = typeof spec === 'string' ? SKY_PRESETS[spec] : SKY_PRESETS[spec.preset] ?? SKY_PRESETS.overcast;
  if (!base) return null;
  const merged = { ...base, ...(typeof spec === 'object' ? spec : {}) };
  const colour = (k) => hexToRgb(merged[k]) ?? hexToRgb(base[k]);
  return {
    top: colour('top'), horizon: colour('horizon'), bottom: colour('bottom'),
    cloud: colour('cloud'), shade: colour('shade'),
    cover: clamp01(merged.cover, base.cover), softness: Math.max(0.02, clamp01(merged.softness, base.softness)),
    opacity: clamp01(merged.opacity, base.opacity),
    scale: Number.isFinite(merged.scale) && merged.scale > 0 ? merged.scale : base.scale,
    speed: Number.isFinite(merged.speed) ? merged.speed : base.speed,
  };
}
