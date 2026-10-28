// Deterministic plant placement and growth, independent of audio and rendering.
export function plantSites(x, z, radius = 0.65, spacing = 0.32) {
  const sites = [];
  for (let ix = Math.floor((x - radius) / spacing); ix <= Math.ceil((x + radius) / spacing); ix++) {
    for (let iz = Math.floor((z - radius) / spacing); iz <= Math.ceil((z + radius) / spacing); iz++) {
      const hash = ((Math.imul(ix, 73856093) ^ Math.imul(iz, 19349663)) >>> 0);
      const px = (ix + 0.2 + (hash % 601) / 1000) * spacing;
      const pz = (iz + 0.2 + ((hash >>> 10) % 601) / 1000) * spacing;
      if (Math.hypot(px - x, pz - z) > radius) continue;
      sites.push({ key: `${ix},${iz}`, x: px, z: pz,
        height: 0.22 + (hash % 151) / 1000, yaw: (hash % 6283) / 1000 });
    }
  }
  return sites;
}

export function plantGrowth(age) {
  const t = Math.min(1, Math.max(0, age / 1.4));
  const stem = t * t * (3 - 2 * t);
  const leaf = Math.min(1, Math.max(0, (t - 0.15) / 0.85));
  return { stem, leaf: leaf * leaf * (3 - 2 * leaf), mature: t === 1 };
}

// Stable traits per ground cell: revisiting never rerolls the same plant.
export function plantTraits(key) {
  let seed = 2166136261;
  for (const c of key) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const kind = Math.floor(random() * 3);
  return {
    kind, band: Math.floor(random() * 3),
    height: [0.4, 0.26, 0.16][kind] * (0.8 + random() * 0.65),
    leafCount: [4, 6, 3][kind],
    width: [0.5, 1.4, 0.9][kind] * (0.8 + random() * 0.4),
    length: 0.65 + random() * 0.4,
    spread: 0.65 + random() * 0.65,
    twist: 1.8 + random() * 1.2,
    hue: 0.23 + random() * 0.08,
    gain: 0.65 + random() * 0.55,
    phase: random() * Math.PI * 2,
    rate: 0.8 + random() * 0.4,
  };
}
