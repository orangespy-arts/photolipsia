// Sound input for the VJ page: the show track ('music') or a live
// microphone ('mic'). Pure reducer; the driver does the actual routing.
//   toggle      — the panel button
//   mic-ok      — permission granted, analyser now on the mic ({ label })
//   mic-failed  — denied / no device ({ error })
//   mic-ended   — the device went away mid-show
export const inputState = () => ({ mode: 'music', pending: false, label: '', error: '' });

export function reduceInput(state, event) {
  const s = state ?? inputState();
  switch (event?.type) {
    case 'toggle':
      if (s.pending) return s; // one request at a time
      return s.mode === 'mic'
        ? { mode: 'music', pending: false, label: '', error: '' }
        : { ...s, pending: true, error: '' };
    case 'mic-ok':
      return s.pending ? { mode: 'mic', pending: false, label: event.label ?? '', error: '' } : s;
    case 'mic-failed':
      return { mode: 'music', pending: false, label: '', error: event.error || 'Could not use the microphone' };
    case 'mic-ended':
      return s.mode === 'mic' ? { mode: 'music', pending: false, label: '', error: 'Microphone disconnected — back to music' } : s;
    default:
      return s;
  }
}

// what the panel shows for a state
export function inputLabels(s, trackName = '') {
  if (s.pending) return { button: '🎤 Opening microphone…', status: 'Allow the mic in the browser prompt', canPlay: false };
  if (s.mode === 'mic') return { button: '♪ Back to music', status: `Input: microphone${s.label ? ` · ${s.label}` : ''}`, canPlay: false };
  return { button: '🎤 Switch to microphone', status: s.error || `Input: music file${trackName ? ` · ${trackName}` : ''}`, canPlay: true };
}
