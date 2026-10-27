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

// numeric literal → dyno value (dyno.float() etc. cast DynoVals, not numbers)
const f = (n) => dyno.dynoConst('float', n);

export function createAvModifier({ shake = false } = {}) {
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
      // shake mode: scales stay native — the only audio response is jitter.
      let newScales = scales;
      if (!shake) {
        const pulse = dyno.add(
          dyno.mul(bandEnergy, f(0.35)),
          dyno.mul(uOnset, f(0.5)));
        newScales = dyno.mul(scales, dyno.add(f(1), pulse));
      }

      // ── displacement: audio-driven wobble (cheap trig noise) ──
      // Components stay scalar and are merged via combineGsplat's center
      // path — scalar vec3 constructors are a proven-bad dyno path (log).
      // In shake mode this is the ONLY response: onset joins the jitter
      // amplitude (a hit = a hard shake) instead of its own scale punch.
      const wobbleGain = shake
        ? dyno.add(f(0.6), dyno.mul(f(2), dyno.max(uOnset, bandEnergy)))
        : dyno.add(f(0.4), bandEnergy);
      const wob1 = dyno.sin(dyno.add(dyno.mul(cx, f(3)), dyno.mul(uTime, f(1.7))));
      const wob2 = dyno.sin(dyno.add(dyno.mul(cz, f(3)), dyno.mul(uTime, f(1.3))));
      const driftAmt = dyno.mul(f(0.08), wobbleGain);
      const newCenter = dyno.combine({
        vectorType: 'vec3',
        x: dyno.add(dyno.swizzle(center, 'x'), dyno.mul(wob1, driftAmt)),
        y: dyno.add(dyno.swizzle(center, 'y'), dyno.mul(dyno.mul(bandEnergy, f(0.5)), driftAmt)),
        z: dyno.add(dyno.swizzle(center, 'z'), dyno.mul(wob2, driftAmt)),
      });

      // ── color: centroid → hue rotation, band energy → brightness ──
      // shake mode: rgb passes through untouched — native file colors.
      let newRgba;
      if (shake) {
        newRgba = dyno.combine({
          vectorType: 'vec4',
          x: dyno.swizzle(rgb, 'x'),
          y: dyno.swizzle(rgb, 'y'),
          z: dyno.swizzle(rgb, 'z'),
          w: opacity,
        });
      } else {
        const hueAngle = dyno.mul(dyno.sub(uCentroid, f(0.5)), f(3.14159));
        const bright = dyno.add(f(1), dyno.mul(bandEnergy, f(0.6)));
        // hueRotate returns the three rotated channels as scalars; they go
        // straight into the vec4 combine (dyno.vec3(s,s,s) turned out to be
        // an unreliable constructor — colors went grayscale through it).
        const { rp, gp, bp } = hueRotateChannels(dyno.mul(rgb, bright), hueAngle);
        newRgba = dyno.combine({
          vectorType: 'vec4',
          x: rp,
          y: gp,
          z: bp,
          w: opacity,
        });
      }

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

// Hue rotation as pure dyno operators, returning scalar channels — NOT a
// vec3. (`dyno.vec3(a,b,c)` grayscale-destroyed colors, like vec4-cast did;
// root cause of both TBD, see log.) Math: Rodrigues rotation of the RGB
// vector around the grey axis (1,1,1)/√3 — the classic exact hue rotation.
// angle 0 → exact identity, verified by probe A/B.
function hueRotateChannels(rgb, angle) {
  const cosA = dyno.cos(angle);
  const sinA = dyno.sin(angle);
  const k = dyno.sub(f(1), cosA);
  const r = dyno.swizzle(rgb, 'x');
  const g = dyno.swizzle(rgb, 'y');
  const b = dyno.swizzle(rgb, 'z');
  const sum = dyno.add(r, dyno.add(g, b));
  const k3 = dyno.mul(k, f(1 / 3));
  const rp = dyno.add(dyno.mul(r, cosA),
    dyno.add(dyno.mul(k3, sum), dyno.mul(sinA, dyno.sub(g, b))));
  const gp = dyno.add(dyno.mul(g, cosA),
    dyno.add(dyno.mul(k3, sum), dyno.mul(sinA, dyno.sub(b, r))));
  const bp = dyno.add(dyno.mul(b, cosA),
    dyno.add(dyno.mul(k3, sum), dyno.mul(sinA, dyno.sub(r, g))));
  return {
    rp: dyno.clamp(rp, f(0), f(1)),
    gp: dyno.clamp(gp, f(0), f(1)),
    bp: dyno.clamp(bp, f(0), f(1)),
  };
}
