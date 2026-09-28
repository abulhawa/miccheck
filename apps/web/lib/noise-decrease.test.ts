import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('detects sustained noise decreases across onset phases without retrying short dips or controls', () => {
  expect(() => execFileSync(process.execPath, ['scripts/benchmark-noise-decrease.mjs'], {
    env: { ...process.env, NOISE_DECREASE_NO_REPORT: '1' }, timeout: 30000, stdio: 'pipe',
  })).not.toThrow();
}, 35000);
