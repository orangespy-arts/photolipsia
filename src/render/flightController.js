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
  function suspend() { stop(); status('已暂停 · 回到页面并松开摇杆后继续'); }
  function visibility() { if (doc.hidden) suspend(); }
  function disconnect(event) { if (event.gamepad?.index === device?.index) { device = null; suspend(); } }
  target.addEventListener('blur', suspend);
  target.addEventListener('gamepaddisconnected', disconnect);
  doc.addEventListener('visibilitychange', visibility);
  return {
    update(dt) {
      if (disposed) return;
      if (doc.hidden || !doc.hasFocus()) { suspend(); return; }
      if (!isReady()) { stop(); status('正在加载场景…'); return; }
      let pad;
      try { pad = selectGamepad(getPads(), device?.index); }
      catch { stop(); status('无法读取手柄，请用 Chrome / Edge 打开页面'); return; }
      if (!pad) { device = null; stop(); status('点击页面，再按手柄 A 键连接'); return; }
      if (pad.index !== device?.index || pad.id !== device?.id) { stop(); device = { index: pad.index, id: pad.id }; }
      const snapshot = readGamepad(pad);
      const input = flightInput(snapshot);
      if (!input) { stop(); status('手柄不是标准布局，请先在检测页确认映射'); return; }
      if (!Number.isFinite(dt) || dt <= 0 || dt > 0.25) { stop(); status('已暂停 · 松开摇杆后继续'); return; }
      if (!armed) {
        if (!neutralFlightInput(input)) { status('请松开双摇杆和十字键，准备飞行'); return; }
        armed = true;
      }
      status('手柄已就绪 · 左摇杆移动 / 右摇杆视角 / 十字键 ↑↓ 升降');
      onInput(snapshot);
      state = advanceFlight(state, input, dt, speed);
      apply();
    },
    reset() { state = { ...home, position: [...home.position] }; stop(); apply(); status('已回到入口 · 松开摇杆后继续'); },
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
