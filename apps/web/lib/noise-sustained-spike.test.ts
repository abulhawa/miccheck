import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('rejects isolated loud spikes crossing sustained windows while retaining bursts and controls', () => {
  expect(() => execFileSync(process.execPath, ['scripts/benchmark-noise-sustained-spike.mjs'], {
    env: { ...process.env, NOISE_PHASE_NO_REPORT: '1' }, timeout: 30000, stdio: 'pipe',
  })).not.toThrow();
}, 30000);
