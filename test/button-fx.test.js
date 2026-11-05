import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceButtonFx, fxState, fxActive, fxLabel, FX_BUTTONS, HUE_RATE } from '../src/mapping/buttonFx.js';

const pad = (...held) => ({ standard: true,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: held.includes(i), value: held.includes(i) ? 1 : 0 })) });
const run = (state, p, frames = 1, dt = 1 / 60) => { for (let i = 0; i < frames; i++) state = advanceButtonFx(state, p, dt); return state; };

test('first frame only arms; a button held at arm time does not toggle', () => {
  let s = advanceButtonFx(fxState(), pad(FX_BUTTONS.X), 1 / 60);
  assert.equal(s.armed, true); assert.equal(s.toggles.shift, false);
  s = run(s, pad(FX_BUTTONS.X), 10); assert.equal(s.toggles.shift, false);
});

test('X/Y/Back/L3 toggle on press edge and fade in/out', () => {
  let s = run(fxState(), pad());
  for (const [name, button] of [['shift', FX_BUTTONS.X], ['edge', FX_BUTTONS.Y], ['mono', FX_BUTTONS.BACK], ['pixel', FX_BUTTONS.L3]]) {
    s = run(s, pad(button)); assert.equal(s.toggles[name], true, name);
    s = run(s, pad(button), 30); assert.equal(s.toggles[name], true, `${name} held stays`);
    s = run(s, pad(), 60); assert.equal(s.levels[name], 1, `${name} faded in`);
    s = run(s, pad(button)); s = run(s, pad(), 120);
    assert.equal(s.toggles[name], false); assert.equal(s.levels[name], 0, `${name} faded out`);
  }
});

test('A and R3 act only while held', () => {
  let s = run(fxState(), pad());
  s = run(s, pad(FX_BUTTONS.A, FX_BUTTONS.R3), 30);
  assert.equal(s.levels.invert, 1); assert.equal(s.levels.freeze, 1);
  s = run(s, pad(), 120);
  assert.equal(s.levels.invert, 0); assert.equal(s.levels.freeze, 0);
});

test('d-pad left/right rotates hue while held and wraps', () => {
  let s = run(fxState(), pad());
  s = run(s, pad(FX_BUTTONS.RIGHT), 60);
  assert.ok(Math.abs(s.hue - HUE_RATE) < 1e-9);
  s = run(s, pad(), 30); assert.ok(Math.abs(s.hue - HUE_RATE) < 1e-9, 'stays after release');
  s = run(s, pad(FX_BUTTONS.LEFT), 120);
  assert.ok(s.hue > 0.5 && s.hue < 1, 'wrapped below zero');
});

test('B, missing pad, non-standard layout and bad dt clear everything', () => {
  let on = run(run(fxState(), pad()), pad(FX_BUTTONS.X, FX_BUTTONS.RIGHT, FX_BUTTONS.A), 30);
  assert.ok(fxActive(on)); assert.match(fxLabel(on), /色彩分离/);
  for (const [p, dt] of [[pad(FX_BUTTONS.B), 1 / 60], [null, 1 / 60], [{ ...pad(), standard: false }, 1 / 60], [pad(), 1]]) {
    const cleared = advanceButtonFx(on, p, dt);
    assert.equal(fxActive(cleared), false); assert.equal(cleared.toggles.shift, false); assert.equal(fxLabel(cleared), '');
  }
});
