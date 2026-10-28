import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { turnView, viewOffset, bindMouseLook } from '../src/render/mouseLook.js';
import { createExplorer } from '../src/render/explorer.js';

function event(target, type, properties = {}) {
  const e = new Event(type, { cancelable: true });
  Object.assign(e, properties); target.dispatchEvent(e);
}

test('mouse right turns heading right; pitch stays above ground and below vertical', () => {
  const view = turnView({ yaw: 0, pitch: 0.4 }, Math.PI / 2 / 0.0025, 0);
  assert.ok(Math.abs(view.yaw - Math.PI / 2) < 1e-9);
  const offset = viewOffset(view, 3.5);
  assert.ok(offset[0] < 0); assert.ok(offset[1] > 0);
  assert.ok(Math.abs(Math.hypot(...offset) - 3.5) < 1e-9);
  assert.equal(turnView(view, 0, -1e6).pitch, 0.04);
  assert.equal(turnView(view, 0, 1e6).pitch, 1.25);
  assert.deepEqual(turnView(view, NaN, Infinity), view);
});

test('pointer lock is user-triggered, scoped to canvas, resets input on unlock and cleans up', () => {
  const canvas = new EventTarget(), doc = new EventTarget(), target = new EventTarget();
  let ready = false, requests = 0, resets = 0, turns = 0, status = '';
  canvas.requestPointerLock = () => { requests++; doc.pointerLockElement = canvas; event(doc, 'pointerlockchange'); };
  doc.exitPointerLock = () => { doc.pointerLockElement = null; event(doc, 'pointerlockchange'); };
  const binding = bindMouseLook(canvas, doc, target, () => ready, () => turns++, () => resets++, (s) => status = s);
  event(canvas, 'click'); assert.equal(requests, 0);
  ready = true; event(canvas, 'click'); assert.equal(requests, 1);
  assert.match(status, /Esc/);
  event(doc, 'mousemove', { movementX: 20, movementY: 5 }); assert.equal(turns, 1);
  doc.exitPointerLock(); assert.equal(resets, 2);
  event(doc, 'mousemove', { movementX: 20 }); assert.equal(turns, 1);
  event(canvas, 'click'); doc.hidden = true; event(doc, 'visibilitychange');
  assert.equal(doc.pointerLockElement, null);
  binding.dispose(); event(canvas, 'click'); assert.equal(requests, 2);
});

test('rejected lock offers right-drag fallback without unhandled rejection', async () => {
  const canvas = new EventTarget(), doc = new EventTarget(), target = new EventTarget();
  const turns = []; let status = '';
  canvas.requestPointerLock = () => Promise.reject(new Error('denied'));
  const binding = bindMouseLook(canvas, doc, target, () => true, (x, y) => turns.push([x, y]), () => {}, (s) => status = s);
  event(canvas, 'click'); await Promise.resolve();
  assert.match(status, /Right-drag/);
  event(canvas, 'pointerdown', { button: 2, pointerId: 1, clientX: 100, clientY: 100 });
  event(canvas, 'pointermove', { pointerId: 1, clientX: 120, clientY: 90 });
  assert.deepEqual(turns, [[20, -10]]);
  event(doc, 'pointerup');
  event(canvas, 'pointermove', { pointerId: 1, clientX: 140, clientY: 90 });
  assert.equal(turns.length, 1); binding.dispose();
});

test('turning 90 degrees makes W move right in world coordinates; Esc-style unlock stops movement', (t) => {
  const priorWindow = globalThis.window, priorDocument = globalThis.document;
  const target = new EventTarget(), doc = new EventTarget(), canvas = new EventTarget();
  globalThis.window = target; globalThis.document = doc;
  t.after(() => { globalThis.window = priorWindow; globalThis.document = priorDocument; });
  canvas.requestPointerLock = () => { doc.pointerLockElement = canvas; event(doc, 'pointerlockchange'); };
  doc.exitPointerLock = () => { doc.pointerLockElement = null; event(doc, 'pointerlockchange'); };
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const explorer = createExplorer({ scene, camera, canvas, isStageReady: () => true,
    config: { groundY: 0, spawn: [0, 0, 0], cameraOffset: [0, 1.6, 3.2] } });
  t.after(() => explorer.dispose());
  explorer.update(1 / 60); event(canvas, 'click');
  event(doc, 'mousemove', { movementX: Math.PI / 2 / 0.0025, movementY: 0 });
  const direction = new THREE.Vector3(); camera.getWorldDirection(direction);
  assert.ok(direction.x > 0.8);
  event(target, 'keydown', { code: 'KeyW' });
  for (let i = 0; i < 60; i++) explorer.update(1 / 60);
  assert.ok(explorer.position.x > 1);
  assert.ok(Math.abs(explorer.position.z) < 1e-6);
  doc.exitPointerLock(); const stopped = explorer.position.clone();
  explorer.update(0.1); assert.deepEqual(explorer.position.toArray(), stopped.toArray());
});
