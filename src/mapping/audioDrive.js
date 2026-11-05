// Show-track → visual drive for VJ mode. Pure functions; the driver already
// smoothed and normalized every field (protocol iron rule 1).
const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

// Music-driven feedback stays below a full smear so the scene remains
// readable; the triggers can still push to 1.
export const AUDIO_FEEDBACK_MAX = 0.6;
export const AUDIO_DISTORTION_MAX = 0.8;

// rms lifts the trail base, onset fires a distortion pulse.
export function audioEffectDrive(params, amount) {
  const k = clamp01(amount);
  return {
    feedback: clamp01(params?.rms) * AUDIO_FEEDBACK_MAX * k,
    distortion: clamp01(params?.onset) * AUDIO_DISTORTION_MAX * k,
  };
}

// Manual and music combine by max: a trigger always wins when pushed past the
// music, and the music keeps moving when the triggers are released. suppress
// (B held) mutes the music drive and keeps the clearing reset. While music
// drives, the idle per-frame clear is skipped so its trails can build up
// (a preset change still clears inside the Hydra stage).
export function combineEffectDrive(state, audio, suppress = false) {
  if (suppress || !audio) return state;
  return { ...state, reset: false,
    feedback: Math.max(state.feedback, clamp01(audio.feedback)),
    distortion: Math.max(state.distortion, clamp01(audio.distortion)) };
}

export function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
