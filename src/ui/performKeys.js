// Performance mode key map (pure). Keyboard only: every gamepad button is
// already a flight/effect control. Ignores typing in form fields and repeats.
export function performAction(event) {
  if (!event || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.target?.closest?.('input, select, textarea')) return null;
  if (event.code === 'KeyH') return 'toggle-hud';
  if (event.code === 'KeyF') return 'toggle-fullscreen';
  return null;
}

export const performFromUrl = (params) => params.get('vj') === '1' && params.get('perform') === '1';
