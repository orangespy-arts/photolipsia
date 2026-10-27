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
