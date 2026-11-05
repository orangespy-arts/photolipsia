// Scene transition timeline (W2c). Pure: advance once per frame; returns the
// still-frame overlay alpha, the particle scatter amount and one-shot events.
//   idle → wait (for a beat) → out → hold (frame captured) → load (scene
//   swapped, loading) → in → idle
// Types: 'dissolve'  — freeze the last frame, swap, dissolve it away.
//        'particles' — splats start flying apart; that half-scattered frame is
//                      frozen over the load, then the new scene gathers in
//                      while the frozen cloud dissolves (never an empty screen).
export const TRANSITION_TYPES = { dissolve: 'dissolve', particles: 'particles' };
export const BEAT_GATE = 0.6;      // onset that counts as "the next hit"
export const WAIT_MAX = 1.0;       // never wait longer than this for a beat
export const OUT_SECONDS = { dissolve: 0, particles: 0.9 };
export const IN_SECONDS = { dissolve: 1.2, particles: 1.4 };
export const SCATTER_OUT = 0.7;    // how far the old scene scatters before it is frozen

export const transitionState = () => ({ phase: 'idle', t: 0, type: 'dissolve' });

export function startTransition(state, type) {
  if (state.phase !== 'idle') return state;
  return { phase: 'wait', t: 0, type: TRANSITION_TYPES[type] ? type : 'dissolve' };
}

const ease = (x) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };

// input: { dt, onset, hasSound, ready, failed }
export function advanceTransition(state, { dt = 0, onset = 0, hasSound = false, ready = false, failed = false } = {}) {
  const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;
  const particles = state.type === 'particles';
  let s = state;
  const events = { capture: false, swap: false, arrived: false };
  if (s.phase === 'wait') {
    const t = s.t + step;
    s = (!hasSound || onset >= BEAT_GATE || t >= WAIT_MAX) ? { ...s, phase: 'out', t: 0 } : { ...s, t };
  } else if (s.phase === 'out') {
    const t = s.t + step;
    // the frame rendered after this advance is the one frozen
    if (t >= OUT_SECONDS[s.type]) { s = { ...s, phase: 'hold', t: 0 }; events.capture = true; } else s = { ...s, t };
  } else if (s.phase === 'hold') {
    s = { ...s, phase: 'load', t: 0 };
    events.swap = true;
  } else if (s.phase === 'load') {
    if (ready || failed) { s = { ...s, phase: 'in', t: 0 }; events.arrived = true; }
  } else if (s.phase === 'in') {
    const t = s.t + step;
    s = t >= IN_SECONDS[s.type] ? { ...s, phase: 'idle', t: 0 } : { ...s, t };
  }
  const p = s.phase;
  const inK = p === 'in' ? ease(s.t / IN_SECONDS[s.type]) : 0;
  // still covers from the frame after capture until the new scene is in
  const still = p === 'load' ? 1 : p === 'in' ? 1 - inK : 0;
  let scatter = 0;
  if (particles) {
    if (p === 'out') scatter = SCATTER_OUT * ease(s.t / OUT_SECONDS.particles);
    else if (p === 'hold') scatter = SCATTER_OUT;
    else if (p === 'load') scatter = 1;          // new scene loads fully scattered (invisible)
    else if (p === 'in') scatter = 1 - inK;      // …and gathers in
  }
  return { state: s, still, scatter, events };
}
