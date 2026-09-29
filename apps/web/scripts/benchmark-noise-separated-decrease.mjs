import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { accuracyWorker } from './accuracy-worker.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const baselineRef = process.env.NOISE_SEPARATED_BASELINE_REF;
const ref = baselineRef && execFileSync('git', ['rev-parse', '--verify', baselineRef + '^{commit}'], {cwd: root, encoding: 'utf8'}).trim();
const plugins = ref ? [{name: 'baseline-guided', setup(builder) {
  builder.onLoad({filter: /[/\\]audio-metrics[/\\]src[/\\]guided\.ts$/}, () => ({
    contents: execFileSync('git', ['show', ref + ':packages/audio-metrics/src/guided.ts'], {cwd: root, encoding: 'utf8'}), loader: 'ts',
  }));
}}] : [];
const bundle = await build({entryPoints: [path.join(root, 'packages/audio-metrics/src/guided.ts')], bundle: true,
  write: false, platform: 'node', format: 'esm', plugins,
  alias: {'@miccheck/audio-core': path.join(root, 'packages/audio-core/src/index.ts')}});
const {analyzeGuidedSamples} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const context = {use_case: 'meetings', device_type: 'unknown', mode: 'basic'};
const capture = {format: 'pcm', echoCancellation: false, noiseSuppression: false, autoGainControl: false};
const rows = [];
let workerEvidence;
// Frozen policy labels: decreases require 500 ms of consecutive evidence.
// Two separate 250 ms dips do not meet that rule. No perceptual truth is claimed.
function intervals(condition, onset, rate) {
  const ranges = condition === 'separated' ? [[onset, onset + .25], [onset + 1, onset + 1.25]]
    : condition === 'sustained' ? [[onset, onset + .6]]
    : condition === 'burst' ? [[onset, onset + .1]] : [];
  return ranges.map(([start, end]) => [Math.round(start * rate), Math.round(end * rate)]);
}
function noise(samples, rate, frequency, events, condition) {
  for (let i = 0; i < samples.length; i++) {
    const changed = events.some(([start, end]) => i >= start && i < end);
    samples[i] += .02 * Math.SQRT2 * Math.sin(2 * Math.PI * frequency * i / rate)
      * (changed ? 10 ** ((condition === 'burst' ? 9 : -9) / 20) : 1);
  }
}
function record(metadata, result, samples, events) {
  const positive = ['sustained', 'burst'].includes(metadata.condition);
  const expected = positive ? 'unstable' : 'stable';
  rows.push({...metadata, events, pcmSha256: hash(Buffer.from(samples.buffer)), expected,
    actual: result.evidence.noiseStability, retryReason: result.evidence.retryReason ?? null,
    state: result.specialState ?? 'graded', grade: result.specialState ? null : result.verdict.overall.grade,
    passed: result.evidence.noiseStability === expected && (positive
      ? result.evidence.retryReason === 'noise_unstable' && result.specialState === 'INSUFFICIENT_EVIDENCE'
      : !result.evidence.retryReason && !result.specialState)});
}
for (const rate of [16000, 22050, 44100, 48000])
  for (const frequency of [120, 997])
    for (const phaseMs of [0, 37, 113])
      for (const condition of ['separated', 'sustained', 'stationary', 'burst']) {
        const samples = new Float32Array(8 * rate);
        for (let i = 2 * rate; i < 4 * rate; i++) samples[i] = .1 * Math.sin(2 * Math.PI * 200 * i / rate);
        const events = intervals(condition, 4.8 + phaseMs / 1000, rate);
        noise(samples, rate, frequency, events, condition);
        record({path: 'estimator', split: rate === 16000 ? 'development' : 'parameter-evaluation', rate, frequency, phaseMs, condition},
          analyzeGuidedSamples(samples, rate, context, {quietSeconds: 2, speechDetection: 'silero', segments: [{start: 2, end: 4}], capture}), samples, events);
      }
if (!process.argv.includes('--estimator-only')) {
  const folder = path.join(root, 'apps/web/e2e/fixtures/accuracy-expansion');
  const manifest = JSON.parse(await readFile(path.join(folder, 'manifest.json')));
  const worker = await accuracyWorker(root, {plugins});
  workerEvidence = {workerSha256: worker.sha256, modelManifestSha256: worker.modelManifestSha256};
  try {
    for (const clip of manifest.clips.filter(clip => clip.corpus === 'FLEURS')) {
      const bytes = await readFile(path.join(folder, clip.file));
      if (hash(bytes) !== clip.sha256) throw new Error('Source checksum mismatch');
      let pcm, valid = false;
      for (let offset = 12; offset + 8 <= bytes.length;) {
        const size = bytes.readUInt32LE(offset + 4);
        if (offset + 8 + size > bytes.length) throw new Error('Truncated WAV');
        if (bytes.toString('ascii', offset, offset + 4) === 'fmt ') valid = size >= 16
          && bytes.readUInt16LE(offset + 8) === 1 && bytes.readUInt16LE(offset + 10) === 1
          && bytes.readUInt32LE(offset + 12) === clip.sampleRate && bytes.readUInt16LE(offset + 22) === 16;
        if (bytes.toString('ascii', offset, offset + 4) === 'data') pcm = bytes.subarray(offset + 8, offset + 8 + size);
        offset += 8 + size + size % 2;
      }
      if (!valid || !pcm || pcm.length % 2) throw new Error('Expected mono PCM16 WAV');
      const rate = clip.sampleRate;
      const source = Float32Array.from({length: pcm.length / 2}, (_, i) => pcm.readInt16LE(i * 2) / 32768);
      const sourceEnd = source.length / rate;
      const rms = Math.sqrt(source.subarray(2 * rate).reduce((sum, x) => sum + x * x, 0) / (source.length - 2 * rate));
      for (const condition of ['separated', 'sustained', 'stationary', 'burst']) {
        const samples = new Float32Array(source.length + 4 * rate);
        // Retain a quieter recorded component; tail and calibration are exactly signal-free.
        for (let i = 2 * rate; i < source.length; i++) samples[i] = source[i] * .04 / rms;
        const events = intervals(condition, sourceEnd + .8, rate);
        noise(samples, rate, 997, events, condition);
        record({path: 'worker', split: 'recorded-regression', source: clip.file, sourceSha256: clip.sha256, rate, condition},
          await worker.analyze(samples, rate, context, capture), samples, events);
      }
    }
  } finally { await worker.close(); }
}
const summaries = [...new Set(rows.map(row => row.split))].map(split => ({split, cases: rows.filter(row => row.split === split).length,
  misses: rows.filter(row => row.split === split && ['sustained', 'burst'].includes(row.condition) && !row.passed).length,
  falseAlarms: rows.filter(row => row.split === split && !['sustained', 'burst'].includes(row.condition) && !row.passed).length}));
if (!process.argv.includes('--check')) await writeFile(path.join(root, 'docs', ref ? 'noise-separated-decrease-baseline.json' : 'noise-separated-decrease-results.json'),
  JSON.stringify({description: 'Exact generated component duration policy; existing licensed recordings are worker regression evidence, not untouched physical evaluation.',
    baselineRef: ref ?? null, estimatorSha256: hash(bundle.outputFiles[0].text), ...workerEvidence,
    parameters: {noiseRms: .02, decreaseDb: 9, dipSeconds: .25, gapSeconds: .75, sustainedSeconds: .6}, summaries, rows}, null, 2) + '\n');
console.log(JSON.stringify(summaries));
if (rows.some(row => !row.passed)) process.exitCode = 1;
