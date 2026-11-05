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
  let fx = { levels: { invert: 0, shift: 0, edge: 0, mono: 0, pixel: 0, freeze: 0 }, hue: 0 };
  let completed = false;
  h.afterUpdate = () => { completed = true; };
  const clear = () => {
    // Both ping-pong buffers must clear, otherwise old frames can reappear.
    hydra.o.forEach(out => out.fbos.forEach(framebuffer => hydra.regl.clear({ framebuffer, color: [0, 0, 0, 1] })));
  };
  function build(index) {
    const raw = () => h.src(h.s0);
    const amount = () => values.distortion;
    const strobe = () => {
      const k = amount(), rate = 4 + k * 10;
      return 1 - k * Number((performance.now() / 1000 * rate) % 1 < 0.5);
    };
    const tiles = () => (amount() < 0.34 ? 2 : amount() < 0.67 ? 3 : 4);
    // Each preset is RT-driven (amount 0 = untouched source). Order matches
    // EFFECT_NAMES in mapping/vjEffects.js.
    const presets = [
      // 回声: soft noise warp
      () => raw().modulate(h.noise(3, 0.12), () => amount() * 0.055),
      // 波纹: diagonal wave ripple
      () => raw().modulate(h.osc(12, 0.08, 0).rotate(0.6), () => amount() * 0.085),
      // 漩涡: rotation grows toward the centre (radial gradient as rotation map)
      () => raw().modulateRotate(h.shape(64, 0, 1.5), () => amount() * 5),
      // 隧道: radial rings drive zoom — concentric pull toward the middle
      () => raw().modulateScale(h.osc(18, -0.25, 0).kaleid(200), () => amount() * 0.9, 1),
      // 扫描故障: horizontal bands, gated by noise, shove rows sideways
      () => raw().modulateScrollX(h.osc(40, 0.8, 0).rotate(Math.PI / 2).thresh(0.5)
        .mult(h.noise(4, 1.2).thresh(0)), () => amount() * 0.4, 0),
      // 频闪: square-wave black-out, faster and deeper as RT rises
      () => raw().color(strobe, strobe, strobe),
      // 色阶: posterized bands, fewer levels as RT rises
      () => raw().blend(raw().posterize(() => 10 - amount() * 7, 0.6), amount),
      // 版画: hard luma threshold, the bar rising with RT
      () => raw().blend(raw().thresh(() => 0.18 + amount() * 0.22, 0.03), () => Math.min(1, amount() * 3)),
      // 分屏: 2×2 → 3×3 → 4×4 tiling
      () => raw().blend(raw().repeat(tiles, tiles), () => Math.min(1, amount() / 0.15)),
      // 液化: the last output displaces the source — melting water surface
      () => raw().modulate(h.src(h.o0).scale(1.01), () => amount() * 0.12),
    ];
    const live = (presets[index] ?? presets[0])();
    // freeze (R3) pins o0 to its previous frame: blend amount → 1
    live.blend(h.src(h.o0).scale(() => 1 + values.feedback * 0.012)
      .rotate(() => values.feedback * 0.002), () => Math.max(values.feedback * 0.92, fx.levels.freeze)).out(h.o0);
    // Button layers (W3c) run as post passes so they never feed back into o0.
    // Every parameter at 0 is an identity. o1: geometry, o2: color.
    const lerp = (a, b, t) => a + (b - a) * t;
    const cells = (full, few) => () => (fx.levels.pixel > 0 ? lerp(full, few, fx.levels.pixel) : 4096);
    h.src(h.o0).pixelate(cells(400, 64), cells(240, 36))
      // Y 霓虹描边: neighbour differences = outlines, boosted and tinted a slowly
      // cycling cyan↔magenta, over a dimmed copy of the frame
      // (small differences need a plain gain — contrast() pivots on 0.5 and
      // crushes them to black)
      .blend(h.src(h.o0).diff(h.src(h.o0).scrollX(0.002))
        .add(h.src(h.o0).diff(h.src(h.o0).scrollY(0.0035)))
        .saturate(0)
        .color(() => 7 * (0.55 + 0.45 * Math.sin(performance.now() / 1400)), 6.5, () => 7 * (0.55 + 0.45 * Math.cos(performance.now() / 1400)))
        .add(h.src(h.o0).color(0.22, 0.22, 0.26)), () => fx.levels.edge).out(h.o1);
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
