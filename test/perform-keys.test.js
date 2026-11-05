import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performAction, performFromUrl } from '../src/ui/performKeys.js';

const key = (code, extra = {}) => ({ code, repeat: false, target: { closest: () => null }, ...extra });

test('H toggles the console, F toggles fullscreen, other keys do nothing', () => {
  assert.equal(performAction(key('KeyH')), 'toggle-hud');
  assert.equal(performAction(key('KeyF')), 'toggle-fullscreen');
  assert.equal(performAction(key('Space')), null);
  assert.equal(performAction(null), null);
});

test('repeats, modifier shortcuts and typing in form fields are ignored', () => {
  assert.equal(performAction(key('KeyH', { repeat: true })), null);
  assert.equal(performAction(key('KeyF', { ctrlKey: true })), null);
  assert.equal(performAction(key('KeyH', { target: { closest: () => ({}) } })), null);
});

test('perform=1 starts hidden only on the VJ page', () => {
  assert.equal(performFromUrl(new URLSearchParams('vj=1&perform=1')), true);
  assert.equal(performFromUrl(new URLSearchParams('perform=1')), false);
  assert.equal(performFromUrl(new URLSearchParams('vj=1')), false);
});
