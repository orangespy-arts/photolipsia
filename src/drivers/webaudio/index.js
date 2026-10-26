/**
 * web-audio driver — mic or audio file → AVParams.
 *
 * Browser-only (Web Audio API). The pure math lives in dsp.js / env.js /
 * autogain.js; this file is the glue: AudioContext + AnalyserNode feed a
 * magnitude frame into the analysis pipeline every poll(), and the driver
 * owns ALL smoothing/envelopes/normalization per protocol iron rule 1.
 *
 * Source is chosen at construction:
 *   { source: 'mic' }   — getUserMedia default input
 *   { source: 'file', file } — an <audio>-backed MediaElementSource
 *
 * poll(now) is pull-model per the driver contract. Before start() resolves
 * (permission prompt, file load) poll() returns silence.
 */
import { emptyParams } from '../../protocol/params.js';
import { analyzeFrame, createAnalysisState } from './dsp.js';
import { follower, onsetEnvelope, fluxTrigger } from './env.js';
import { createAutoGainState, applyAutoGain } from './autogain.js';
import { createBeatTracker, beatUpdate, beatPhase } from './beat.js';

const FFT_SIZE = 2048;
const SMOOTH = { attack: 0.05, release: 0.2 }; // protocol-recommended constants

export function createWebAudioDriver({ source = 'mic', file = null, fps = 60, beat: beatEnabled = true } = {}) {
  const analysis = createAnalysisState();
  const gain = createAutoGainState();
  const smooth = {
    low: { value: 0 }, mid: { value: 0 }, high: { value: 0 },
    rms: { value: 0 },
    onsetState: { value: 0 },
    trigState: { sinceLast: 0 },
  };

  let audioCtx = null;
  let analyser = null;
  let mags = null; // Float32Array filled per poll
  let mediaEl = null; // <audio> element for file source
  let started = false;
  let beat = beatEnabled ? createBeatTracker() : null;

  async function start() {
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0; // we own smoothing (iron rule 1)
    mags = new Float32Array(analyser.frequencyBinCount);

    let node;
    if (source === 'mic') {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      node = audioCtx.createMediaStreamSource(stream);
    } else if (source === 'file') {
      if (!file) throw new Error('file source needs a file');
      mediaEl = new Audio();
      mediaEl.src = URL.createObjectURL(file);
      mediaEl.loop = true;
      node = audioCtx.createMediaElementSource(mediaEl);
      await mediaEl.play().catch(() => { /* autoplay block: user gesture resumes */ });
    } else {
      throw new Error(`unknown web-audio source "${source}"`);
    }

    node.connect(analyser);
    // analyser → destination omitted for mic (feedback); file needs it:
    if (source === 'file') node.connect(audioCtx.destination);
    await audioCtx.resume();
    started = true;
  }

  function stop() {
    mediaEl?.pause();
    audioCtx?.close();
    started = false;
  }

  function poll(nowSeconds = 0) {
    const p = emptyParams('web-audio', nowSeconds);
    if (!started || !analyser) return p;
    const dt = 1 / fps;

    analyser.getFloatFrequencyData(mags);
    // getFloatFrequencyData returns dB (−∞..0); convert to linear magnitudes
    const linear = Float32Array.from(mags, (db) => (db > -1000 ? 10 ** (db / 20) : 0));

    const a = analyzeFrame(linear, analysis, {
      binHz: audioCtx.sampleRate / FFT_SIZE,
      nyquistHz: audioCtx.sampleRate / 2,
    });

    // auto-gain on raw energies
    const norm = applyAutoGain(gain, { rms: (a.bands.low + a.bands.mid + a.bands.high) / 3, bands: a.bands }, dt);

    // smoothing: fast attack, slow release (results semantics: "perceived energy")
    p.bands.low = follower(smooth.low, norm.bands.low, dt, SMOOTH);
    p.bands.mid = follower(smooth.mid, norm.bands.mid, dt, SMOOTH);
    p.bands.high = follower(smooth.high, norm.bands.high, dt, SMOOTH);
    p.rms = follower(smooth.rms, norm.rms, dt, SMOOTH);

    // onset: flux trigger + charge/decay envelope (driver-owned, iron rule 1)
    const hit = fluxTrigger(smooth.trigState, a.fluxRatio, dt);
    p.onset = onsetEnvelope(smooth.onsetState, hit, Math.min(1, a.fluxRatio / 3), dt);

    // beat: onset-grid autocorrelation; confidence-gated (speech → 0).
    // beatPhase stays 0 when the tracker is off or unconvinced — protocol:
    // "no beat source → constant 0".
    if (beat) {
      beatUpdate(beat, nowSeconds, hit);
      const { phase, confidence } = beatPhase(beat, nowSeconds);
      p.beatPhase = confidence > 0.1 ? phase : 0;
    }

    p.centroid = a.centroid;
    p.flatness = a.flatness;
    p.time = nowSeconds;
    return p;
  }

  return {
    id: 'web-audio',
    source,
    start,
    stop,
    poll,
    // beat tracking toggle (UI switch): true = estimate from onsets
    setBeatEnabled(on) {
      if (on && !beat) beat = createBeatTracker();
      if (!on) beat = null;
    },
    get beatEnabled() { return beat != null; },
  };
}
