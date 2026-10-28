export function turnView(view, dx, dy, sensitivity = 0.0025) {
  const yaw = view.yaw + (Number.isFinite(dx) ? dx : 0) * sensitivity;
  return {
    yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)),
    pitch: Math.min(1.25, Math.max(0.04, view.pitch + (Number.isFinite(dy) ? dy : 0) * sensitivity)),
  };
}

export function viewOffset(view, distance) {
  const horizontal = Math.cos(view.pitch) * distance;
  return [-Math.sin(view.yaw) * horizontal, Math.sin(view.pitch) * distance,
    Math.cos(view.yaw) * horizontal];
}

// Native pointer lock with right-drag fallback for embedded browsers.
export function bindMouseLook(canvas, doc, target, enabled, onTurn, onReset, onStatus = () => {}) {
  let disposed = false, pending = false, drag = null;
  const locked = () => doc.pointerLockElement === canvas;
  const idle = 'Click to look around, or hold the right mouse button and drag';
  const error = () => {
    pending = false;
    if (!disposed) onStatus('Mouse lock unavailable. Right-drag to look around, or click to try again.');
  };
  const change = () => {
    if (disposed) return;
    pending = false; drag = null; onReset();
    onStatus(locked() ? 'Mouse to look · WASD to move · Esc to release the cursor' : idle);
  };
  const click = () => {
    if (disposed || pending || !enabled() || locked()) return;
    if (!canvas.requestPointerLock) { error(); return; }
    pending = true;
    try { canvas.requestPointerLock()?.catch(error); } catch { error(); }
  };
  const move = (e) => { if (locked() && enabled()) onTurn(e.movementX, e.movementY); };
  const down = (e) => {
    if (e.button !== 2 || !enabled() || locked()) return;
    e.preventDefault();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture?.(e.pointerId);
  };
  const dragMove = (e) => {
    if (!drag || drag.id !== e.pointerId || !enabled() || locked()) return;
    onTurn(e.clientX - drag.x, e.clientY - drag.y);
    drag.x = e.clientX; drag.y = e.clientY;
  };
  const stopDrag = () => {
    if (drag && canvas.hasPointerCapture?.(drag.id)) canvas.releasePointerCapture(drag.id);
    drag = null;
  };
  const blur = () => {
    stopDrag(); onReset();
    if (locked()) doc.exitPointerLock?.();
  };
  const hidden = () => { if (doc.hidden) blur(); };
  const context = (e) => e.preventDefault();
  canvas.addEventListener('click', click);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', dragMove);
  canvas.addEventListener('contextmenu', context);
  doc.addEventListener('pointerup', stopDrag);
  doc.addEventListener('pointercancel', stopDrag);
  doc.addEventListener('mousemove', move);
  doc.addEventListener('pointerlockchange', change);
  doc.addEventListener('pointerlockerror', error);
  doc.addEventListener('visibilitychange', hidden);
  target.addEventListener('blur', blur);
  onStatus(idle);
  return { dispose() {
    disposed = true; blur();
    canvas.removeEventListener('click', click);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', dragMove);
    canvas.removeEventListener('contextmenu', context);
    doc.removeEventListener('pointerup', stopDrag);
    doc.removeEventListener('pointercancel', stopDrag);
    doc.removeEventListener('mousemove', move);
    doc.removeEventListener('pointerlockchange', change);
    doc.removeEventListener('pointerlockerror', error);
    doc.removeEventListener('visibilitychange', hidden);
    target.removeEventListener('blur', blur);
  } };
}
