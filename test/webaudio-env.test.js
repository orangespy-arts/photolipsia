import { ok, deepStrictEqual } from 'node:assert';
import test from 'node:test';

import { follower, onsetEnvelope, fluxTrigger } from '../src/drivers/webaudio/env.js';

const DT = 1 / 60;

test('follower: attacks fast toward rises, releases slow toward falls', () => {
  const s = { value: 0 };
  // attack: after 100ms at full target, should be most of the way up
  for (let i = 0; i < 6; i++) follower(s, 1, DT, { attack: 0.05, release: 0.2 });
  ok(s.value > 0.6, `attack too slow: ${s.value}`);
  // release: switch target to 0; after one release-tau (200ms = 12 frames),
  // an exponential decay has eaten ~63% — value ≈ afterAttack * e^-1
  const afterAttack = s.value;
  for (let i = 0; i < 12; i++) follower(s, 0, DT, { attack: 0.05, release: 0.2 });
  ok(s.value < afterAttack * 0.4, `release should decay: ${s.value} vs start ${afterAttack}`);
});

test('follower: huge dt (tab hidden) snaps instead of crawling', () => {
  const s = { value: 0 };
  follower(s, 1, 5, { attack: 0.05, release: 0.2 });
  deepStrictEqual(s.value, 1);
});

test('onsetEnvelope: trigger charges, decays exponentially', () => {
  const s = { value: 0 };
  ok(onsetEnvelope(s, true, 0.9, DT) === 0.9);
  const after50ms = onsetEnvelope(s, false, 0, 0.05);
  ok(after50ms < 0.9 && after50ms > 0.5, `decay: ${after50ms}`);
  // retrigger while decaying with a weaker strength: decays another frame,
  // then takes the max of (decayed value, new strength)
  const retriggered = onsetEnvelope(s, true, 0.5, DT);
  const decayed = after50ms * Math.exp(-DT / 0.2);
  ok(Math.abs(retriggered - Math.max(decayed, 0.5)) < 1e-9);
});

test('onsetEnvelope: strength above 1 clamps (envelope is 0..1)', () => {
  const s = { value: 0 };
  ok(onsetEnvelope(s, true, 5, DT) === 1);
});

test('fluxTrigger: fires above threshold, refractory suppresses doubles', () => {
  const s = { sinceLast: Infinity };
  ok(fluxTrigger(s, 2.5, DT) === true, 'first spike fires');
  ok(fluxTrigger(s, 3.0, DT) === false, 'immediate re-spike suppressed');
  ok(fluxTrigger(s, 2.5, 0.05) === false, 'still inside refractory');
  ok(fluxTrigger(s, 2.5, 0.05) === true, 'after refractory fires again');
  ok(fluxTrigger(s, 1.2, DT) === false, 'below threshold silent');
});
