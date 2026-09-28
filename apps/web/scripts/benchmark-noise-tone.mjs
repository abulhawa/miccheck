import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const evaluation = process.env.NOISE_TONE_EVALUATION === '1';
const regression = process.env.NOISE_TONE_REGRESSION === '1';
if (evaluation && regression) throw new Error('Run tone evaluation and focused regression separately');
const baselineRef = process.env.NOISE_TONE_BASELINE_REF ? execFileSync('git', ['rev-parse', '--verify', process.env.NOISE_TONE_BASELINE_REF + '^{commit}'], { cwd: root, encoding: 'utf8' }).trim() : undefined;
const rates = evaluation ? [24000, 88200] : [16000, 22050, 44100, 48000, 96000];
const frequencies = evaluation ? [27, 37, 49, 61, 83, 103] : regression ? [55] : [25, 35, 45, 55, 75, 997];
const onsetPhases = evaluation ? [3, 7, 11, 17, 23] : regression ? [15] : [0, 5, 10, 15, 20];
const carrierPhases = evaluation ? [0, Math.PI / 4, Math.PI / 2] : [0];
const bundle = await build({ entryPoints: [path.join(root, 'packages/audio-metrics/src/guided.ts')], bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: baselineRef ? [{ name: 'baseline-guided', setup(builder) {
    builder.onLoad({ filter: /[/\\]audio-metrics[/\\]src[/\\]guided\.ts$/ }, () => ({ contents: execFileSync('git', ['show', baselineRef + ':packages/audio-metrics/src/guided.ts'], { cwd: root, encoding: 'utf8' }), loader: 'ts' }));
  } }] : [], alias: { '@miccheck/audio-core': path.join(root, 'packages/audio-core/src/index.ts') } });
const { analyzeGuidedSamples } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const rows = [];
for (const rate of rates) {
  for (const phaseMs of onsetPhases) {
    for (const frequency of frequencies) for (const carrierPhase of carrierPhases) for (const shape of ['square']) {
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
          samples[i] = .003 * Math.SQRT2 * Math.sin(2 * Math.PI * frequency * i / rate + carrierPhase) * (1 + envelope * (10 ** (rise / 20) - 1));
          if (i >= 2 * rate && i < 4 * rate) samples[i] += .1 * Math.sin(2 * Math.PI * 200 * i / rate);
        }
        const result = analyzeGuidedSamples(samples, rate, { use_case: 'meetings', device_type: 'unknown', mode: 'basic' }, { quietSeconds: 2, speechDetection: 'silero', segments: [{ start: 2, end: 4 }], capture: { format: 'pcm' } });
        // Square 100 ms, +7 dB bursts and 10 ms spike labels follow the existing policy.
        const expected = condition === 'burst' ? 'unstable' : 'stable';
        rows.push({ frequency, carrierPhase, rate, phaseMs, shape, condition, eventSamples: [start, end], plateauSamples: plateau, rampSamples: ramp, expected, actual: result.evidence.noiseStability, retryReason: result.evidence.retryReason ?? null, state: result.specialState ?? 'graded' });
      }
    }
  }
}
const misses = rows.filter(r => r.expected === 'unstable' && (r.actual !== r.expected || r.retryReason !== 'noise_unstable' || r.state !== 'INSUFFICIENT_EVIDENCE')).length;
const falseAlarms = rows.filter(r => r.expected === 'stable' && (r.actual !== r.expected || r.retryReason !== null || r.state !== 'graded')).length;
const prefix = evaluation ? 'noise-tone-evaluation' : regression ? 'noise-tone-regression' : 'noise-tone';
if (process.env.NOISE_TONE_NO_REPORT !== '1') await writeFile(path.join(root, `docs/${prefix}-${baselineRef ? 'baseline' : 'results'}.json`), JSON.stringify({ description: 'Exact-label sine-carrier diagnostic; generated parameter evaluation, no physical capture or representative accuracy claim.', ...(baselineRef ? { baselineGuidedRef: baselineRef } : {}), parameters: { noiseRms: .003, calibrationSeconds: 2, speechInterval: [2, 4], onsetSeconds: 4.55, rampSeconds: 0, burstPlateauSeconds: .1, spikeSeconds: .01, burstRiseDb: 7, spikeRiseDb: 18, rates, frequenciesHz: frequencies, onsetPhasesMs: onsetPhases, carrierPhases }, misses, falseAlarms, rows }, null, 2) + '\n');
console.log(`${rows.length} conditions: ${misses} missed bursts, ${falseAlarms} control false alarms`);
if (misses || falseAlarms) process.exitCode = 1;
