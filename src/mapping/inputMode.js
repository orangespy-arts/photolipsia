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
      return { mode: 'music', pending: false, label: '', error: event.error || '无法使用麦克风' };
    case 'mic-ended':
      return s.mode === 'mic' ? { mode: 'music', pending: false, label: '', error: '麦克风已断开，已切回音乐' } : s;
    default:
      return s;
  }
}

// what the panel shows for a state
export function inputLabels(s, trackName = '') {
  if (s.pending) return { button: '🎤 正在打开麦克风…', status: '请在浏览器弹窗里允许麦克风', canPlay: false };
  if (s.mode === 'mic') return { button: '♪ 切回音乐', status: `输入：麦克风${s.label ? ` · ${s.label}` : ''}`, canPlay: false };
  return { button: '🎤 切到麦克风', status: s.error || `输入：音乐文件${trackName ? ` · ${trackName}` : ''}`, canPlay: true };
}
