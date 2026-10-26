/**
 * MIDI driver — Web MIDI API inputs → AVParams.
 *
 * Browser-only (navigator.requestMIDIAccess, Chrome/Edge). The pure
 * logic lives in midiCore.js; this file is the glue: bind every input
 * port, route messages (with their event timestamps) into the core,
 * assemble frames on poll(). Hot-plug handled via statechange.
 *
 * `simulate: true` replaces the hardware path with a scripted
 * "performance" (createMidiSimulator) feeding the same byte stream —
 * full-chain verification without a controller, and a repeatable tuning
 * signal (`?driver=midi&simulate=1`).
 */
import { createMidiCore } from './midiCore.js';
import { createMidiSimulator } from './simulate.js';

export function createMidiDriver({ fps = 60, simulate = false } = {}) {
  const core = createMidiCore({ fps });
  const sim = simulate ? createMidiSimulator() : null;
  let access = null;
  let deviceNames = [];
  let lastMessageAt = 0;
  let pollCount = 0;

  async function start() {
    if (sim) { deviceNames = ['simulated performance']; return; }
    if (!navigator.requestMIDIAccess) {
      throw new Error('Web MIDI not available (needs Chrome/Edge)');
    }
    access = await navigator.requestMIDIAccess({ sysex: false });
    bindPorts();
    access.onstatechange = () => bindPorts(); // hot-plug
  }

  function bindPorts() {
    deviceNames = [];
    for (const input of access.inputs.values()) {
      deviceNames.push(input.name);
      input.onmidimessage = (ev) => {
        // ev.timeStamp is DOMHighResTimeStamp (ms, same origin as
        // performance.now) — the core's atSec uses the same clock
        core.feed(ev.data, ev.timeStamp / 1000);
        lastMessageAt = ev.timeStamp / 1000;
      };
    }
  }

  function stop() {
    if (access) {
      access.onstatechange = null;
      for (const input of access.inputs.values()) input.onmidimessage = null;
    }
    access = null;
  }

  function poll(nowSeconds = 0) {
    pollCount++;
    if (sim) {
      // feed the simulated performance up to this poll's wall-clock time.
      // First poll anchors the schedule at now — no burst replay of the
      // script's t=0..load-time span.
      if (pollCount === 1) sim.anchor(nowSeconds);
      for (const { bytes, atSec } of sim.generate(nowSeconds)) {
        core.feed(bytes, atSec);
        lastMessageAt = atSec;
      }
    }
    return core.poll(nowSeconds);
  }

  return {
    id: 'midi',
    start,
    stop,
    poll,
    get devices() { return deviceNames; },
    get lastMessageAt() { return lastMessageAt; },
  };
}
