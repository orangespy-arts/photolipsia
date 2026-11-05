import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reduceInput, inputState, inputLabels } from '../src/mapping/inputMode.js';

test('music → request → mic → back to music', () => {
  let s = inputState();
  s = reduceInput(s, { type: 'toggle' });
  assert.equal(s.pending, true); assert.equal(s.mode, 'music');
  assert.equal(reduceInput(s, { type: 'toggle' }), s, 'second press while waiting is ignored');
  s = reduceInput(s, { type: 'mic-ok', label: 'USB Audio' });
  assert.deepEqual([s.mode, s.pending, s.label], ['mic', false, 'USB Audio']);
  assert.equal(inputLabels(s).canPlay, false);
  assert.match(inputLabels(s).status, /microphone · USB Audio/);
  s = reduceInput(s, { type: 'toggle' });
  assert.equal(s.mode, 'music'); assert.equal(inputLabels(s, 'a.wav').canPlay, true);
  assert.match(inputLabels(s, 'a.wav').status, /music file · a.wav/);
});

test('denied permission stays on music and shows why', () => {
  let s = reduceInput(inputState(), { type: 'toggle' });
  s = reduceInput(s, { type: 'mic-failed', error: 'Microphone permission denied' });
  assert.equal(s.mode, 'music'); assert.equal(s.pending, false);
  assert.equal(inputLabels(s).status, 'Microphone permission denied');
  assert.equal(reduceInput(s, { type: 'toggle' }).error, '', 'retrying clears the message');
});

test('device lost mid-show falls back to music; stray events are ignored', () => {
  let s = reduceInput(reduceInput(inputState(), { type: 'toggle' }), { type: 'mic-ok', label: 'mic' });
  s = reduceInput(s, { type: 'mic-ended' });
  assert.equal(s.mode, 'music'); assert.match(s.error, /disconnected/);
  const music = inputState();
  assert.equal(reduceInput(music, { type: 'mic-ended' }), music);
  assert.equal(reduceInput(music, { type: 'mic-ok' }), music, 'late grant after leaving is ignored');
  assert.equal(reduceInput(music, { type: 'nonsense' }), music);
});
