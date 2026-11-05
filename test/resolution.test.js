import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRes, DEFAULT_RES } from '../src/render/resolution.js';

test('parses WxH, defaults to 1080p, clamps and keeps sizes even', () => {
  assert.deepEqual(parseRes('1280x720'), { width: 1280, height: 720 });
  assert.deepEqual(parseRes(' 1920×1080 '), { width: 1920, height: 1080 });
  assert.deepEqual(parseRes(null), DEFAULT_RES);
  assert.deepEqual(parseRes('big'), DEFAULT_RES);
  assert.deepEqual(parseRes('19200x1080'), DEFAULT_RES);
  assert.deepEqual(parseRes('4000x200'), { width: 3840, height: 320 });
  assert.deepEqual(parseRes('1281x721'), { width: 1282, height: 722 });
});
