import { BUTTON_NAMES, selectGamepad, readGamepad } from '../input/gamepad.js';

const el = id => document.getElementById(id);
let preferredIndex = null;
let layout = '';
let keyNodes = [];
let lastPaint = -Infinity;

function clear(message) {
  el('status').textContent = message;
  el('device').textContent = '当前没有可用输入';
  el('mapped').hidden = true;
  el('buttons').replaceChildren();
  el('axes').textContent = '—';
  layout = '';
  keyNodes = [];
}

function render() {
  if (document.hidden || !document.hasFocus()) {
    clear('检测已暂停，请回到此页面。');
    return;
  }
  if (!window.isSecureContext || typeof navigator.getGamepads !== 'function') {
    clear('浏览器暂不支持检测。请使用 Chrome 或 Edge，通过 localhost 打开此页。');
    return;
  }
  try {
    const pad = selectGamepad(navigator.getGamepads(), preferredIndex);
    const state = readGamepad(pad, Number(el('deadzone').value));
    if (!state) {
      preferredIndex = null;
      clear('等待手柄：点击“开始检测”，再按手柄 A 键；已拔出的手柄可直接重新连接。');
      return;
    }
    preferredIndex = state.index;
    el('status').textContent = state.standard ? '已连接 · 标准布局（按 Xbox 按键名称显示）' : '已连接 · 非标准布局，仅显示原始编号，需确认映射。';
    el('device').textContent = `${state.id} · 插槽 ${state.index} · ${state.axes.length} 轴 / ${state.buttons.length} 按键`;
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
    el('axes').textContent = state.axes.map((axis, i) => `轴 ${i}: ${axis.toFixed(3)}`).join('    ') || '无轴';
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
    clear('浏览器阻止了手柄读取。请在独立的 Chrome / Edge 标签页中打开此 localhost 页面后重试。');
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
