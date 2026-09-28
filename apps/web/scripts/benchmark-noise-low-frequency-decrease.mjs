import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const source = path.join(root, 'packages/audio-metrics/src/guided.ts');
const bundle = await build({ entryPoints: [source], bundle: true, write: false,
  platform: 'node', format: 'esm',
  alias: { '@miccheck/audio-core': path.join(root, 'packages/audio-core/src/index.ts') } });
const { analyzeGuidedSamples } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const rows = [];
// Exact component labels and split are defined before estimator comparison.
// A positive has 600 ms at -9 dB, excluding its optional 100 ms edge ramps.
// Short dips and 5 dB dips are controls under the existing provisional policy.
for (const rate of [16000, 22050, 48000]) {
  for (const frequency of [20, 55, 120]) {
    for (const phaseMs of [0, 37, 113]) {
      for (const envelope of ['square', 'linear', 'cosine']) {
        for (const condition of ['decrease', 'stationary', 'subthreshold', 'short-dip']) {
          const samples = new Float32Array(6 * rate);
          const start = Math.round((4.65 + phaseMs / 1000) * rate);
          const ramp = envelope === 'square' ? 0 : Math.round(.1 * rate);
          const plateau = Math.round((condition === 'short-dip' ? .1 : .6) * rate);
          const end = start + 2 * ramp + plateau;
          for (let i = 0; i < samples.length; i++) {
            let depth = 0;
            if (condition !== 'stationary' && i >= start && i < end) {
              depth = ramp ? Math.min(1, (i - start) / ramp, (end - i) / ramp) : 1;
              if (envelope === 'cosine') depth = (1 - Math.cos(Math.PI * depth)) / 2;
            }
            samples[i] = .01 * Math.SQRT2 * Math.sin(2 * Math.PI * frequency * i / rate)
              * 10 ** (-depth * (condition === 'subthreshold' ? 5 : 9) / 20);
            if (i >= 2 * rate && i < 4 * rate) samples[i] += .1 * Math.sin(2 * Math.PI * 200 * i / rate);
          }
          const result = analyzeGuidedSamples(samples, rate,
            { use_case: 'meetings', device_type: 'unknown', mode: 'basic' },
            { quietSeconds: 2, speechDetection: 'silero', segments: [{ start: 2, end: 4 }], capture: { format: 'pcm' } });
          const positive = condition === 'decrease';
          rows.push({ split: rate === 16000 ? 'development' : 'evaluation', rate, frequency, phaseMs, envelope, condition,
            eventSamples: condition === 'stationary' ? null : [start, end],
            plateauSamples: condition === 'stationary' ? null : [start + ramp, end - ramp],
            expected: positive ? 'unstable' : 'stable', actual: result.evidence.noiseStability,
            retryReason: result.evidence.retryReason ?? null, state: result.specialState ?? 'graded',
            grade: result.specialState ? null : result.verdict.overall.grade,
            passed: positive ? result.evidence.noiseStability === 'unstable' && result.evidence.retryReason === 'noise_unstable'
              && result.specialState === 'INSUFFICIENT_EVIDENCE'
              : result.evidence.noiseStability === 'stable' && !result.evidence.retryReason && !result.specialState });
        }
      }
    }
  }
}
const summaries = ['development', 'evaluation'].map(split => ({ split,
  conditions: rows.filter(r => r.split === split).length,
  misses: rows.filter(r => r.split === split && r.condition === 'decrease' && !r.passed).length,
  falseAlarms: rows.filter(r => r.split === split && r.condition !== 'decrease' && !r.passed).length }));
await writeFile(path.join(root, 'docs/noise-low-frequency-decrease-results.json'), JSON.stringify({
  description: 'Exact generated noise-component labels and supplied speech intervals; estimator regression evidence, not physical capture or VAD validation.',
  guidedSha256: createHash('sha256').update(await readFile(source)).digest('hex'),
  parameters: { noiseRms: .01, decreaseDb: 9, plateauSeconds: .6, rampSeconds: .1, calibrationSeconds: 2, speechInterval: [2, 4] },
  summaries, rows }, null, 2) + '\n');
console.log(JSON.stringify(summaries));
if (rows.some(r => !r.passed)) process.exitCode = 1;
