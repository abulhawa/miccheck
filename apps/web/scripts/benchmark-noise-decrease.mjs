import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const baselineRef = process.env.NOISE_DECREASE_BASELINE_REF
  ? execFileSync('git', ['rev-parse', '--verify', process.env.NOISE_DECREASE_BASELINE_REF + '^{commit}'], { cwd: root, encoding: 'utf8' }).trim() : undefined;
const bundle = await build({ entryPoints: [path.join(root, 'packages/audio-metrics/src/guided.ts')],
  bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: baselineRef ? [{ name: 'baseline-guided', setup(builder) {
    builder.onLoad({ filter: /[/\\]audio-metrics[/\\]src[/\\]guided\.ts$/ }, () => ({
      contents: execFileSync('git', ['show', baselineRef + ':packages/audio-metrics/src/guided.ts'], { cwd: root, encoding: 'utf8' }), loader: 'ts',
    }));
  } }] : [],
  alias: { '@miccheck/audio-core': path.join(root, 'packages/audio-core/src/index.ts') } });
const { analyzeGuidedSamples } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const rows = [];
// Freeze generated component labels before comparing the estimator. Evaluation
// uses different sample grids and carriers; these are not physical captures.
for (const rate of [16000, 22050, 44100, 48000]) {
  for (const phaseMs of [0, 50, 100, 150, 200]) {
    for (const condition of ['decrease', 'stationary', 'subthreshold', 'short-dip', 'split-dips', 'below-floor', 'boundary']) {
      const samples = new Float32Array(Math.round(6 * rate));
      const start = Math.round((4.8 + phaseMs / 1000) * rate);
      const end = start + Math.round((condition === 'short-dip' ? .1 : .6) * rate);
      for (let i = 0; i < samples.length; i++) {
        const changed = condition === 'split-dips' ? (i >= start && i < start + Math.round(.25 * rate)) || (i >= start + Math.round(.35 * rate) && i < end)
          : condition === 'boundary' ? i >= 4 * rate && i < 4.28 * rate
          : condition !== 'stationary' && i >= start && i < end;
        const carrier = rate === 16000 ? (i % 2 ? -1 : 1) : Math.SQRT2 * Math.sin(2 * Math.PI * 997 * i / rate);
        samples[i] = (condition === 'below-floor' ? .0003 : .01) * carrier * (changed ? 10 ** (-(condition === 'subthreshold' ? 5 : 9) / 20) : 1);
        if (i >= 2 * rate && i < 4 * rate) samples[i] += .1 * Math.sin(2 * Math.PI * 200 * i / rate);
      }
      const result = analyzeGuidedSamples(samples, rate,
        { use_case: 'meetings', device_type: 'unknown', mode: 'basic' },
        { quietSeconds: 2, speechDetection: 'silero', segments: [{ start: 2, end: 4 }], capture: { format: 'pcm' } });
      rows.push({ split: rate === 16000 ? 'development' : 'evaluation', rate, phaseMs, condition,
        eventSamples: condition === 'stationary' ? null : condition === 'boundary' ? [4 * rate, Math.round(4.28 * rate)] : [start, end],
        expected: condition === 'decrease' ? 'unstable' : 'stable', actual: result.evidence.noiseStability,
        retryReason: result.evidence.retryReason ?? null, state: result.specialState ?? 'graded',
        grade: result.specialState ? null : result.verdict.overall.grade });
    }
  }
}
const misses = rows.filter(r => r.condition === 'decrease' && (r.actual !== r.expected || r.retryReason !== 'noise_unstable' || r.state !== 'INSUFFICIENT_EVIDENCE')).length;
const falseAlarms = rows.filter(r => r.condition !== 'decrease' && (r.actual !== r.expected || r.retryReason !== null || r.state !== 'graded')).length;
if (process.env.NOISE_DECREASE_NO_REPORT !== '1') await writeFile(path.join(root, 'docs', process.env.NOISE_DECREASE_REPORT ?? 'noise-decrease-results.json'), JSON.stringify({
  description: 'Exact generated component intervals; evaluation sample grids/carriers, not held-out devices or human annotations.',
  ...(baselineRef ? { baselineGuidedRef: baselineRef } : {}),
  parameters: { calibrationSeconds: 2, speechInterval: [2, 4], decreaseSeconds: .6, decreaseDb: 9, noiseRms: .01 }, misses, falseAlarms, rows,
}, null, 2) + '\n');
console.log(`${rows.length} conditions: ${misses} missed decreases, ${falseAlarms} control false alarms`);
if (misses || falseAlarms) process.exitCode = 1;
