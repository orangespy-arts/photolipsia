import { dyno } from '@sparkjsdev/spark';

/**
 * AV dyno modifier — the GPU-side audio→splat deformation graph.
 *
 * All audio state arrives as uniforms (updated per frame from JS);
 * all per-splat math runs in GLSL on the GPU. Zero per-splat JS cost.
 *
 * Region mapping mirrors src/mapping/visual.js regionEnergy: low drives
 * the bottom, high the top (y-up after the splat's flip; the test splat
 * stores red=low at its bottom).
 */

// GLSL hue rotation (YIQ space, cheap and good enough for AV)
const HUE_GLSL = /* glsl */ `
vec3 avHueShift(vec3 color, float angle) {
  const mat3 toYiq = mat3(
    0.299, 0.587, 0.114,
    0.596, -0.274, -0.322,
    0.211, -0.523, 0.312);
  const mat3 toRgb = mat3(
    1.0, 0.956, 0.621,
    1.0, -0.274, -0.639,
    1.0, -1.106, 1.703);
  vec3 yiq = toYiq * color;
  float a = angle;
  yiq.yz = mat2(cos(a), -sin(a), sin(a), cos(a)) * yiq.yz;
  return clamp(toRgb * yiq, 0.0, 1.0);
}`;

// numeric literal → dyno value (dyno.float() etc. cast DynoVals, not numbers)
const f = (n) => dyno.dynoConst('float', n);

export function createAvModifier() {
  // ── audio uniforms (JS updates .value per frame) ──
  const uLow = dyno.dynoFloat(0, 'avLow');
  const uMid = dyno.dynoFloat(0, 'avMid');
  const uHigh = dyno.dynoFloat(0, 'avHigh');
  const uOnset = dyno.dynoFloat(0, 'avOnset');
  const uCentroid = dyno.dynoFloat(0.5, 'avCentroid');
  const uTime = dyno.dynoFloat(0, 'avTime');

  const modifier = dyno.dynoBlock(
    { gsplat: { type: 'Gsplat' } },
    { gsplat: { type: 'Gsplat' } },
    ({ gsplat }) => {
      const split = dyno.splitGsplat(gsplat).outputs;
      const { center, scales, rgb, opacity } = split;
      const { x: cx, y: cy, z: cz } = split;

      // normalized screen height 0..1 (bottom..top). The y-down→y-up flip
      // means object-space +y displays at the bottom, hence 0.5 - cy*0.5.
      const h = dyno.clamp(
        dyno.sub(f(0.5), dyno.mul(cy, f(0.5))), f(0), f(1));

      // region weights — mirror of regionEnergy (mapping/visual.js):
      // tri(center) = clamp(1.333 * (0.875 - |h - c|), floor, 1), floor 0.1
      const tri = (c) => dyno.clamp(
        dyno.mul(f(1.3333), dyno.sub(f(0.875), dyno.abs(dyno.sub(h, f(c))))),
        f(0.1), f(1));
      const bandEnergy = dyno.add(dyno.add(
        dyno.mul(tri(0.15), uLow),
        dyno.mul(tri(0.5), uMid)),
        dyno.mul(tri(0.85), uHigh));

      // ── scale pulse: band energy breathe + onset punch ──
      const pulse = dyno.add(
        dyno.mul(bandEnergy, f(0.35)),
        dyno.mul(uOnset, f(0.5)));
      const newScales = dyno.mul(scales, dyno.add(f(1), pulse));

      // ── displacement: audio-driven wobble (cheap trig noise) ──
      const wob1 = dyno.sin(dyno.add(dyno.mul(cx, f(3)), dyno.mul(uTime, f(1.7))));
      const wob2 = dyno.sin(dyno.add(dyno.mul(cz, f(3)), dyno.mul(uTime, f(1.3))));
      const drift = dyno.mul(
        dyno.vec3(wob1, dyno.mul(bandEnergy, f(0.5)), wob2),
        dyno.mul(f(0.08), dyno.add(f(0.4), bandEnergy)));
      const newCenter = dyno.add(center, drift);

      // ── color: centroid → hue rotation, band energy → brightness ──
      const hueAngle = dyno.mul(dyno.sub(uCentroid, f(0.5)), f(3.14159));
      const bright = dyno.add(f(1), dyno.mul(bandEnergy, f(0.6)));
      const lit = dyno.mul(rgb, bright);
      // Stage 2a: hue shift temporarily bypassed (color went black through
      // the YIQ path); brightness only, re-enable once verified
      const newRgba = dyno.combine({
        vectorType: 'vec4',
        x: dyno.swizzle(lit, 'x'),
        y: dyno.swizzle(lit, 'y'),
        z: dyno.swizzle(lit, 'z'),
        w: opacity,
      });

      return { gsplat: dyno.combineGsplat({
        gsplat,
        center: newCenter,
        scales: newScales,
        rgba: newRgba,
      }) };
    },
  );

  return { modifier, uniforms: { uLow, uMid, uHigh, uOnset, uCentroid, uTime } };
}

// inline GLSL statement node: vec3 avHueShift(color, angle)
function avHueShiftExpr(color, angle) {
  const node = new dyno.Dyno({
    inTypes: { color: 'vec3', angle: 'float' },
    outTypes: { shifted: 'vec3' },
    statements: ({ inputs, outputs }) => [
      `vec3 ${outputs.shifted} = avHueShift(${inputs.color}, ${inputs.angle});`,
    ],
    globals: () => [HUE_GLSL],
  });
  node.inputs.color = color;
  node.inputs.angle = angle;
  return node.outputs.shifted;
}
