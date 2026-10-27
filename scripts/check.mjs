#!/usr/bin/env node
/**
 * Smoke check: runs unit tests, verifies module graph loads, writes
 * .check/report.json. Browser rendering checks (screenshot diff of splat
 * canvas under different mock signals) arrive with the render stage —
 * see ai/strategy.md Next.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const report = { summary: 'ok', tests: null, imports: null, timestamp: new Date().toISOString() };
let failed = false;

// 0. ensure the test splat exists (regenerable, gitignored)
const splatGen = spawnSync(process.execPath, ['scripts/make-test-splat.mjs'], { cwd: ROOT, encoding: 'utf8' });
if (splatGen.status !== 0) {
  failed = true; report.summary = 'test splat generation failed';
  report.splat = splatGen.stderr;
}

// 1. unit tests
const t = spawnSync(process.execPath, ['--test', 'test/**/*.test.js'], { cwd: ROOT, encoding: 'utf8' });
report.tests = {
  exitCode: t.status,
  tail: (t.stdout + t.stderr).split('\n').slice(-12).join('\n'),
};
if (t.status !== 0) { failed = true; report.summary = 'unit tests failed'; }

// 2. module graph loads in node (protocol/drivers/dsp/mapping must be DOM-free)
const imp = spawnSync(
  process.execPath,
  ['-e', `
    const mods = [
      './src/protocol/params.js',
      './src/drivers/registry.js',
      './src/drivers/mock.js',
      './src/drivers/webaudio/dsp.js',
      './src/drivers/webaudio/env.js',
      './src/drivers/webaudio/autogain.js',
      './src/drivers/osc/oscDecode.js',
      './src/drivers/osc/oscMap.js',
      './src/drivers/midi/midiCore.js',
      './src/rec/record.js',
      './src/rec/play.js',
      './src/render/explorerMotion.js',
      './src/render/explorerInput.js',
      './src/render/sceneConfig.js',
      './src/mapping/plants.js',
    ];
    for (const m of mods) await import(m);
    console.log('imports ok');
  `],
  { cwd: ROOT, encoding: 'utf8' },
);
report.imports = { exitCode: imp.status, tail: (imp.stdout + imp.stderr).trim() };
if (imp.status !== 0) { failed = true; report.summary = 'module import failed'; }

await mkdir('.check', { recursive: true });
await writeFile('.check/report.json', JSON.stringify(report, null, 2));
console.log(failed ? `check: FAILED — ${report.summary}` : 'check: OK');
console.log(report.tests.tail);
process.exit(failed ? 1 : 0);
