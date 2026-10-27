const keyMap = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};

export function bindExplorerInput(target, document, enabled, onReset) {
  const pressed = new Set();
  const keys = { up: false, down: false, left: false, right: false };
  const sync = () => {
    for (const name of Object.keys(keys)) keys[name] = false;
    for (const code of pressed) keys[keyMap[code]] = true;
  };
  const reset = () => { pressed.clear(); sync(); onReset(); };
  const down = (e) => {
    if (!keyMap[e.code] || !enabled() || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)
      || e.target?.isContentEditable) return;
    pressed.add(e.code); sync(); e.preventDefault();
  };
  const up = (e) => { pressed.delete(e.code); sync(); };
  const visibility = () => { if (document.hidden) reset(); };
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  target.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', visibility);
  return { keys, reset, dispose() {
    reset();
    target.removeEventListener('keydown', down);
    target.removeEventListener('keyup', up);
    target.removeEventListener('blur', reset);
    document.removeEventListener('visibilitychange', visibility);
  } };
}
