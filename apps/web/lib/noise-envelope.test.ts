import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('detects completed tapered 100 ms bursts without stationary, subthreshold, or square-spike false alarms', () => {
  expect(() => execFileSync(process.execPath, ['scripts/benchmark-noise-envelope.mjs'], {
    env: { ...process.env, NOISE_ENVELOPE_NO_REPORT: '1' }, timeout: 30000, stdio: 'pipe',
  })).not.toThrow();
}, 30000);
