import { BUTTON_NAMES, selectGamepad, readGamepad } from '../input/gamepad.js';

const el = id => document.getElementById(id);
let preferredIndex = null;
let layout = '';
let keyNodes = [];
let lastPaint = -Infinity;

function clear(message) {
  el('status').textContent = message;
  el('device').textContent = 'No input available';
  el('mapped').hidden = true;
  el('buttons').replaceChildren();
  el('axes').textContent = '—';
  layout = '';
  keyNodes = [];
}

function render() {
  if (document.hidden || !document.hasFocus()) {
    clear('Detection paused — return to this page.');
    return;
  }
  if (!window.isSecureContext || typeof navigator.getGamepads !== 'function') {
    clear('The browser cannot detect gamepads yet. Use Chrome or Edge and open this page via localhost.');
    return;
  }
  try {
    const pad = selectGamepad(navigator.getGamepads(), preferredIndex);
    const state = readGamepad(pad, Number(el('deadzone').value));
    if (!state) {
      preferredIndex = null;
      clear('Waiting for gamepad: click "Start detection", then press A on the pad; unplugged pads can reconnect directly.');
      return;
    }
    preferredIndex = state.index;
    el('status').textContent = state.standard ? 'Connected · standard layout (shown with Xbox button names)' : 'Connected · non-standard layout, raw indices only — mapping needs checking.';
    el('device').textContent = `${state.id} · slot ${state.index} · ${state.axes.length} axes / ${state.buttons.length} buttons`;
    el('mapped').hidden = !state.standard;
    const nextLayout = `${state.index}:${state.id}:${state.standard}:${state.buttons.length}`;
    if (layout !== nextLayout) {
      layout = nextLayout;
      keyNodes = state.buttons.map(() => {
        const node = document.createElement('div');
        node.className = 'key';
        return node;
      });
      el('buttons').replaceChildren(...keyNodes);
    }
    state.buttons.forEach((button, i) => {
      const label = state.standard ? BUTTON_NAMES[i] ?? `B${i}` : `B${i}`;
      keyNodes[i].textContent = `${label}\n${button.value.toFixed(2)}${button.pressed ? ' ●' : ''}`;
      keyNodes[i].classList.toggle('active', button.pressed || button.value > 0.05);
    });
    el('axes').textContent = state.axes.map((axis, i) => `axis ${i}: ${axis.toFixed(3)}`).join('    ') || 'no axes';
    if (state.standard) {
      for (const side of ['left', 'right']) {
        const { x, y } = state[side];
        el(`${side}-dot`).style.transform = `translate(${x * 63}px, ${y * 63}px)`;
        el(`${side}-value`).textContent = `X ${x.toFixed(3)} / Y ${y.toFixed(3)}`;
      }
      ['lt', 'rt'].forEach((name, i) => {
        el(name).value = state.triggers[i];
        el(`${name}-value`).textContent = state.triggers[i].toFixed(2);
      });
    }
  } catch {
    clear('The browser blocked gamepad reads. Open this localhost page in a separate Chrome / Edge tab and try again.');
  }
}

el('activate').addEventListener('click', render);
el('deadzone').addEventListener('input', () => {
  el('deadzone-value').textContent = `${Math.round(Number(el('deadzone').value) * 100)}%`;
  render();
});
for (const event of ['gamepadconnected', 'gamepaddisconnected', 'focus', 'blur']) {
  window.addEventListener(event, render);
}
document.addEventListener('visibilitychange', render);
function tick(now) {
  if (now - lastPaint >= 33) { lastPaint = now; render(); }
  requestAnimationFrame(tick);
}
render();
requestAnimationFrame(tick);
