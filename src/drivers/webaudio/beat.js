/**
 * Beat estimation from onset events — pure, unit-tested.
 *
 * Listens to the driver's flux-trigger onsets; when they form a consistent
 * grid, estimates BPM + phase so visuals can step to the beat. Speech and
 * free-form material never align → confidence stays low → beatPhase 0
 * (protocol: "no beat source → constant 0").
 *
 * Method: scan candidate periods across 60–180 BPM; score each by how many
 * onsets land near that period's grid (grid anchored at the first onset —
 * absolute offbeat doesn't matter, relative phase does). The densest
 * consistent grid wins: onsets on every beat pick the beat; onsets on
 * eighths pick eighths. Phase = time since last onset, modulo the period,
 * so an onset moment is phase 0.
 */

export function createBeatTracker({ minBpm = 60, maxBpm = 300, windowSec = 6, alignTol = 0.15, minOnsets = 4, candidates = 140 } = {}) {
  return {
    onsets: [],           // timestamps (s) of recent flux triggers
    period: null,         // estimated beat period (s); null = no estimate
    score: 0,             // alignment score of the current estimate 0..1
    opts: { minBpm, maxBpm, windowSec, alignTol, minOnsets, candidates },
  };
}

/**
 * Feed one frame. Call every poll; only a triggered frame changes state.
 */
export function beatUpdate(st, now, triggered) {
  if (!triggered) return;
  const { windowSec } = st.opts;
  st.onsets.push(now);
  while (st.onsets.length && st.onsets[0] < now - windowSec) st.onsets.shift();
  if (st.onsets.length >= st.opts.minOnsets) estimatePeriod(st);
}

function estimatePeriod(st) {
  const os = st.onsets;
  const { minBpm, maxBpm, candidates, alignTol } = st.opts;
  const minP = 60 / maxBpm, maxP = 60 / minBpm; // period seconds = 60/bpm
  let best = null;
  for (let i = 0; i <= candidates; i++) {
    const P = maxP + ((minP - maxP) * i) / candidates;
    const t0 = os[0];
    let sum = 0;
    for (const t of os) {
      const frac = ((t - t0) / P) % 1;
      const d = Math.min(frac, 1 - frac); // distance to nearest grid line
      sum += d < alignTol ? 1 - d / alignTol : 0;
    }
    const score = sum / os.length;
    if (!best || score > best.score) best = { P, score };
  }
  // stable estimate: small change → blend (no phase jumps); big change or
  // first lock → take it only if it's clearly aligned (0.6: random onset
  // trains can brush 0.5 by chance over many candidate periods)
  if (st.period != null && best && Math.abs(best.P - st.period) / st.period < 0.05) {
    st.period = st.period * 0.7 + best.P * 0.3;
    st.score = best.score;
  } else if (best && best.score > 0.6) {
    st.period = best.P;
    st.score = best.score;
  }
}

/**
 * Current beat state for "now" (pure read, no state change).
 * Returns { phase, confidence } — phase 0..1 (0 at an onset), confidence
 * 0..1 decaying to 0 after ~4 missed beats. Gated on the alignment score
 * (below 0.6 = no trustworthy grid, e.g. speech): confidence 0.
 */
const CONF_GATE = 0.6;
export function beatPhase(st, now) {
  const last = st.onsets[st.onsets.length - 1];
  if (st.period == null || last == null) return { phase: 0, confidence: 0 };
  const age = now - last;
  const conf = st.score >= CONF_GATE ? st.score : 0;
  const confidence = conf * Math.max(0, 1 - age / (st.period * 4));
  const phase = ((now - last) / st.period) % 1;
  return { phase, confidence };
}
