import { readGamepad, selectGamepad } from '../input/gamepad.js';
import { advanceFlight, flightInput, neutralFlightInput, stopFlight } from './flightMotion.js';

export function createFlightController({ camera, isReady, onStatus = () => {}, onInput = () => {},
  getPads = () => navigator.getGamepads(), doc = document, target = window }) {
  camera.rotation.reorder('YXZ');
  const captureHome = () => ({ position: camera.position.toArray(), yaw: camera.rotation.y, pitch: camera.rotation.x,
    velocity: [0, 0, 0], angular: [0, 0] });
  let home = captureHome();
  let state = { ...home }, armed = false, device = null, speed = 1.5, disposed = false;
  let message = '';
  function status(text) { if (text !== message) { message = text; onStatus(text); } }
  function stop() { state = stopFlight(state); armed = false; onInput(null); }
  function apply() {
    camera.position.set(...state.position);
    camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
  }
  function suspend() { stop(); status('Paused · return to the page and release the sticks to resume'); }
  function visibility() { if (doc.hidden) suspend(); }
  function disconnect(event) { if (event.gamepad?.index === device?.index) { device = null; suspend(); } }
  target.addEventListener('blur', suspend);
  target.addEventListener('gamepaddisconnected', disconnect);
  doc.addEventListener('visibilitychange', visibility);
  return {
    update(dt) {
      if (disposed) return;
      if (doc.hidden || !doc.hasFocus()) { suspend(); return; }
      if (!isReady()) { stop(); status('Loading scene…'); return; }
      let pad;
      try { pad = selectGamepad(getPads(), device?.index); }
      catch { stop(); status('Cannot read the gamepad — open the page in Chrome / Edge'); return; }
      if (!pad) { device = null; stop(); status('Click the page, then press gamepad A to connect'); return; }
      if (pad.index !== device?.index || pad.id !== device?.id) { stop(); device = { index: pad.index, id: pad.id }; }
      const snapshot = readGamepad(pad);
      const input = flightInput(snapshot);
      if (!input) { stop(); status('Gamepad is not standard layout — check the test page for its mapping'); return; }
      if (!Number.isFinite(dt) || dt <= 0 || dt > 0.25) { stop(); status('Paused · release the sticks to resume'); return; }
      if (!armed) {
        if (!neutralFlightInput(input)) { status('Release both sticks and the D-pad to arm flight'); return; }
        armed = true;
      }
      status('Gamepad ready · left stick move / right stick look / D-pad ↑↓ up-down');
      onInput(snapshot);
      state = advanceFlight(state, input, dt, speed);
      apply();
    },
    reset() { state = { ...home, position: [...home.position] }; stop(); apply(); status('Back at the entrance · release the sticks to resume'); },
    // New scene entrance: aim the camera, make it the reset target, stop and
    // require sticks to return to neutral before flying again.
    setHome(view) {
      if (view?.camPos) camera.position.set(...view.camPos);
      if (view?.lookAt) camera.lookAt(...view.lookAt);
      camera.rotation.reorder('YXZ');
      home = captureHome(); state = { ...home, position: [...home.position] }; stop(); apply();
    },
    setSpeed(value) { speed = Number.isFinite(value) ? Math.max(0.1, Math.min(10, value)) : 1.5; return speed; },
    dispose() {
      disposed = true; stop();
      target.removeEventListener('blur', suspend);
      target.removeEventListener('gamepaddisconnected', disconnect);
      doc.removeEventListener('visibilitychange', visibility);
    },
  };
}
