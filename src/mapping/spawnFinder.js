// Automatic VJ entrance: a camera position inside the scan's open space,
// near its middle and clear of every surface, looking down its deepest
// horizontal direction. Pure: input is world-space splat centres (x,y,z
// interleaved, y up). See ai/strategy.md W6b.

const NEIGHBOURS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const SIDES = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
}

// Some scans wrap the scene in a distant sky/background shell holding a large
// share of the splats (seen on 空城 / 云海遗迹); percentiles alone keep it and
// the grid balloons to the whole sky. Keep only splats within `factor` × the
// median distance from the per-axis median centre: the shell sits far beyond.
export function coreOf(points, factor = 3) {
  const n = Math.floor((points?.length ?? 0) / 3);
  if (n < 50) return points;
  const med = [0, 1, 2].map((a) => {
    const axis = new Float32Array(n);
    for (let i = 0; i < n; i++) axis[i] = points[i * 3 + a];
    axis.sort();
    return percentile(axis, 0.5);
  });
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = Math.hypot(points[i * 3] - med[0], points[i * 3 + 1] - med[1], points[i * 3 + 2] - med[2]);
  const limit = percentile(Float32Array.from(d).sort(), 0.5) * factor;
  const out = new Float32Array(n * 3);
  let m = 0;
  for (let i = 0; i < n; i++) if (d[i] <= limit) { out[m++] = points[i * 3]; out[m++] = points[i * 3 + 1]; out[m++] = points[i * 3 + 2]; }
  return out.subarray(0, m);
}

