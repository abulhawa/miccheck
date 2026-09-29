import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('rejects phase-shifted 10 ms spikes while detecting 100 ms bursts and retaining controls', () => {
  expect(() => execFileSync(process.execPath, ['scripts/benchmark-noise-phase.mjs'], {
    env: { ...process.env, NOISE_PHASE_NO_REPORT: '1' }, timeout: 30000, stdio: 'pipe',
  })).not.toThrow();
}, 35000);
