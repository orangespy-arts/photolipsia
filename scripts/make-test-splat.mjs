#!/usr/bin/env node
// Writes public/splats/test.ply — a spectrum sphere + ring, our own test
// asset for check screenshots and Stage 1 rendering. Zero dependencies.
//
//   node scripts/make-test-splat.mjs           write if missing
//   node scripts/make-test-splat.mjs --force   always write
//
// Design: like real captures the file is y-down (top of sphere at y = -1),
// and colors are stored as SH DC coefficients (color = SH_C0 * f_dc + 0.5).

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'public', 'splats', 'test.ply');
const SH_C0 = 0.28209479177387814;

if (existsSync(OUT) && !process.argv.includes('--force')) {
  console.log(`skipped, ${'public/splats/test.ply'} exists`);
  process.exit(0);
}

// spectrum band labels: low=red (bottom), mid=green (middle), high=violet (top)
// — so regionEnergy mapping is visually verifiable right in the test asset.
const splats = [...sphere(5000, 1.0), ...ring(1500, 1.6)];
await mkdir(join(ROOT, 'public', 'splats'), { recursive: true });
await writeFile(OUT, toPly(splats));
console.log(`wrote public/splats/test.ply (${splats.length} splats)`);

function sphere(count, radius) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count;      // 0 = bottom of sphere, 1 = top
    const y = -(1 - 2 * t);           // y-down: t=0 -> y=+1 (bottom), t=1 -> y=-1 (top)
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = golden * i;
    return {
      position: [Math.cos(angle) * r * radius, y * radius, Math.sin(angle) * r * radius],
      color: spectrum(t),
      opacity: 0.95,
      scale: [0.045, 0.045, 0.045],
    };
  });
}

function ring(count, radius) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return {
      position: [Math.cos(a) * radius, 0, Math.sin(a) * radius],
      color: [0.8, 0.8, 0.8],
      opacity: 0.6,
      scale: [0.02, 0.02, 0.02],
    };
  });
}

// hue sweep red(0) -> violet(1) over the sphere's height
function spectrum(t) {
  const h = 0.75 * (1 - t); // t=0 bottom red(0), t=1 top violet(0.75)
  const [r, g, b] = hslToRgb(h, 0.85, 0.55);
  return [r, g, b];
}

function hslToRgb(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
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
    // SH DC coefficients: color = SH_C0 * f_dc + 0.5  →  f_dc = (color - 0.5) / SH_C0
    for (const c of s.color) { view.setFloat32(off, (c - 0.5) / SH_C0, true); off += 4; }
    view.setFloat32(off, invSigmoid(s.opacity), true); off += 4;
    for (const v of s.scale) { view.setFloat32(off, Math.log(v), true); off += 4; } // log scale
    // identity quaternion (real, imaginary x, y, z) — captures store w first
    view.setFloat32(off, 1, true); off += 4;
    view.setFloat32(off, 0, true); off += 4;
    view.setFloat32(off, 0, true); off += 4;
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
