import { chromium } from '@playwright/test';
import { build, transform } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const web = path.join(root, 'apps/web');
const fixtures = path.join(web, 'e2e/fixtures/starss22-vad');
const original = path.join(web, 'e2e/fixtures/starss22');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const candidateSource = await readFile(path.join(web, 'lib/ai/silero.ts'), 'utf8');
const baselineSource = await readFile(path.join(fixtures, 'silero-baseline.ts'), 'utf8');
const alias = { '@miccheck/audio-core': path.join(root, 'packages/audio-core/src/index.ts'), '@miccheck/audio-metrics': path.join(root, 'packages/audio-metrics/src/index.ts') };
const mode = process.argv.includes('--evaluation') ? 'evaluation' : process.argv.includes('--regression') ? 'regression' : 'development';
const manifestBytes = await readFile(path.join(fixtures, 'manifest.json'));
const manifest = JSON.parse(manifestBytes);
const selectionBytes = await readFile(path.join(fixtures, 'selection.json'));
if (JSON.stringify(manifest.protocol) !== JSON.stringify(JSON.parse(selectionBytes)) || manifest.clips.length !== 6) throw new Error('Incomplete or changed frozen evaluation selection');
const modelHash = sha(await readFile(path.join(web, 'public/models/silero/silero_vad_v5.onnx')));
const functionSource = source => source.slice(source.indexOf('export function speechSegments('));
const protocol = {
  version: 1, candidate: 'confirmed-continuation-0.35', onsetThreshold: 0.5,
  continuationThreshold: 0.35, confirmationSpanSeconds: 0.16,
  minimumSegmentSeconds: 0.16, silenceGapSeconds: 0.16, paddingSeconds: 0,
  baselineFunctionSha256: sha(functionSource(baselineSource)), candidateFunctionSha256: sha(functionSource(candidateSource)),
  modelSha256: modelHash, selectionSha256: sha(selectionBytes),
  acceptance: 'No increased misses per labeled crop; no additional speech in candidate noise; net speech-interior gain on untouched rooms. Native retry truth remains unknown. Noise-only candidate controls must retain no-speech guidance. Existing independently labeled fixture acceptance must pass.'
};
const freezePath = path.join(fixtures, 'candidate.json');
if (mode === 'development') {
  let frozen;
  try { frozen = JSON.parse(await readFile(freezePath)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (frozen && JSON.stringify(frozen) !== JSON.stringify(protocol)) throw new Error('Candidate protocol changed; use a separately reviewed version');
  await writeFile(freezePath, JSON.stringify(protocol, null, 2) + '\n');
} else if (JSON.stringify(JSON.parse(await readFile(freezePath))) !== JSON.stringify(protocol)) throw new Error('Candidate differs from development freeze');

function decode(bytes) {
  let rate, pcm;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(offset + 4), kind = bytes.toString('ascii', offset, offset + 4);
    if (kind === 'fmt ') {
      if (bytes.readUInt16LE(offset + 8) !== 1 || bytes.readUInt16LE(offset + 10) !== 1 || bytes.readUInt16LE(offset + 22) !== 16) throw new Error('Expected PCM16 mono');
      rate = bytes.readUInt32LE(offset + 12);
    }
    if (kind === 'data') pcm = bytes.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + size % 2;
  }
  if (rate !== 24000 || !pcm) throw new Error('Unexpected fixture format');
  return Float32Array.from({ length: pcm.length / 2 }, (_, i) => pcm.readInt16LE(i * 2) / 32768);
}

function framesFor(bytes, startFrame) {
  const frames = new Map();
  for (const line of bytes.toString().trim().split(/\r?\n/)) {
    const [f, cls] = line.split(',').map(Number), local = f - startFrame;
    if (!frames.has(local)) frames.set(local, []);
    frames.get(local).push(cls);
  }
  return frames;
}

function agreement(frames, segments, instruments = false) {
  let matched = 0, missed = 0, noiseSpeech = 0, noise = 0, uncertain = 0, uncertainSpeech = 0;
  let calibrationSpeechFrames = 0;
  const speech = f => frames.get(f)?.some(c => c === 0 || c === 1);
  for (let f = 0; f < 220; f++) {
    if (f < 20 && speech(f)) calibrationSpeechFrames++;
    const interior = [-2, -1, 0, 1, 2].every(d => speech(f + d));
    const knownNoise = Array.from({ length: 11 }, (_, i) => i - 5).every(d => {
      const classes = frames.get(f + d) ?? [];
      return classes.some(c => c === 5 || c === 10 || instruments && c === 9)
        && !classes.some(c => [0, 1, 4, 8, ...(instruments ? [] : [9])].includes(c));
    });
    const detected = segments.some(s => s.start <= (f + .5) / 10 && s.end > (f + .5) / 10);
    if (interior) { if (detected) matched++; else missed++; }
    else if (knownNoise) { noise++; if (detected) noiseSpeech++; }
    else { uncertain++; if (detected) uncertainSpeech++; }
  }
  return { matchedSpeechSeconds: matched / 10, missedSpeechSeconds: missed / 10,
    candidateNoiseSpeechSeconds: noiseSpeech / 10, candidateNoiseSeconds: noise / 10,
    uncertainSeconds: uncertain / 10, speechInUncertainSeconds: uncertainSpeech / 10,
    calibrationAnnotatedSpeechSeconds: calibrationSpeechFrames / 10 };
}

const summary = result => ({ segments: result.ai?.segments ?? result.evidence.segments,
  metrics: result.metrics, evidence: result.evidence, state: result.specialState ?? 'graded',
  grade: result.specialState ? null : result.verdict.overall.grade,
  certainty: result.verdict.diagnosticCertainty, recommendation: result.recommendation });
const decisions = r => ({ noMoreMisses: r.after.agreement.missedSpeechSeconds <= r.before.agreement.missedSpeechSeconds,
  noAddedNoiseSpeech: r.after.agreement.candidateNoiseSpeechSeconds <= r.before.agreement.candidateNoiseSpeechSeconds,
  noiseOnlyGuidanceRetained: r.role !== 'noise' || r.before.evidence.retryReason === 'no_speech' && r.after.evidence.retryReason === 'no_speech',
  noNewCalibrationRetry: r.after.evidence.retryReason !== 'calibration_speech' || r.before.evidence.retryReason === 'calibration_speech' });
const rows = [];
const guided = await build({ entryPoints: [path.join(root, 'packages/audio-metrics/src/guided.ts')], bundle: true, write: false, format: 'esm', platform: 'node', alias });
const { analyzeGuidedSamples } = await import(`data:text/javascript;base64,${Buffer.from(guided.outputFiles[0].text).toString('base64')}`);

if (mode !== 'evaluation') {
  const split = mode === 'development' ? 'development' : 'evaluation';
  const traceBytes = await readFile(path.join(root, `docs/starss22-app-length-${split}-results.json`));
  const trace = JSON.parse(traceBytes);
  protocol.cachedTraceSha256 = sha(traceBytes);
  const funcs = await Promise.all([baselineSource, candidateSource].map(async source => {
    const compiled = await transform(functionSource(source), { loader: 'ts', format: 'esm' });
    return (await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString('base64')}`)).speechSegments;
  }));
  const originalManifest = JSON.parse(await readFile(path.join(original, 'manifest.json')));
  for (const row of trace.rows) {
    const clip = originalManifest.clips.find(c => c.file === row.file);
    const bytes = await readFile(path.join(original, clip.file));
    const annotationBytes = await readFile(path.join(original, path.basename(clip.metadata_path)));
    if (sha(bytes) !== clip.sha256 || sha(annotationBytes) !== clip.metadata_sha256) throw new Error('Original source checksum mismatch');
    const native = decode(bytes);
    for (const result of row.results) {
      const start = Math.round(result.sourceLocalSeconds[0] * 10);
      const samples = native.slice(start * 2400, (start + 220) * 2400);
      if (sha(new Uint8Array(samples.buffer)) !== result.pcmSha256) throw new Error('Cached trace PCM mismatch');
      const frames = framesFor(annotationBytes, clip.crop_frames[0] + start);
      const evaluated = funcs.map(fn => {
        const segments = fn(result.vadProbabilities, 22);
        const analysis = analyzeGuidedSamples(samples, 24000, { use_case: 'meetings', device_type: 'unknown', mode: 'basic' },
          { quietSeconds: 2, speechDetection: 'silero', segments, capture: { format: 'pcm' } });
        return { ...summary(analysis), segments, agreement: agreement(frames, segments) };
      });
      if (JSON.stringify(evaluated[0].segments) !== JSON.stringify(result.segments)) throw new Error('Cached probability replay differs from recorded baseline worker');
      rows.push({ file: clip.file, room: clip.room, sourceLocalSeconds: result.sourceLocalSeconds,
        role: 'speech-diagnostic', calibrationContaminated: result.calibrationAnnotatedSpeechSeconds > 0,
        before: evaluated[0], after: evaluated[1] });
    }
  }
  console.log(`Reused cached baseline probabilities for ${rows.length} crops; no inference calls.`);
} else {
  const workers = await Promise.all([baselineSource, candidateSource].map(source => build({
    entryPoints: [path.join(web, 'lib/ai/audioAnalysis.worker.ts')], bundle: true, write: false,
    format: 'esm', platform: 'browser', target: 'es2022', alias,
    plugins: [{ name: 'frozen-segmentation', setup(b) {
      b.onLoad({ filter: /[\\/]silero\.ts$/ }, () => ({ contents: source, loader: 'ts' }));
    } }]
  })));
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>VAD continuation benchmark</title>'); return; }
      const index = ['/before.js', '/after.js'].indexOf(url.pathname);
      if (index >= 0) { res.setHeader('Content-Type', 'text/javascript'); res.end(workers[index].outputFiles[0].text); return; }
      const target = path.resolve(web, 'public', '.' + url.pathname);
      if (!target.startsWith(path.join(web, 'public') + path.sep)) { res.writeHead(403).end(); return; }
      res.setHeader('Content-Type', target.endsWith('.wasm') ? 'application/wasm' : target.endsWith('.mjs') ? 'text/javascript' : 'application/octet-stream');
      res.end(await readFile(target));
    } catch { res.writeHead(404).end(); }
  });
  let browser;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    for (const clip of manifest.clips) {
      const bytes = await readFile(path.join(fixtures, clip.file));
      const annotationBytes = await readFile(path.join(fixtures, path.basename(clip.metadata_path)));
      if (sha(bytes) !== clip.sha256 || sha(annotationBytes) !== clip.metadataSha256) throw new Error('Evaluation source checksum mismatch');
      const samples = decode(bytes);
      if (samples.length !== 22 * 24000) throw new Error('Evaluation crop length changed');
      const frames = framesFor(annotationBytes, clip.startFrame);
      const expected = agreement(frames, [], true);
      if (expected.missedSpeechSeconds * 10 !== clip.interiorSpeechFrames || expected.candidateNoiseSeconds * 10 !== clip.candidateNoiseFrames || expected.calibrationAnnotatedSpeechSeconds !== 0) throw new Error('Independent label counts differ from selection');
      const evaluated = [];
      for (const workerUrl of ['/before.js', '/after.js']) {
        const result = await page.evaluate(({ pcm, workerUrl }) => new Promise((resolve, reject) => {
          const worker = new Worker(workerUrl, { type: 'module' });
          const timer = setTimeout(() => { worker.terminate(); reject(new Error('Worker timeout')); }, 60000);
          const finish = () => { clearTimeout(timer); worker.terminate(); };
          worker.onerror = () => { finish(); reject(new Error('Worker failed')); };
          worker.onmessage = ({ data }) => {
            if (data.error) { finish(); reject(new Error(data.error)); }
            else if (data.result) { finish(); resolve(data.result); }
          };
          worker.postMessage({ samples: Float32Array.from(pcm), sampleRate: 24000, quietSeconds: 2,
            context: { use_case: 'meetings', device_type: 'unknown', mode: 'basic' }, capture: { format: 'pcm' }, classifyNoise: false });
        }), { pcm: Array.from(samples), workerUrl });
        evaluated.push({ ...summary(result), agreement: agreement(frames, result.ai.segments, true) });
      }
      rows.push({ file: clip.file, room: clip.room, role: clip.role, sourceSamples: clip.sourceSamples,
        sourceSha256: clip.sourceSha256, cropSha256: clip.sha256, metadataSha256: clip.metadataSha256, before: evaluated[0], after: evaluated[1] });
      console.log(`${clip.file}: speech missed ${evaluated[0].agreement.missedSpeechSeconds} -> ${evaluated[1].agreement.missedSpeechSeconds} s; candidate-noise speech ${evaluated[0].agreement.candidateNoiseSpeechSeconds} -> ${evaluated[1].agreement.candidateNoiseSpeechSeconds} s`);
    }
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
  protocol.workerHashes = workers.map(w => sha(w.outputFiles[0].text));
}

for (const row of rows) row.acceptance = decisions(row);
const counts = {
  conditions: rows.length, worsenedSpeechConditions: rows.filter(r => !r.acceptance.noMoreMisses).length,
  addedCandidateNoiseSpeechConditions: rows.filter(r => !r.acceptance.noAddedNoiseSpeech).length,
  guidanceFailures: rows.filter(r => !r.acceptance.noiseOnlyGuidanceRetained || !r.acceptance.noNewCalibrationRetry).length,
  improvedSpeechConditions: rows.filter(r => r.after.agreement.missedSpeechSeconds < r.before.agreement.missedSpeechSeconds).length,
  beforeMissedSpeechSeconds: rows.reduce((sum, r) => sum + r.before.agreement.missedSpeechSeconds, 0),
  afterMissedSpeechSeconds: rows.reduce((sum, r) => sum + r.after.agreement.missedSpeechSeconds, 0),
  beforeCandidateNoiseSpeechSeconds: rows.reduce((sum, r) => sum + r.before.agreement.candidateNoiseSpeechSeconds, 0),
  afterCandidateNoiseSpeechSeconds: rows.reduce((sum, r) => sum + r.after.agreement.candidateNoiseSpeechSeconds, 0)
};
for (const key of Object.keys(counts)) if (key.endsWith('Seconds')) counts[key] = Math.round(counts[key] * 10) / 10;
if (process.env.VAD_NO_REPORT !== '1') await writeFile(path.join(root, `docs/vad-continuation-${mode}-results.json`), JSON.stringify({
  protocol, mode, manifestSha256: sha(manifestBytes), estimatorSha256: sha(guided.outputFiles[0].text),
  description: mode === 'evaluation' ? 'Production-worker before/after on three annotation-selected previously untouched rooms. Candidate labels exclude uncertain bins; native noise retry truth unknown.' : 'Cached real-model probability replay on previously inspected rooms. Overlapping crops are regression/development evidence, not independent captures.',
  counts, rows
}, null, 2) + '\n');
console.log(JSON.stringify(counts));
if (counts.worsenedSpeechConditions || counts.addedCandidateNoiseSpeechConditions || counts.guidanceFailures || mode === 'evaluation' && !counts.improvedSpeechConditions) process.exitCode = 1;
