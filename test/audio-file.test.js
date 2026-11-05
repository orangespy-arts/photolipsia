import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLikelyAudio, displayName, AUDIO_ACCEPT } from '../src/mapping/audioFile.js';

test('accepts audio MIME or known extensions, rejects the Ableton .asd and junk', () => {
  assert.equal(isLikelyAudio({ name: 'mix.wav', type: '' }), true);
  assert.equal(isLikelyAudio({ name: 'track', type: 'audio/mpeg' }), true);
  assert.equal(isLikelyAudio({ name: 'SONG.MP3', type: '' }), true);
  assert.equal(isLikelyAudio({ name: '5songDJ.wav.asd', type: '' }), false);
  assert.equal(isLikelyAudio({ name: 'wav', type: '' }), false);
  assert.equal(isLikelyAudio(null), false);
  assert.match(AUDIO_ACCEPT, /audio\/\*/); assert.match(AUDIO_ACCEPT, /\.flac/);
});

test('display name keeps short names and truncates long ones keeping the extension', () => {
  assert.equal(displayName('5songDJ.wav'), '5songDJ.wav');
  const long = displayName('a very long final master mix version 12.wav', 20);
  assert.equal(long.length, 20); assert.ok(long.endsWith('….wav'));
  assert.equal(displayName(undefined), '');
});
