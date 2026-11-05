import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceSceneSwitch, sceneSwitchState, START_BUTTON } from '../src/mapping/sceneSwitch.js';

const pad = (start) => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  buttons[START_BUTTON] = { pressed: start, value: start ? 1 : 0 };
  return { standard: true, buttons };
};

test('one Start press advances exactly one scene; holding does not chain', () => {
  let r = advanceSceneSwitch(sceneSwitchState(0), pad(false), 10);
  assert.equal(r.switched, false); assert.equal(r.state.armed, true);
  r = advanceSceneSwitch(r.state, pad(true), 10);
  assert.equal(r.switched, true); assert.equal(r.state.index, 1);
  for (let i = 0; i < 30; i++) { r = advanceSceneSwitch(r.state, pad(true), 10); assert.equal(r.switched, false); }
  r = advanceSceneSwitch(r.state, pad(false), 10);
  r = advanceSceneSwitch(r.state, pad(true), 10);
  assert.equal(r.state.index, 2);
});

test('wraps from the last scene to the first', () => {
  let r = advanceSceneSwitch({ index: 9, armed: true }, pad(true), 10);
  assert.equal(r.switched, true); assert.equal(r.state.index, 0);
});

test('Start held while unarmed (page entry, after load, after pause) needs release first', () => {
  let r = advanceSceneSwitch(sceneSwitchState(3), pad(true), 10);
  assert.equal(r.switched, false); assert.equal(r.state.armed, false);
  r = advanceSceneSwitch(r.state, null, 10); // loading / paused: flight reports no pad
  r = advanceSceneSwitch(r.state, pad(true), 10);
  assert.equal(r.switched, false); assert.equal(r.state.index, 3);
});

test('missing pad, non-standard layout or bad count disarm without switching', () => {
  const armed = { index: 4, armed: true };
  for (const [p, count] of [[null, 10], [{ ...pad(true), standard: false }, 10], [pad(true), 1], [pad(true), NaN]]) {
    const r = advanceSceneSwitch(armed, p, count);
    assert.equal(r.switched, false); assert.equal(r.state.index, 4); assert.equal(r.state.armed, false);
  }
});
