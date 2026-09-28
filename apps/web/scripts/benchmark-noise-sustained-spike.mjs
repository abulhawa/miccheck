import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Exact generated intervals isolate window alignment from uncertain VAD labels.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const baselineRef = process.env.NOISE_SPIKE_BASELINE_REF ? execFileSync('git', ['rev-parse', '--verify', process.env.NOISE_SPIKE_BASELINE_REF + '^{commit}'], { cwd: root, encoding: 'utf8' }).trim() : undefined;
const bundle = await build({ entryPoints: [path.join(root, 'packages/audio-metrics/src/guided.ts')],
  bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: baselineRef ? [{ name: 'baseline-guided', setup(builder) {
    builder.onLoad({ filter: /[/\\\\]audio-metrics[/\\\\]src[/\\\\]guided\.ts$/ }, () => ({
      contents: execFileSync('git', ['show', baselineRef + ':packages/audio-metrics/src/guided.ts'], { cwd: root, encoding: 'utf8' }), loader: 'ts',
    }));
  } }] : [],
  alias: { '@miccheck/audio-core': path.join(root, 'packages/audio-core/src/index.ts') } });
const { analyzeGuidedSamples } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const rows = [];
for (const rate of [16000, 22050, 44100, 48000]) {
  for (const phaseMs of [0, 5, 10, 15, 20]) {
    for (const condition of ['burst', 'stationary', 'spike', 'boundary']) {
      const samples = new Float32Array(Math.round(5.2 * rate));
      const start = Math.round((4.535 + phaseMs / 1000) * rate);
      const end = start + Math.round((condition === 'spike' ? .01 : .1) * rate);
      for (let i = 0; i < samples.length; i++) {
        const elevated = condition === 'burst' || condition === 'spike'
          ? i >= start && i < end : condition === 'boundary' && i >= 4 * rate && i < 4.28 * rate;
        samples[i] = .003 * (i % 2 ? -1 : 1) * (elevated ? 10 ** ((condition === 'burst' ? 7 : 30) / 20) : 1);
        if (i >= 2 * rate && i < 4 * rate) samples[i] += .1 * Math.sin(2 * Math.PI * 200 * i / rate);
      }
      const result = analyzeGuidedSamples(samples, rate,
        { use_case: 'meetings', device_type: 'unknown', mode: 'basic' },
        { quietSeconds: 2, speechDetection: 'silero', segments: [{ start: 2, end: 4 }], capture: { format: 'pcm' } });
      const expected = condition === 'burst' ? 'unstable' : 'stable';
      rows.push({ rate, phaseMs, condition, eventSamples: condition === 'burst' || condition === 'spike' ? [start, end] : null,
        expected, actual: result.evidence.noiseStability, retryReason: result.evidence.retryReason ?? null,
        state: result.specialState ?? 'graded', grade: result.specialState ? null : result.verdict.overall.grade });
    }
  }
}
const misses = rows.filter(r => r.condition === 'burst' && (r.actual !== r.expected || r.retryReason !== 'noise_unstable' || r.state !== 'INSUFFICIENT_EVIDENCE')).length;
const falseAlarms = rows.filter(r => r.condition !== 'burst' && (r.actual !== r.expected || r.retryReason !== null || r.state !== 'graded')).length;
if (process.env.NOISE_PHASE_NO_REPORT !== '1') await writeFile(path.join(root, baselineRef ? 'docs/noise-sustained-spike-baseline.json' : 'docs/noise-sustained-spike-results.json'), JSON.stringify({
  description: 'Exact-label sustained-window spike diagnostic; generated sample-grid evaluation, no human or physical capture accuracy claim.',
  ...(baselineRef ? { baselineGuidedRef: baselineRef } : {}),
  parameters: { calibrationSeconds: 2, speechInterval: [2, 4], burstSeconds: .1, burstRiseDb: 7, spikeSeconds: .01, spikeRiseDb: 30, noiseRms: .003, onsetSeconds: 4.535 },
  misses, falseAlarms, rows,
}, null, 2) + '\n');
console.log(`${rows.length} conditions: ${misses} missed bursts, ${falseAlarms} control false alarms`);
// Known failures remain failing improvement targets, not expected-failure tests.
if (misses || falseAlarms) process.exitCode = 1;
