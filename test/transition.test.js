import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transitionState, startTransition, advanceTransition, WAIT_MAX, IN_SECONDS, SCATTER_OUT } from '../src/mapping/transition.js';

const run = (state, frames, input = () => ({})) => {
  let r = { state };
  const log = [];
  for (let i = 0; i < frames; i++) { r = advanceTransition(r.state, { dt: 1 / 60, ...input(i) }); log.push(r); }
  return log;
};
// full transition; the new scene reports ready `loadFrames` after the swap
function playThrough(type, loadFrames = 30, frames = 260) {
  let r = { state: startTransition(transitionState(), type) }, swapped = -1;
  const log = [];
  for (let i = 0; i < frames; i++) {
    r = advanceTransition(r.state, { dt: 1 / 60, ready: swapped >= 0 && i - swapped > loadFrames });
    if (r.events.swap) swapped = i;
    log.push(r);
  }
  return log;
}

test('dissolve: capture happens one frame before the swap; the still covers the whole load', () => {
  const log = playThrough('dissolve', 30, 200);
  const cap = log.findIndex((r) => r.events.capture), swap = log.findIndex((r) => r.events.swap);
  assert.ok(cap >= 0 && swap === cap + 1, `capture ${cap} then swap ${swap}`);
  const loading = log.filter((r) => r.state.phase === 'load');
  assert.ok(loading.length > 20 && loading.every((r) => r.still === 1), 'still on screen while loading');
  const fading = log.filter((r) => r.state.phase === 'in').map((r) => r.still);
  assert.ok(fading.every((a, i) => i === 0 || a <= fading[i - 1]), 'monotonic dissolve');
  assert.equal(log.at(-1).state.phase, 'idle'); assert.equal(log.at(-1).still, 0);
  assert.ok(log.every((r) => r.scatter === 0));
});

test('particles: old scene scatters partway, is frozen, new scene gathers in under the dissolving still', () => {
  const log = playThrough('particles');
  const cap = log.findIndex((r) => r.events.capture);
  const outScatter = log.slice(0, cap + 1).map((r) => r.scatter);
  assert.ok(outScatter.every((v, i) => i === 0 || v >= outScatter[i - 1]), 'monotonic scatter-out');
  assert.ok(Math.abs(log[cap].scatter - SCATTER_OUT) < 1e-9, 'frozen at the partial scatter');
  const loading = log.filter((r) => r.state.phase === 'load');
  assert.ok(loading.every((r) => r.still === 1 && r.scatter === 1), 'frozen cloud covers; new scene hidden');
  const inn = log.filter((r) => r.state.phase === 'in');
  assert.ok(inn.length >= Math.floor(IN_SECONDS.particles * 60) - 1);
  assert.ok(inn.every((r, i) => i === 0 || (r.scatter <= inn[i - 1].scatter && r.still <= inn[i - 1].still)), 'gather + dissolve together');
  assert.equal(log.at(-1).state.phase, 'idle'); assert.equal(log.at(-1).scatter, 0); assert.equal(log.at(-1).still, 0);
});

test('beat gate: waits for an onset with sound, at most WAIT_MAX; no sound starts at once', () => {
  const s = startTransition(transitionState(), 'dissolve');
  const quiet = run(s, 30, () => ({ hasSound: true, onset: 0.2 }));
  assert.ok(quiet.every((r) => r.state.phase === 'wait'));
  assert.equal(advanceTransition(quiet.at(-1).state, { dt: 1 / 60, hasSound: true, onset: 0.8 }).state.phase, 'out');
  const never = run(s, Math.ceil(WAIT_MAX * 60) + 2, () => ({ hasSound: true, onset: 0 }));
  assert.notEqual(never.at(-1).state.phase, 'wait', 'timeout');
  assert.equal(advanceTransition(s, { dt: 1 / 60, hasSound: false }).state.phase, 'out');
});

test('load failure still reveals; a second start while busy is ignored; unknown type → dissolve', () => {
  const log = run(startTransition(transitionState(), 'dissolve'), 6, () => ({ failed: true }));
  assert.ok(log.some((r) => r.state.phase === 'in'));
  const busy = log[1].state;
  assert.equal(startTransition(busy, 'particles'), busy);
  assert.equal(startTransition(transitionState(), 'wipe').type, 'dissolve');
});
