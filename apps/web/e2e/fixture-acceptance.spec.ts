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
