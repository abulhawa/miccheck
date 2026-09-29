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

test('unselected clipping is disclosed with conservative certainty on regression and reserved rooms', async () => {
  test.setTimeout(360000);
  for (const args of [[], ['--evaluation']]) {
    const { stdout } = await promisify(execFile)(process.execPath, ['scripts/benchmark-clipping-selection.mjs', ...args, '--check'], {
      timeout: 260000, maxBuffer: 1024 * 1024,
    });
    const summary = JSON.parse(stdout.trim().split(/\r?\n/).at(-1)!);
    expect(summary.cases).toBe(args.length ? 12 : 41);
    expect(summary.failures).toBe(0);
    expect(summary.unsupportedMediumAfter).toBe(0);
  }
});

test('licensed device/language expansion retains exact measurement and introduced-change gates', async () => {
  test.setTimeout(420000);
  const { stdout } = await promisify(execFile)(process.execPath, ['scripts/benchmark-accuracy-expansion.mjs', '--recorded-only', '--check'], {
    timeout: 410000, maxBuffer: 1024 * 1024,
  });
  const summary = JSON.parse(stdout.trim().split(/\r?\n/).at(-1)!);
  expect(summary.cases).toBe(90);
  expect(summary.failures).toBe(0);
  // Native background is not independently decomposed. Stationary-injected
  // mixture disagreements stay in the report; they are not assigned false-alarm
  // truth. Exact generated negatives run separately and exit nonzero on failure.
});

test('separated short noise dips do not accumulate into sustained-change retries', async () => {
  test.setTimeout(180000);
  const {stdout} = await promisify(execFile)(process.execPath, ['scripts/benchmark-noise-separated-decrease.mjs', '--check'], {
    timeout: 170000, maxBuffer: 1024 * 1024,
  });
  const summaries = JSON.parse(stdout.trim());
  expect(summaries.map((row: {cases: number}) => row.cases)).toEqual([24, 72, 24]);
  for (const row of summaries) {
    expect(row.misses).toBe(0);
    expect(row.falseAlarms).toBe(0);
  }
});
