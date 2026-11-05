import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTROL_MAP, activeRows } from '../src/ui/controlMap.js';
import { FX_BUTTONS, fxState } from '../src/mapping/buttonFx.js';
import { START_BUTTON } from '../src/mapping/sceneSwitch.js';

test('key map lists every mapped button exactly once and real toggle names', () => {
  const listed = CONTROL_MAP.flatMap((r) => r.buttons ?? []);
  assert.equal(new Set(listed).size, listed.length, 'no button listed twice');
  for (const i of [...Object.values(FX_BUTTONS), START_BUTTON, 4, 5, 6, 7, 12, 13]) assert.ok(listed.includes(i), `button ${i}`);
  const toggles = Object.keys(fxState().toggles);
  for (const r of CONTROL_MAP.filter((r) => r.toggle)) assert.ok(toggles.includes(r.toggle), r.toggle);
});

test('rows light up for held buttons, deflected sticks, triggers and active toggles', () => {
  const pad = { axes: [0, 0.9, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === 9, value: i === 7 ? 0.5 : 0 })) };
  const fx = { toggles: { edge: true } };
  const on = activeRows(pad, fx);
  const at = (input) => on[CONTROL_MAP.findIndex((r) => r.input === input)];
  assert.equal(at('左摇杆'), true); assert.equal(at('右摇杆'), false);
  assert.equal(at('Start'), true); assert.equal(at('RT'), true);
  assert.equal(at('Y（开/关）'), true); assert.equal(at('X（开/关）'), false);
  assert.deepEqual(activeRows(null, null), CONTROL_MAP.map(() => false));
});
