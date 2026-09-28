import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('detects 100 ms tonal bursts while retaining isolated-spike and subthreshold controls', () => {
  expect(() => execFileSync(process.execPath, ['scripts/benchmark-noise-tone.mjs'], {
    env: { ...process.env, NOISE_TONE_NO_REPORT: '1', NOISE_TONE_REGRESSION: '1' }, timeout: 30000, stdio: 'pipe',
  })).not.toThrow();
}, 30000);
