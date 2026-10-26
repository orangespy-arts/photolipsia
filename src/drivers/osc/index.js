/**
 * OSC driver — WebSocket ← bridge ← UDP ← Max/SC/PD.
 *
 * The DSP side owns analysis, normalization and smoothing (protocol iron
 * rules; the doc's OSC table advice). This driver only decodes packets,
 * assembles frames, and guards against a dead link: no packets for a
 * moment → fields decay to 0 (a frozen mid-pose is worse than silence).
 */
import { createOscFrameAssembler } from './oscMap.js';
import { decodePacket, OscError } from './oscDecode.js';

const LINK_TIMEOUT = 0.5; // s without packets → release to zero
const RELEASE_TAU = 0.3;
const RECONNECT_MIN = 0.5, RECONNECT_MAX = 8; // s, exponential backoff

export function createOscDriver({ url = 'ws://localhost:9128', fps = 60 } = {}) {
  const assembler = createOscFrameAssembler();
  const decaying = { rms: 0, low: 0, mid: 0, high: 0, onset: 0, centroid: 0.5, flatness: 0, beatPhase: 0 };
  let ws = null;
  let lastPacket = -Infinity;
  let reconnectTimer = null;
  let stopped = false;

  function connect() {
    if (stopped) return;
    try {
      ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => { backoff = RECONNECT_MIN; };
      ws.onmessage = (ev) => {
        if (!(ev.data instanceof ArrayBuffer)) return; // bridge sends binary only
        try {
          for (const m of decodePacket(new Uint8Array(ev.data))) assembler.feed(m);
          lastPacket = performance.now() / 1000;
        } catch (err) {
          if (!(err instanceof OscError)) throw err; // decode errors: drop packet
        }
      };
      ws.onclose = scheduleReconnect;
      ws.onerror = () => ws.close();
    } catch {
      scheduleReconnect();
    }
  }
  let backoff = RECONNECT_MIN;
  function scheduleReconnect() {
    if (stopped || reconnectTimer) return;
    reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, backoff * 1000);
    backoff = Math.min(RECONNECT_MAX, backoff * 2);
  }

  function poll(nowSeconds = 0) {
    const dt = 1 / fps;
    const live = nowSeconds - lastPacket < LINK_TIMEOUT;
    const { params } = assembler.takeFrame(nowSeconds);
    if (live) {
      // link is alive: DSP values are authoritative, passthrough
      Object.assign(decaying, params, { bands: { ...params.bands } });
    } else {
      // dead link: decay everything toward 0 (and centroid to neutral)
      const k = Math.exp(-dt / RELEASE_TAU);
      decaying.rms *= k; decaying.onset *= k; decaying.flatness *= k; decaying.beatPhase = 0;
      decaying.centroid += (0.5 - decaying.centroid) * k;
      for (const b of ['low', 'mid', 'high']) decaying.bands[b] *= k;
    }
    return { ...decaying, bands: { ...decaying.bands }, events: live ? params.events : [], version: params.version, source: 'osc', time: nowSeconds };
  }

  return {
    id: 'osc',
    start() { stopped = false; connect(); },
    stop() { stopped = true; ws?.close(); if (reconnectTimer) clearTimeout(reconnectTimer); },
    poll,
  };
}
