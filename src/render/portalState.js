export const initialPortalState = () => ({ phase: 'idle', progress: 0, cooldown: 0, armed: true });

export function boundaryClearance(position, navigation, radius = 0.22) {
  return Math.min(...[0, 2].flatMap((i) => [
    position[i] - navigation.bounds.min[i] - radius,
    navigation.bounds.max[i] - position[i] - radius,
  ]));
}

// Loading can never commit a transition. The caller keeps collision active.
export function advancePortal(state, { dt, clearance, ready, failed, requested = false }) {
  const delta = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
  let next = { ...state, commit: false };
  if (state.phase === 'opening') {
    if (!ready || failed) return { ...initialPortalState(), phase: failed ? 'error' : 'waiting' };
    next.progress = Math.min(1, state.progress + delta / 3.2);
    if (next.progress >= 1) return { ...next, phase: 'cooldown', cooldown: 1.5, armed: false, commit: true };
    return next;
  }
  if (state.phase === 'cooldown') {
    next.cooldown = Math.max(0, state.cooldown - delta);
    if (next.cooldown === 0 && clearance > 1.05) return initialPortalState();
    return next;
  }
  if (failed) return { ...next, phase: 'error', progress: 0 };
  if (state.phase === 'error' && !requested) return next;
  if (requested || state.phase === 'waiting' || (state.armed && clearance <= 0.85)) {
    return { ...next, phase: ready ? 'opening' : 'waiting', progress: 0 };
  }
  return next;
}

export function portalOutline(progress, time, width, height, count = 112) {
  const p = Math.max(0, Math.min(1, progress));
  // Grow slowly enough to see the other world, then cover every screen corner.
  const radius = Math.min(width, height) * (0.025 + 0.4 * Math.min(1, p / 0.55))
    + Math.hypot(width, height) * Math.pow(Math.max(0, (p - 0.55) / 0.45), 2);
  return Array.from({ length: count }, (_, i) => {
    const a = i * Math.PI * 2 / count;
    const ripple = 1 + 0.035 * Math.sin(a * 7 + time * 2) + 0.02 * Math.sin(a * 19 - time * 3);
    return [width * 0.5 + Math.cos(a) * radius * ripple * 0.84,
      height * 0.48 + Math.sin(a) * radius * ripple];
  });
}
