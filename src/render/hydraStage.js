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
    live.blend(h.src(h.o0).scale(() => 1 + values.feedback * 0.012)
      .rotate(() => values.feedback * 0.002), () => values.feedback * 0.92).out(h.o0);
    h.render(h.o0);
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
    render(state, dt) {
      if (disposed) return;
      values = state;
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
      if (state.reset) clear();
      completed = false;
      hydra.tick(Math.min(100, Math.max(1, dt * 1000)));
      // Hydra catches tick errors internally; afterUpdate confirms a complete draw.
      if (!completed) throw new Error('Hydra 未完成画面渲染');
      output.hidden = state.feedback === 0 && state.distortion === 0;
    },
    dispose,
  };
}
