import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVec3, parseView, parseTf, fmtVec3, fmtTf } from '../src/render/framing.js';

test('parseVec3 accepts exactly 3 finite numbers', () => {
  assert.deepEqual(parseVec3('1,2.5,-3'), [1, 2.5, -3]);
  assert.deepEqual(parseVec3('0,0,0'), [0, 0, 0]);
});

test('parseVec3 rejects wrong arity and non-numbers', () => {
  assert.equal(parseVec3('1,2'), null);
  assert.equal(parseVec3('1,2,3,4'), null);
  assert.equal(parseVec3('a,b,c'), null);
  assert.equal(parseVec3('1,,3'), null); // empty → NaN
  assert.equal(parseVec3(''), null);
  assert.equal(parseVec3(undefined), null);
});

test('parseView splits look@cam', () => {
  assert.deepEqual(
    parseView('0,1.4,-0.3@0,1.5,2'),
    { lookAt: [0, 1.4, -0.3], camPos: [0, 1.5, 2] },
  );
});

test('parseView accepts bare look (camera keeps default position)', () => {
  assert.deepEqual(parseView('0,0,0'), { lookAt: [0, 0, 0] });
});

test('parseView rejects malformed input', () => {
  assert.equal(parseView(''), null);
  assert.equal(parseView('1,2@3,4,5'), null); // bad look
  assert.equal(parseView(null), null);
});

test('parseTf full form: position @ euler-degrees @ scale', () => {
  assert.deepEqual(
    parseTf('0.26,1.3,-0.2@0,90,0@2.5'),
    { position: [0.26, 1.3, -0.2], rotationDeg: [0, 90, 0], scale: 2.5 },
  );
});

test('parseTf missing segments fall back to rest', () => {
  assert.deepEqual(
    parseTf('1,2,3'),
    { position: [1, 2, 3], rotationDeg: [0, 0, 0], scale: 1 },
  );
  assert.deepEqual(
    parseTf('0,0,0@0,45,0'),
    { position: [0, 0, 0], rotationDeg: [0, 45, 0], scale: 1 },
  );
});

test('parseTf scale must be finite and positive', () => {
  assert.equal(parseTf('0,0,0@0,0,0@-2').scale, 1);
  assert.equal(parseTf('0,0,0@0,0,0@abc').scale, 1);
  assert.equal(parseTf('0,0,0@0,0,0@0').scale, 1);
});

test('parseTf rejects empty', () => {
  assert.equal(parseTf(''), null);
  assert.equal(parseTf(null), null);
});

test('fmtVec3 round-trips through parseVec3', () => {
  const v = [0.26, 1.375, -0.2];
  assert.deepEqual(parseVec3(fmtVec3(v)), v);
});

test('fmtTf rest state serializes empty (omit the param)', () => {
  assert.equal(fmtTf({ position: [0, 0, 0], rotationDeg: [0, 0, 0], scale: 1 }), '');
});

test('fmtTf round-trips through parseTf', () => {
  const tf = { position: [0.5, -1, 2], rotationDeg: [0, 90, -15], scale: 2.5 };
  const parsed = parseTf(fmtTf(tf));
  assert.deepEqual(parsed.position, tf.position);
  assert.deepEqual(parsed.rotationDeg, tf.rotationDeg);
  assert.equal(parsed.scale, tf.scale);
});

test('fmtTf partial state omits rest segments', () => {
  assert.equal(
    fmtTf({ position: [1, 0, 0], rotationDeg: [0, 0, 0], scale: 1 }),
    '1,0,0',
  );
  assert.equal(
    fmtTf({ position: [0, 0, 0], rotationDeg: [0, 0, 0], scale: 2 }),
    '0,0,0@2',
  );
});
