import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

// Real current production worker + Silero, twelve checksummed recordings.
// Deliberately no test.fail(), skips, or snapshot expectations of broken behavior.
test('human recording fixtures meet measurement acceptance expectations', async () => {
  test.setTimeout(240000);
  const result = await promisify(execFile)(process.execPath, ['scripts/benchmark-human-speech.mjs'], {
    env: {...process.env, FIXTURE_ACCEPTANCE: '1'}, timeout: 230000, maxBuffer: 1024 * 1024
  }).then(({stdout, stderr}) => ({code: 0, stdout, stderr}), error => ({code: error.code, stdout: error.stdout, stderr: error.stderr}));
  expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
});

test('STARSS22 recorded-room components meet frozen stability and retry expectations', async () => {
  test.setTimeout(240000);
  for (const args of [[], ['--evaluation']]) {
    const result = await promisify(execFile)(process.execPath, ['scripts/benchmark-starss22.mjs', ...args], {
      env: { ...process.env, STARSS22_NO_REPORT: '1' }, timeout: 110000, maxBuffer: 1024 * 1024,
    }).then(({ stdout, stderr }) => ({ code: 0, stdout, stderr }), error => ({ code: error.code, stdout: error.stdout, stderr: error.stderr }));
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
  }
});

test('speech continuation improves frozen room crops without added candidate-noise speech', async () => {
  test.setTimeout(180000);
  const result = await promisify(execFile)(process.execPath, ['scripts/benchmark-vad-continuation.mjs', '--evaluation'], {
    env: { ...process.env, VAD_NO_REPORT: '1' }, timeout: 170000, maxBuffer: 1024 * 1024,
  }).then(({ stdout, stderr }) => ({ code: 0, stdout, stderr }), error => ({ code: error.code, stdout: error.stdout, stderr: error.stderr }));
  expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
});


test('annotated component references meet clipping, SNR and noise-stability gates', async () => {
  test.setTimeout(30000);
  const {stdout} = await promisify(execFile)(process.execPath, ['scripts/benchmark-annotated-accuracy.mjs', '--check'], {
    timeout: 25000, maxBuffer: 1024 * 1024,
  });
  expect(JSON.parse(stdout.trim()).failures).toBe(0);
});

test("production worker preserves recording clipping and known selected-component SNR", async () => {
  test.setTimeout(240000);
  const { stdout } = await promisify(execFile)(
    process.execPath,
    ["scripts/benchmark-annotated-accuracy.mjs", "--worker", "--check"],
    {
      timeout: 230000,
      maxBuffer: 1024 * 1024,
    },
  );
  const summary = JSON.parse(stdout.trim().split(/\r?\n/)[0]);
  expect(summary.cases).toBe(34);
  expect(summary.recordingClippingFailures).toBe(0);
  expect(summary.selectedSnrFailures).toBe(0);
});
