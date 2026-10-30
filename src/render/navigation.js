// Authored world-space boxes, independent of splat geometry and rendering.
// Inflated boxes conservatively enclose a sphere (including at corners).
const EPS = 1e-7;
const finite3 = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const boxOK = (b) => b && finite3(b.min) && finite3(b.max)
  && b.min.every((v, i) => v < b.max[i]);

export function parseNavigation(text) {
  try {
    const n = JSON.parse(text);
    if (!boxOK(n.bounds) || !Array.isArray(n.obstacles) || !n.obstacles.every(boxOK)) return null;
    return { bounds: n.bounds, obstacles: n.obstacles };
  } catch { return null; }
}

export function isSafe(position, radius, navigation) {
  if (!navigation || !finite3(position) || !Number.isFinite(radius) || radius < 0) return false;
  const { bounds, obstacles } = navigation;
  return position.every((p, i) => p >= bounds.min[i] + radius && p <= bounds.max[i] - radius)
    && !obstacles.some((b) => position.every((p, i) => p > b.min[i] - radius && p < b.max[i] + radius));
}

// Earliest contact over the entire segment: thin walls cannot be skipped by dt.
function contact(position, delta, radius, { bounds, obstacles }) {
  let time = 1, axes = [];
  const take = (t, a) => {
    if (t < -EPS || t > 1) return;
    if (t < time - EPS) { time = Math.max(0, t); axes = [...a]; }
    else if (Math.abs(t - time) <= EPS) axes.push(...a);
  };
  delta.forEach((d, i) => {
    if (d > 0) take((bounds.max[i] - radius - position[i]) / d, [i]);
    if (d < 0) take((bounds.min[i] + radius - position[i]) / d, [i]);
  });
  for (const box of obstacles) {
    let enter = -Infinity, leave = Infinity, hitAxes = [], miss = false;
    for (let i = 0; i < 3; i++) {
      const lo = box.min[i] - radius, hi = box.max[i] + radius;
      if (Math.abs(delta[i]) < 1e-15) {
        if (position[i] <= lo || position[i] >= hi) miss = true;
        continue;
      }
      const a = (lo - position[i]) / delta[i], b = (hi - position[i]) / delta[i];
      const entry = Math.min(a, b);
      if (entry > enter + EPS) { enter = entry; hitAxes = [i]; }
      else if (Math.abs(entry - enter) <= EPS) hitAxes.push(i);
      leave = Math.min(leave, Math.max(a, b));
    }
    if (!miss && enter <= leave && leave > Math.max(0, enter)) take(enter, hitAxes);
  }
  return { time, axes: [...new Set(axes)] };
}

export function constrainMotion(position, target, velocity, radius, navigation, slide = true) {
  if (!isSafe(position, radius, navigation) || !finite3(target) || !finite3(velocity)) {
    return { position: [...position], velocity: [0, 0, 0], blocked: true };
  }
  let p = [...position], remaining = target.map((v, i) => v - p[i]);
  const v = [...velocity]; let blocked = false;
  for (let step = 0; step < 4; step++) {
    const hit = contact(p, remaining, radius, navigation);
    const length = Math.hypot(...remaining);
    const travel = hit.axes.length ? Math.max(0, hit.time - EPS / Math.max(EPS, length)) : 1;
    p = p.map((x, i) => x + remaining[i] * travel);
    if (!hit.axes.length) break;
    blocked = true;
    if (!slide) break;
    remaining = remaining.map((x, i) => hit.axes.includes(i) ? 0 : x * (1 - travel));
    for (const axis of hit.axes) v[axis] = 0;
    if (Math.hypot(...remaining) < EPS) break;
  }
  return { position: p, velocity: v, blocked };
}

export function safeCamera(anchor, desired, radius, navigation) {
  return constrainMotion(anchor, desired, [0, 0, 0], radius, navigation, false).position;
}
