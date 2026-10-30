import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialPortalState, advancePortal, boundaryClearance, portalOutline } from '../src/render/portalState.js';
import { SCENES, sceneAssetUrl } from '../src/render/sceneCatalog.js';
import { isSafe, constrainMotion } from '../src/render/navigation.js';
import { sceneConfig } from '../src/render/sceneConfig.js';

test('catalog points at the shared directory; each spawn fits and can rearm after arrival', () => {
  for (const scene of SCENES) {
    assert.ok(sceneAssetUrl(scene).startsWith('/3dscene/'));
    assert.equal(decodeURIComponent(sceneAssetUrl(scene)).split('/').at(-1), scene.file);
    const p = [...scene.explorer.spawn]; p[1] += 0.22;
    assert.ok(isSafe(p, 0.22, scene.explorer.navigation));
    assert.ok(boundaryClearance(p, scene.explorer.navigation) > 1.05);
  }
  assert.equal(sceneConfig(new URLSearchParams('journey=1')).play, true);
  assert.equal(sceneConfig(new URLSearchParams('scene=city')).splatUrl, sceneAssetUrl(SCENES[1]));
});

test('approach triggers inside hard boundary; loading never commits and failure stays in source', () => {
  const p = [0, -0.01, -2], nav = SCENES[0].explorer.navigation;
  const clearance = boundaryClearance(p, nav);
  assert.ok(clearance > 0 && clearance < 0.85);
  let state = initialPortalState();
  for (let i = 0; i < 300; i++) {
    state = advancePortal(state, { dt: 0.1, clearance, ready: false, failed: false });
    assert.equal(state.phase, 'waiting'); assert.ok(!state.commit);
  }
  const blocked = constrainMotion(p, [0, -0.01, -100], [0, 0, -20], 0.22, nav);
  assert.ok(isSafe(blocked.position, 0.22, nav));
  state = advancePortal(state, { dt: 0.1, clearance, failed: true });
  assert.equal(state.phase, 'error'); assert.ok(!state.commit);
  state = advancePortal(state, { dt: 0.1, clearance, ready: true, failed: false });
  assert.equal(state.phase, 'error');
  state = advancePortal(state, { dt: 0.1, clearance, ready: true, requested: true });
  assert.equal(state.phase, 'opening');
});

test('transition commits once, cooldown prevents retrigger, safe arrival rearms', () => {
  let state = initialPortalState(), commits = 0;
  for (let i = 0; i < 120; i++) {
    state = advancePortal(state, { dt: 0.1, clearance: 0.5, ready: true });
    commits += Number(Boolean(state.commit));
  }
  assert.equal(commits, 1); assert.equal(state.phase, 'cooldown');
  state = advancePortal(state, { dt: 0.1, clearance: 1.5, ready: true });
  assert.equal(state.phase, 'idle');
  state = advancePortal(state, { dt: 0.1, clearance: 0.5, ready: true });
  assert.equal(state.phase, 'opening');
});

test('readiness loss cancels the opening before any world swap; dt cannot skip the effect', () => {
  const opening = { ...initialPortalState(), phase: 'opening', progress: 0.5 };
  assert.equal(advancePortal(opening, { dt: 1, clearance: 0, failed: true }).phase, 'error');
  assert.equal(advancePortal(opening, { dt: 1, clearance: 0, ready: false }).phase, 'waiting');
  assert.ok(advancePortal(opening, { dt: 100, clearance: 0, ready: true }).progress < 0.54);
  assert.equal(opening.progress, 0.5);
});

test('portal contour covers every viewport corner at commit, including portrait and ultrawide', () => {
  for (const [w, h] of [[455, 540], [1280, 720], [3440, 1440], [320, 900]]) {
    const points = portalOutline(1, 7, w, h);
    for (const [x, y] of [[0, 0], [w, 0], [w, h], [0, h]]) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i], [xj, yj] = points[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
      assert.ok(inside, `${w}x${h}: uncovered corner ${x},${y}`);
    }
  }
});
