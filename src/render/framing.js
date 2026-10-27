/**
 * Pure parsing/serialization for scene framing URL state.
 *
 * ?view=look@cam — camera basis: look-at point and camera position
 * ?tf=x,y,z@rx,ry,rz@s — splat transform: position @ euler-degrees @ uniform scale
 *
 * Serialized forms here are the shareable truth: the "copy framing link"
 * button round-trips through these exactly, so a framed shot is a URL.
 */

/**
 * parseVec3('1,2.5,-3') → [1, 2.5, -3]; null unless exactly 3 finite numbers.
 */
export function parseVec3(s) {
  if (typeof s !== 'string') return null;
  const parts = s.split(',').map(Number);
  if (parts.length !== 3) return null;
  // '' coerces to 0 — an empty segment is malformed, not zero
  if (s.split(',').some((p) => p.trim() === '') || parts.some((v) => !Number.isFinite(v))) {
    return null;
  }
  return parts;
}

/**
 * parseView('?view=' value) → { lookAt, camPos? } or null.
 * 'look@cam' or bare 'look' (camera keeps its default position, re-aimed).
 */
export function parseView(s) {
  if (!s) return null;
  const [look, cam] = s.split('@');
  const lookAt = parseVec3(look);
  if (!lookAt) return null;
  const camPos = parseVec3(cam);
  return camPos ? { lookAt, camPos } : { lookAt };
}

/**
 * parseTf('?tf=' value) → { position, rotationDeg, scale } or null.
 * 'x,y,z@rx,ry,rz@s'; a missing @-segment keeps that part at rest
 * (position 0,0,0 / rotation 0,0,0 / scale 1).
 */
export function parseTf(s) {
  if (!s) return null;
  const [pos, rot, scale] = s.split('@');
  const position = parseVec3(pos) ?? [0, 0, 0];
  const rotationDeg = parseVec3(rot) ?? [0, 0, 0];
  const sc = Number(scale);
  return {
    position,
    rotationDeg,
    scale: Number.isFinite(sc) && sc > 0 ? sc : 1,
  };
}

/** fmtVec3([1,2.5,-3]) → '1,2.5,-3' (full precision; URL is the storage). */
export function fmtVec3(v) {
  return `${v[0]},${v[1]},${v[2]}`;
}

/**
 * fmtTf(state) → '?tf=' value; rest-state round-trips to '' (omit the param).
 */
export function fmtTf({ position, rotationDeg, scale }) {
  const rest =
    position.every((v) => v === 0) &&
    rotationDeg.every((v) => v === 0) &&
    scale === 1;
  if (rest) return '';
  const rot = rotationDeg.some((v) => v !== 0) ? `@${fmtVec3(rotationDeg)}` : '';
  const sc = scale !== 1 ? `@${scale}` : '';
  return `${fmtVec3(position)}${rot}${sc}`;
}
