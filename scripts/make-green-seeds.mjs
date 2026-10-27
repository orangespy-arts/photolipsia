#!/usr/bin/env node
// Writes public/splats/green-seeds.ply — small green leaf-shaped gaussians
// scattered across the ruin's ground, initially invisible (opacity 0).
// The explorer ball raises each seed's opacity as it passes (greening.js).
// The splat file itself is LOCAL ONLY (AGENTS.md bans big binaries in git).
//
//   node scripts/make-green-seeds.mjs                 sample ruin1.ply ground
//   node scripts/make-green-seeds.mjs --force         rewrite even if exists
//   node scripts/make-green-seeds.mjs --src=other.ply --count=4000
//
// Ground finding: stream the source PLY's xz positions (62-prop standard
// 3DGS layout), bucket into a coarse grid, keep cells whose minimum y is
// near the scene's floor level, drop seeds there. Zero dependencies.

import { existsSync, statSync, openSync, readSync, closeSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = arg('src') ?? join(ROOT, 'public', 'splats', 'ruin1.ply');
const OUT = join(ROOT, 'public', 'splats', 'green-seeds.ply');
const COUNT = Number(arg('count') ?? 3000);
const SH_C0 = 0.28209479177387814;

if (existsSync(OUT) && !process.argv.includes('--force')) {
  console.log('skipped, public/splats/green-seeds.ply exists');
  process.exit(0);
}
if (!existsSync(SRC)) {
  console.error(`source splat not found: ${SRC}`);
  process.exit(1);
}

// ── parse header ──
const head = readHeader(SRC);
if (!head.ok) {
  console.error(`not a supported binary PLY: ${head.reason}`);
  process.exit(1);
}
const { vertexCount, dataOffset, rowSize, xOff, yOff, zOff } = head;
console.log(`source: ${vertexCount} vertices, row ${rowSize}B, xyz at ${xOff}/${yOff}/${zOff}`);

// ── stream positions (stride sample keeps memory flat) ──
const STRIDE = Math.max(1, Math.floor(vertexCount / 400_000));
const fd = openSync(SRC, 'r');
const CHUNK_ROWS = 8192;
const buf = Buffer.alloc(CHUNK_ROWS * rowSize);
const xs = [], ys = [], zs = [];
let row = 0;
while (row < vertexCount) {
  const n = Math.min(CHUNK_ROWS, vertexCount - row);
  const got = readSync(fd, buf, 0, n * rowSize, dataOffset + row * rowSize);
  const rows = Math.floor(got / rowSize);
  for (let r = 0; r < rows; r++, row++) {
    if (row % STRIDE !== 0) continue;
    const o = r * rowSize;
    xs.push(buf.readFloatLE(o + xOff));
    ys.push(buf.readFloatLE(o + yOff));
    zs.push(buf.readFloatLE(o + zOff));
  }
  if (rows === 0) break; // short read — bail rather than loop forever
}
closeSync(fd);
console.log(`sampled ${xs.length} positions (stride ${STRIDE})`);

// ── ground cells ──
// coarse 1m grid on xz; per cell track min y. The floor = the y level where
// many cells have their minimum (mode of cell min-y, rounded to 0.5m).
const cells = new Map();
for (let i = 0; i < xs.length; i++) {
  const kx = Math.floor(xs[i]), kz = Math.floor(zs[i]);
  const key = `${kx},${kz}`;
  const y = ys[i];
  const c = cells.get(key);
  if (!c) cells.set(key, { kx, kz, minY: y, maxy: y, n: 1 });
  else { if (y < c.minY) c.minY = y; if (y > c.maxy) c.maxy = y; c.n++; }
}
const cellList = [...cells.values()].filter((c) => c.n >= 3); // visited space only
const minYs = cellList.map((c) => c.minY).sort((a, b) => a - b);
const floorY = minYs[Math.floor(minYs.length * 0.25)]; // 25th percentile of cell minima
const FLOOR_TOL = 1.2; // cells whose floor is within this of the floor level
let ground = cellList.filter((c) => c.minY <= floorY + FLOOR_TOL && c.maxy - c.minY > 0.5);
// The panorama sky clutter sits at low y far outside the room and forms a
// fake "floor". Keep cells near the main cluster: cell centers within the
// p2..p98 box of the current ground set (one refinement pass).
const q = (arr, p) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length * p)] ?? 0;
for (let pass = 0; pass < 2; pass++) {
  const kxs = ground.map((c) => c.kx), kzs = ground.map((c) => c.kz);
  const x0 = q(kxs, 0.02), x1 = q(kxs, 0.98), z0 = q(kzs, 0.02), z1 = q(kzs, 0.98);
  ground = ground.filter((c) => c.kx >= x0 && c.kx <= x1 && c.kz >= z0 && c.kz <= z1);
}
console.log(`floor y ≈ ${floorY.toFixed(2)}, ground cells ${ground.length}/${cellList.length}`);

if (ground.length === 0) {
  console.error('no ground cells found — source may not have a walkable floor');
  process.exit(1);
}

// ── drop seeds ──
// weighted by cell density (more splats on the floor = more likely walkable)
const totalN = ground.reduce((a, c) => a + c.n, 0);
const seeds = [];
let rng = 0x2545f491;
const rand = () => { // xorshift, deterministic
  rng ^= rng << 13; rng ^= rng >>> 17; rng ^= rng << 5;
  return ((rng >>> 0) % 100000) / 100000;
};
for (let i = 0; i < COUNT; i++) {
  let pick = rand() * totalN;
  let cell = ground[0];
  for (const c of ground) { pick -= c.n; if (pick <= 0) { cell = c; break; } }
  const x = cell.kx + rand();
  const z = cell.kz + rand();
  const y = cell.minY + 0.05 + rand() * 0.1; // just above the floor
  seeds.push(makeLeaf(x, y, z, rand));
}