export function findSpawn(input, { grid = 48, minClear = 3, occupied = 2, lo = 0.02, hi = 0.98 } = {}) {
  if (Math.floor((input?.length ?? 0) / 3) < 50) return null;
  const points = coreOf(input);
  const n = Math.floor(points.length / 3);
  if (n < 50) return null;

  // robust bounds: percentiles drop stray floaters far outside the scan
  const min = [], max = [];
  for (let a = 0; a < 3; a++) {
    const axis = new Float32Array(n);
    for (let i = 0; i < n; i++) axis[i] = points[i * 3 + a];
    axis.sort();
    min.push(percentile(axis, lo));
    max.push(percentile(axis, hi));
  }
  const extent = Math.max(...max.map((v, a) => v - min[a]));
  if (!(extent > 0)) return null;
  const cell = extent / grid;
  const [nx, ny, nz] = max.map((v, a) => Math.max(3, Math.ceil((v - min[a]) / cell) + 1));
  const idx = (x, y, z) => x + nx * (y + ny * z);
  const inGrid = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < nx && y < ny && z < nz;

  const counts = new Uint16Array(nx * ny * nz);
  for (let i = 0; i < n; i++) {
    const x = Math.floor((points[i * 3] - min[0]) / cell);
    const y = Math.floor((points[i * 3 + 1] - min[1]) / cell);
    const z = Math.floor((points[i * 3 + 2] - min[2]) / cell);
    if (!inGrid(x, y, z)) continue;
    const k = idx(x, y, z);
    if (counts[k] < 65535) counts[k]++;
  }
  const solid = (k) => counts[k] >= occupied;

  // distance field (6-neighbour BFS, in cells) from every solid cell
  const dist = new Int16Array(nx * ny * nz).fill(-1);
  const queue = new Int32Array(nx * ny * nz);
  let head = 0, tail = 0;
  for (let k = 0; k < counts.length; k++) if (solid(k)) { dist[k] = 0; queue[tail++] = k; }
  while (head < tail) {
    const k = queue[head++];
    const x = k % nx, y = Math.floor(k / nx) % ny, z = Math.floor(k / (nx * ny));
    for (const [dx, dy, dz] of NEIGHBOURS) {
      const X = x + dx, Y = y + dy, Z = z + dz;
      if (!inGrid(X, Y, Z)) continue;
      const j = idx(X, Y, Z);
      if (dist[j] === -1) { dist[j] = dist[k] + 1; queue[tail++] = j; }
    }
  }

  // open-space components: scans are surfaces, so a hollow object (column,
  // box, statue) has an empty sealed pocket inside — never spawn there.
  // Only the largest connected open region (the actual space) qualifies.
  const comp = new Int32Array(nx * ny * nz).fill(-1);
  let largest = -1, largestSize = 0;
  for (let s0 = 0, label = 0; s0 < comp.length; s0++) {
    if (solid(s0) || comp[s0] !== -1) continue;
    let h = 0, t = 0, size = 0;
    queue[t++] = s0; comp[s0] = label;
    while (h < t) {
      const k = queue[h++]; size++;
      const x = k % nx, y = Math.floor(k / nx) % ny, z = Math.floor(k / (nx * ny));
      for (const [dx, dy, dz] of NEIGHBOURS) {
        const X = x + dx, Y = y + dy, Z = z + dz;
        if (!inGrid(X, Y, Z)) continue;
        const j = idx(X, Y, Z);
        if (!solid(j) && comp[j] === -1) { comp[j] = label; queue[t++] = j; }
      }
    }
    if (size > largestSize) { largestSize = size; largest = label; }
    label++;
  }

  // "inside" = solid floor below and solid in at least 3 of 4 horizontal
  // directions (ceilings are optional: open-sky scans have none)
  const hits = (x, y, z, dx, dy, dz) => {
    for (let X = x + dx, Y = y + dy, Z = z + dz; inGrid(X, Y, Z); X += dx, Y += dy, Z += dz) {
      if (solid(idx(X, Y, Z))) return true;
    }
    return false;
  };
  const centre = [(nx - 1) / 2, (ny - 1) / 2, (nz - 1) / 2];
  let best = null;
  for (let z = 1; z < nz - 1; z++) for (let y = 1; y < ny - 1; y++) for (let x = 1; x < nx - 1; x++) {
    const k = idx(x, y, z);
    const clear = dist[k];
    if (clear < minClear || comp[k] !== largest) continue;
    const d = Math.hypot(x - centre[0], y - centre[1], z - centre[2]);
    // trade a little centrality for room to breathe around the camera
    const score = d - Math.min(clear, 8);
    if (best && score >= best.score) continue;
    if (!hits(x, y, z, 0, -1, 0)) continue;
    const sides = SIDES.filter(([dx, , dz]) => hits(x, y, z, dx, 0, dz)).length;
    if (sides < 3) continue;
    best = { x, y, z, clear, score };
  }

  let mode = 'cavity';
  if (!best) {
    // no enclosed space: above the highest solid cell of the centre column
    mode = 'fallback';
    const cx = Math.round(centre[0]), cz = Math.round(centre[2]);
    let top = 0;
    for (let y = 0; y < ny; y++) if (solid(idx(cx, y, cz))) top = y;
    best = { x: cx, y: Math.min(ny - 1, top + minClear + 1), z: cz, clear: minClear };
  }
  const world = (g, a) => min[a] + (g + 0.5) * cell;
  const camPos = [world(best.x, 0), world(best.y, 1), world(best.z, 2)];

  // look down the longest free horizontal run that still ends on scene
  // geometry (16 directions, level gaze). A run that leaves the grid without
  // hitting anything looks into the unscanned void — only used if every
  // direction does that.
  let yaw = 0, run = -1, voidYaw = 0, voidRun = -1;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, dx = Math.sin(a), dz = -Math.cos(a);
    let s = 0, hit = false;
    for (; s < grid * 2; s += 0.5) {
      const X = Math.floor(best.x + 0.5 + dx * s), Z = Math.floor(best.z + 0.5 + dz * s);
      if (X < 0 || Z < 0 || X >= nx || Z >= nz) break;
      if (solid(idx(X, best.y, Z))) { hit = true; break; }
    }
    if (hit && s > run) { run = s; yaw = a; }
    if (!hit && s > voidRun) { voidRun = s; voidYaw = a; }
  }
  if (run < 0) yaw = voidYaw;
  const lookAt = [camPos[0] + Math.sin(yaw) * 2, camPos[1], camPos[2] - Math.cos(yaw) * 2];
  return { camPos, lookAt, clearance: best.clear * cell, mode, cell };
}
