import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const bundle = await build({ entryPoints: [path.join(root, 'packages/audio-metrics/src/guided.ts')], bundle: true, write: false, platform: 'node', format: 'esm', alias: { '@miccheck/audio-core': path.join(root, 'packages/audio-core/src/index.ts') } });
const { analyzeGuidedSamples } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const rows = [];
for (const rate of [16000, 22050, 44100, 48000, 96000]) {
  for (const phaseMs of [0, 5, 10, 15, 20]) {
    for (const shape of ['square', 'linear', 'cosine']) {
      for (const condition of ['burst', 'spike', 'stationary', 'subthreshold']) {
        const samples = new Float32Array(Math.round(5.3 * rate));
        const start = Math.round((4.55 + phaseMs / 1000) * rate);
        const plateau = Math.round((condition === 'spike' ? .01 : .1) * rate);
        const ramp = shape === 'square' ? 0 : Math.round(.025 * rate);
        const end = start + plateau + 2 * ramp;
        for (let i = 0; i < samples.length; i++) {
          let envelope = 0;
          if (i >= start && i < end) {
            envelope = ramp ? Math.min(1, (i - start) / ramp, (end - i) / ramp) : 1;
            if (shape === 'cosine') envelope = (1 - Math.cos(Math.PI * envelope)) / 2;
          }
          const rise = condition === 'burst' ? 7 : condition === 'spike' ? 18 : condition === 'subthreshold' ? 5 : 0;
          samples[i] = .003 * (i % 2 ? -1 : 1) * (1 + envelope * (10 ** (rise / 20) - 1));
          if (i >= 2 * rate && i < 4 * rate) samples[i] += .1 * Math.sin(2 * Math.PI * 200 * i / rate);
        }
        const result = analyzeGuidedSamples(samples, rate, { use_case: 'meetings', device_type: 'unknown', mode: 'basic' }, { quietSeconds: 2, speechDetection: 'silero', segments: [{ start: 2, end: 4 }], capture: { format: 'pcm' } });
        // A tapered spike has >10 ms elevated support; do not impose the square-spike policy on it.
        const expected = condition === 'burst' ? 'unstable' : condition === 'spike' && ramp ? null : 'stable';
        rows.push({ rate, phaseMs, shape, condition, eventSamples: [start, end], plateauSamples: plateau, rampSamples: ramp, expected, actual: result.evidence.noiseStability, retryReason: result.evidence.retryReason ?? null, state: result.specialState ?? 'graded' });
      }
    }
  }
}
const misses = rows.filter(r => r.expected === 'unstable' && r.actual !== r.expected).length;
const falseAlarms = rows.filter(r => r.expected === 'stable' && r.actual !== r.expected).length;
if (process.env.NOISE_ENVELOPE_NO_REPORT !== '1') await writeFile(path.join(root, 'docs/noise-envelope-results.json'), JSON.stringify({ description: 'Exact-label generated development diagnostic. Tapered spikes have no acceptance label pending duration-policy evidence; no representative acoustic accuracy claim.', parameters: { noiseRms: .003, calibrationSeconds: 2, speechInterval: [2, 4], onsetSeconds: 4.55, rampSeconds: .025, burstPlateauSeconds: .1 }, misses, falseAlarms, rows }, null, 2) + '\n');
console.log(`${rows.length} conditions: ${misses} missed bursts, ${falseAlarms} control false alarms; ${rows.filter(r => r.expected === null).length} exploratory tapered spikes`);
if (misses || falseAlarms) process.exitCode = 1;
