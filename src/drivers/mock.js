import { emptyParams } from '../protocol/params.js';

/**
 * Mock driver — deterministic synthetic signal, no audio hardware needed.
 *
 * Double role:
 *  - test signal for automated checks (`npm run check` has no audio env)
 *  - visual tuning tool: tweak mappings against a known signal
 *
 * kind:
 *  - "pulse"  : kick-like low pulses + steady high shimmer
 *  - "ramp"   : slow RMS ramp + centroid sweep (good for hue testing)
 *  - "silence": all zeros (baseline screenshots)
 */
export function createMockDriver({ kind = 'pulse', fps = 60 } = {}) {
  let frame = 0;
  return {
    id: 'mock',
    kind,
    async start() {},
    stop() {},
    poll(nowSeconds = frame / fps) {
      const t = nowSeconds;
      const p = emptyParams('mock', t);
      if (kind === 'silence') return p;

      if (kind === 'pulse') {
        const beat = t * 2; // 120 bpm
        const phase = beat % 1;
        p.bands.low = Math.exp(-phase * 6);           // kick decay
        p.bands.mid = 0.3 + 0.2 * Math.sin(t * 1.7);
        p.bands.high = 0.25 + 0.1 * Math.sin(t * 9.3);
        p.onset = Math.exp(-phase * 10);              // envelope, driver-owned
        p.beatPhase = phase;
        p.centroid = 0.35 + 0.1 * Math.sin(t * 0.5);
        p.flatness = 0.2;
      } else if (kind === 'ramp') {
        const cyc = (t % 8) / 8;                      // 8s loop
        p.rms = 0.2 + 0.6 * cyc;
        p.bands.low = 0.6 * (1 - cyc);
        p.bands.high = 0.6 * cyc;
        p.centroid = cyc;
        p.flatness = 0.1;
      }
      // rms follows band energy for pulse/ramp (log-ish sum, clamped)
      if (p.rms === 0) {
        p.rms = Math.min(1, Math.max(0,
          (p.bands.low + p.bands.mid + p.bands.high) / 3));
      }
      frame++;
      return p;
    },
  };
}