await mkdir(join(ROOT, 'public', 'splats'), { recursive: true });
await writeFile(OUT, toPly(seeds));
console.log(`wrote public/splats/green-seeds.ply (${seeds.length} seeds)`);

// leaf-ish gaussian: flat + wide (anisotropic), rotation around y random,
// greens with slight hue jitter so the patch isn't one flat color
function makeLeaf(x, y, z, rand) {
  const s = 0.06 + rand() * 0.1;
  const green = 0.35 + rand() * 0.3;
  return {
    position: [x, y, z],
    color: [0.08 + rand() * 0.12, green, 0.08 + rand() * 0.1],
    opacity: 0.0, // invisible until the ball greens it
    scale: [s, s * 0.25, s * (0.6 + rand() * 0.6)], // flat leaf, varied length
    rotY: rand() * Math.PI,
  };
}

function toPly(splats) {
  const header = [
    'ply',
    'format binary_little_endian 1.0',
    'element vertex ' + splats.length,
    'property float x', 'property float y', 'property float z',
    'property float f_dc_0', 'property float f_dc_1', 'property float f_dc_2',
    'property float opacity',
    'property float scale_0', 'property float scale_1', 'property float scale_2',
    'property float rot_0', 'property float rot_1', 'property float rot_2', 'property float rot_3',
    'end_header',
  ].join('\n') + '\n';

  const rowSize = 62; // 14 float32 per vertex (3+3+1+3+4)
  const buf = new ArrayBuffer(splats.length * rowSize);
  const view = new DataView(buf);
  let off = 0;
  for (const s of splats) {
    for (const v of s.position) { view.setFloat32(off, v, true); off += 4; }
    for (const c of s.color) { view.setFloat32(off, (c - 0.5) / SH_C0, true); off += 4; }
    view.setFloat32(off, invSigmoid(Math.max(s.opacity, 0.001)), true); off += 4;
    for (const v of s.scale) { view.setFloat32(off, Math.log(v), true); off += 4; }
    // rotation: quaternion for a yaw rotation around y (real, x, y, z order)
    // PLY stores (w, x, y, z)? our test splat wrote (1,0,0,0) = identity in
    // (r, x, y, z) reading order — keep that convention.
    const half = s.rotY / 2;
    view.setFloat32(off, Math.cos(half), true); off += 4;
    view.setFloat32(off, 0, true); off += 4;
    view.setFloat32(off, Math.sin(half), true); off += 4;
    view.setFloat32(off, 0, true); off += 4;
  }
  const headerBytes = new TextEncoder().encode(header);
  const out = new Uint8Array(headerBytes.length + buf.byteLength);
  out.set(headerBytes, 0);
  out.set(new Uint8Array(buf), headerBytes.length);
  return out;
}

function invSigmoid(x) {
  const c = Math.min(0.999, Math.max(0.001, x));
  return Math.log(c / (1 - c));
}

function arg(name) {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`));
  return p ? p.slice(name.length + 3) : null;
}

// ── PLY header parse: find vertex element + property offsets for x/y/z ──
function readHeader(path) {
  const fd0 = openSync(path, 'r');
  const b = Buffer.alloc(4096);
  const n = readSync(fd0, b, 0, 4096, 0);
  closeSync(fd0);
  const text = b.subarray(0, n).toString('latin1');
  const end = text.indexOf('end_header');
  if (!text.startsWith('ply') || end < 0) return { ok: false, reason: 'no ply header' };
  if (!text.includes('format binary_little_endian')) return { ok: false, reason: 'not binary LE' };
  const lines = text.slice(0, end).split('\n');
  let vertexCount = 0, props = [], inVertex = false;
  for (const ln of lines) {
    const t = ln.trim().split(/\s+/);
    if (t[0] === 'element') { inVertex = t[1] === 'vertex'; if (inVertex) vertexCount = Number(t[2]); }
    if (t[0] === 'property' && inVertex) props.push({ type: t[1], name: t[2] });
  }
  if (vertexCount === 0 || props.length === 0) return { ok: false, reason: 'no vertices' };
  const SIZE = { float: 4, double: 8, uchar: 1, char: 1, short: 2, ushort: 2, int: 4, uint: 4 };
  let off = 0, xOff = -1, yOff = -1, zOff = -1;
  for (const p of props) {
    const sz = SIZE[p.type];
    if (sz === undefined) return { ok: false, reason: `unsupported type ${p.type}` };
    if (p.name === 'x') xOff = off;
    if (p.name === 'y') yOff = off;
    if (p.name === 'z') zOff = off;
    off += sz;
  }
  if (xOff < 0) return { ok: false, reason: 'no x property' };
  // header length in bytes: up to and including end_header, then ONE
  // line terminator (\n or \r\n) ends the header — find it byte-exactly
  // instead of assuming (ruin1.ply carries \r\n).
  const headEnd = end + 'end_header'.length;
  let dataOffset = headEnd;
  for (let i = headEnd; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') { dataOffset = i + 1; break; }
    if (ch !== '\r') { dataOffset = i + 1; break; } // lone \r tolerated
  }
  return { ok: true, vertexCount, rowSize: off, xOff, yOff, zOff, dataOffset };
}
