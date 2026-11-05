import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSpawn } from '../src/mapping/spawnFinder.js';

// dense points on the six faces of a w×h×d room (floor at y=0)
function room({ w = 8, h = 3, d = 4, step = 0.1, pillar = false } = {}) {
  const p = [];
  for (let x = -w / 2; x <= w / 2; x += step) for (let z = -d / 2; z <= d / 2; z += step) p.push(x, 0, z, x, h, z);
  for (let x = -w / 2; x <= w / 2; x += step) for (let y = 0; y <= h; y += step) p.push(x, y, -d / 2, x, y, d / 2);
  for (let z = -d / 2; z <= d / 2; z += step) for (let y = 0; y <= h; y += step) p.push(-w / 2, y, z, w / 2, y, z);
  if (pillar) for (let y = 0; y <= h; y += step / 2) for (let a = 0; a < 6.28; a += 0.2) p.push(Math.cos(a) * 0.6, y, Math.sin(a) * 0.6);
  return new Float32Array(p);
}
function nearest(pts, q) {
  let m = Infinity;
  for (let i = 0; i < pts.length; i += 3) m = Math.min(m, Math.hypot(pts[i] - q[0], pts[i + 1] - q[1], pts[i + 2] - q[2]));
  return m;
}

test('hollow room: spawn inside, near the middle, clear of walls, looking down the long side', () => {
  const pts = room();
  const s = findSpawn(pts);
  assert.equal(s.mode, 'cavity');
  const [x, y, z] = s.camPos;
  assert.ok(Math.abs(x) < 4 && y > 0.3 && y < 2.7 && Math.abs(z) < 2, `inside: ${s.camPos}`);
  assert.ok(Math.hypot(x, y - 1.5, z) < 1.2, `near middle: ${s.camPos}`);
  assert.ok(nearest(pts, s.camPos) > 0.25, 'not touching a surface');
  const dx = s.lookAt[0] - x, dz = s.lookAt[2] - z;
  assert.ok(Math.abs(dx) > Math.abs(dz), `looks along the 8 m axis: ${dx},${dz}`);
  assert.equal(s.lookAt[1], y, 'level gaze');
});

test('room with a central pillar: spawn avoids the pillar', () => {
  const pts = room({ pillar: true });
  const s = findSpawn(pts);
  assert.ok(nearest(pts, s.camPos) > 0.25, `clear of pillar: ${s.camPos}`);
  assert.ok(Math.hypot(s.camPos[0], s.camPos[2]) > 0.8, 'moved off the pillar axis');
});

test('open ground with no walls falls back to a safe height above the centre', () => {
  const p = [];
  for (let x = -5; x <= 5; x += 0.1) for (let z = -5; z <= 5; z += 0.1) p.push(x, Math.sin(x) * 0.05, z);
  const pts = new Float32Array(p);
  const s = findSpawn(pts);
  assert.equal(s.mode, 'fallback');
  assert.ok(Math.hypot(s.camPos[0], s.camPos[2]) < 0.6);
  assert.ok(nearest(pts, s.camPos) > 0.25);
});

test('stray floaters far away do not drag the spawn out of the room', () => {
  const floaters = [];
  for (let i = 0; i < 100; i++) floaters.push(400, 200, -300);
  const pts = new Float32Array([...room(), ...floaters]);
  const s = findSpawn(pts);
  assert.equal(s.mode, 'cavity');
  assert.ok(Math.abs(s.camPos[0]) < 4 && Math.abs(s.camPos[2]) < 2);
});

test('a distant sky shell holding 40% of the splats does not swallow the room', () => {
  const r = room();
  const shell = [];
  const count = Math.round((r.length / 3) * 0.4 / 0.6);
  for (let i = 0; i < count; i++) {
    const u = Math.acos(1 - 2 * ((i + 0.5) / count)), v = i * 2.399963;
    shell.push(150 * Math.sin(u) * Math.cos(v), 150 * Math.cos(u), 150 * Math.sin(u) * Math.sin(v));
  }
  const pts = new Float32Array([...r, ...shell]);
  const s = findSpawn(pts);
  assert.equal(s.mode, 'cavity');
  const [x, y, z] = s.camPos;
  assert.ok(Math.abs(x) < 4 && y > 0.3 && y < 2.7 && Math.abs(z) < 2, `inside the room, not the sky: ${s.camPos}`);
  assert.ok(s.cell < 0.5, `grid sized to the room: cell ${s.cell}`);
});

test('open-ended scene: gaze goes to far geometry, never out into the unscanned void', () => {
  // long hall missing its +x end wall: +x is the longest free run but empty
  const p = [];
  const w = 8, h = 3, d = 4, step = 0.1;
  for (let x = -w / 2; x <= w / 2; x += step) for (let z = -d / 2; z <= d / 2; z += step) p.push(x, 0, z, x, h, z);
  for (let x = -w / 2; x <= w / 2; x += step) for (let y = 0; y <= h; y += step) p.push(x, y, -d / 2, x, y, d / 2);
  for (let z = -d / 2; z <= d / 2; z += step) for (let y = 0; y <= h; y += step) p.push(-w / 2, y, z);
  const s = findSpawn(new Float32Array(p));
  const dx = s.lookAt[0] - s.camPos[0], dz = s.lookAt[2] - s.camPos[2];
  assert.ok(dx < 0 && Math.abs(dx) > Math.abs(dz), `faces the closed -x end: ${dx},${dz}`);
});

test('too few points → null', () => {
  assert.equal(findSpawn(new Float32Array(30)), null);
  assert.equal(findSpawn(null), null);
});
