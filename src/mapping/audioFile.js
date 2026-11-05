// Local music file choice for the show panel (pure helpers).
export const AUDIO_EXTENSIONS = ['wav', 'mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'flac', 'webm'];
export const AUDIO_ACCEPT = ['audio/*', ...AUDIO_EXTENSIONS.map((e) => `.${e}`)].join(',');

// The browser decides in the end (a failed load is reported separately);
// this only rejects obvious non-audio picks such as the Ableton .asd file.
export function isLikelyAudio(file) {
  if (!file?.name) return false;
  if (typeof file.type === 'string' && file.type.startsWith('audio/')) return true;
  const ext = file.name.toLowerCase().split('.').pop();
  return file.name.includes('.') && AUDIO_EXTENSIONS.includes(ext);
}

// Long names keep start and extension: "5songDJ final mix….wav"
export function displayName(name, max = 28) {
  const text = String(name ?? '');
  if (text.length <= max) return text;
  const dot = text.lastIndexOf('.');
  const ext = dot > 0 && text.length - dot <= 6 ? text.slice(dot) : '';
  return `${text.slice(0, Math.max(1, max - ext.length - 1))}…${ext}`;
}
