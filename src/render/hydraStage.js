import { fxActive } from '../mapping/buttonFx.js';

// Browser bundle path published by hydra-synth 1.4.0 (package is pinned).
export function loadHydra(doc = document) {
  if (typeof window.Hydra === 'function') return Promise.resolve(window.Hydra);
  return new Promise((resolve, reject) => {
    const script = doc.createElement('script');
    const timer = setTimeout(() => { script.remove(); reject(new Error('Hydra 加载超时')); }, 15000);
    script.src = '/node_modules/hydra-synth/dist/hydra-synth.js';
    script.onload = () => {
      clearTimeout(timer);
      if (typeof window.Hydra === 'function') resolve(window.Hydra);
      else reject(new Error('Hydra 未能初始化'));
    };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Hydra 文件加载失败')); };
    doc.head.appendChild(script);
  });
}

export function createHydraStage({ Hydra, source, output }) {
  output.width = Math.max(1, source.width);
  output.height = Math.max(1, source.height);
  const hydra = new Hydra({ canvas: output, autoLoop: false, makeGlobal: false,
    detectAudio: false, enableStreamCapture: false, precision: 'highp' });
  const h = hydra.synth;
  let values = { feedback: 0, distortion: 0 }, preset = -1, bound = false, disposed = false;
  let fx = { levels: { invert: 0, shift: 0, kaleid: 0, mono: 0, pixel: 0, freeze: 0 }, hue: 0 };
  let completed = false;
  h.afterUpdate = () => { completed = true; };
  const clear = () => {
    // Both ping-pong buffers must clear, otherwise old frames can reappear.
    hydra.o.forEach(out => out.fbos.forEach(framebuffer => hydra.regl.clear({ framebuffer, color: [0, 0, 0, 1] })));
  };
  function build(index) {
    const raw = () => h.src(h.s0);
    const amount = () => values.distortion;
    let live;
    if (index === 1) live = raw().modulate(h.osc(12, 0.08, 0).rotate(0.6), () => amount() * 0.085);
    else if (index === 2) live = raw().blend(raw().kaleid(4), amount);
    else live = raw().modulate(h.noise(3, 0.12), () => amount() * 0.055);
    // freeze (R3) pins o0 to its previous frame: blend amount → 1
    live.blend(h.src(h.o0).scale(() => 1 + values.feedback * 0.012)
      .rotate(() => values.feedback * 0.002), () => Math.max(values.feedback * 0.92, fx.levels.freeze)).out(h.o0);
    // Button layers (W3c) run as post passes so they never feed back into o0.
    // Every parameter at 0 is an identity. o1: geometry, o2: color.
    const lerp = (a, b, t) => a + (b - a) * t;
    const cells = (full, few) => () => (fx.levels.pixel > 0 ? lerp(full, few, fx.levels.pixel) : 4096);
    h.src(h.o0).pixelate(cells(400, 64), cells(240, 36))
      .blend(h.src(h.o0).kaleid(4), () => fx.levels.kaleid).out(h.o1);
    const split = () => fx.levels.shift * 0.012;
    h.src(h.o1).scrollX(split).color(1, 0, 0)
      .add(h.src(h.o1).color(0, 1, 0))
      .add(h.src(h.o1).scrollX(() => -split()).color(0, 0, 1))
      .hue(() => fx.hue)
      .saturate(() => 1 - fx.levels.mono)
      .contrast(() => 1 + fx.levels.mono * 0.8)
      .invert(() => fx.levels.invert)
      .out(h.o2);
    h.render(h.o2);
    preset = index;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    output.hidden = true;
    hydra.captureStream?.getTracks().forEach(track => track.stop());
    hydra.regl.destroy();
  }
  return {
    render(state, dt, buttonFx = null) {
      if (disposed) return;
      values = state;
      if (buttonFx) fx = buttonFx;
      if (output.width !== source.width || output.height !== source.height) {
        hydra.setResolution(Math.max(1, source.width), Math.max(1, source.height));
        if (bound) h.s0.tex.resize(source.width, source.height);
        clear();
      }
      if (!bound) {
        h.s0.init({ src: source }, { mag: 'linear', min: 'linear' });
        bound = true;
      }
      if (preset !== state.preset) { build(state.preset); clear(); }
      // freeze must keep o0, so the idle clear is skipped while it holds
      if (state.reset && !(fx.levels.freeze > 0)) clear();
      completed = false;
      hydra.tick(Math.min(100, Math.max(1, dt * 1000)));
      // Hydra catches tick errors internally; afterUpdate confirms a complete draw.
      if (!completed) throw new Error('Hydra 未完成画面渲染');
      output.hidden = state.feedback === 0 && state.distortion === 0 && !fxActive(fx);
    },
    dispose,
  };
}
