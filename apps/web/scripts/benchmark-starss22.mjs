import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const web = path.join(root, 'apps/web');
const fixtures = path.join(web, 'e2e/fixtures/starss22');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestBytes = await readFile(path.join(fixtures, 'manifest.json'));
const manifest = JSON.parse(manifestBytes);
const referenceBytes = await readFile(path.join(fixtures, 'reference.json'));
const reference = JSON.parse(referenceBytes);
if (reference.manifestSha256 !== hash(manifestBytes)) throw new Error('Frozen reference provenance mismatch');
const appLength = process.argv.includes('--app-length');
const baselineVad = process.argv.includes('--baseline-vad');
const split = process.argv.includes('--evaluation') ? 'evaluation' : 'development';
const alias = { '@miccheck/audio-core': path.join(root, 'packages/audio-core/src/index.ts'), '@miccheck/audio-metrics': path.join(root, 'packages/audio-metrics/src/index.ts') };
const frozenVad = baselineVad ? await readFile(path.join(web, 'e2e/fixtures/starss22-vad/silero-baseline.ts'), 'utf8') : null;
const segmentationPlugin = tap => ({ name: 'segmentation-diagnostics', setup(b) {
  b.onLoad({ filter: /[\\/]silero\.ts$/ }, async ({ path: sourcePath }) => {
    const source = frozenVad ?? await readFile(sourcePath, 'utf8');
    return { contents: tap ? source.replace('return speechSegments(probabilities,', 'self.postMessage({ vadProbabilities: probabilities }); return speechSegments(probabilities,') : source, loader: 'ts' };
  });
} });
const productionWorker = await build({ entryPoints: [path.join(web, 'lib/ai/audioAnalysis.worker.ts')], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', alias,
  plugins: baselineVad ? [segmentationPlugin(false)] : [] });
const worker = appLength ? await build({ entryPoints: [path.join(web, 'lib/ai/audioAnalysis.worker.ts')], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', alias,
  plugins: [segmentationPlugin(true)] }) : productionWorker;
const guidedBundle = await build({ entryPoints: [path.join(root, 'packages/audio-metrics/src/guided.ts')], bundle: true, write: false, format: 'esm', platform: 'node', alias });
const { analyzeGuidedSamples } = await import(`data:text/javascript;base64,${Buffer.from(guidedBundle.outputFiles[0].text).toString('base64')}`);
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>STARSS22 pilot</title>'); return; }
    if (url.pathname === '/worker.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(worker.outputFiles[0].text); return; }
    const target = path.resolve(web, 'public', '.' + url.pathname);
    if (!target.startsWith(path.join(web, 'public') + path.sep)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', target.endsWith('.wasm') ? 'application/wasm' : target.endsWith('.mjs') ? 'text/javascript' : 'application/octet-stream');
    res.end(await readFile(target));
  } catch { res.writeHead(404).end(); }
});

function decode(bytes) {
  let pcm, rate;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4);
    if (kind === 'fmt ') {
      if (bytes.readUInt16LE(offset + 8) !== 1 || bytes.readUInt16LE(offset + 10) !== 1 || bytes.readUInt16LE(offset + 22) !== 16) throw new Error('Expected PCM16 mono');
      rate = bytes.readUInt32LE(offset + 12);
    }
    if (kind === 'data') pcm = bytes.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + size % 2;
  }
  if (!pcm || rate !== 24000) throw new Error('Invalid pilot WAV');
  return Float32Array.from({ length: pcm.length / 2 }, (_, i) => pcm.readInt16LE(i * 2) / 32768);
}

function segmentsFromFrames(active, seconds) {
  const segments = [];
  for (let f = 0; f < seconds * 10;) {
    if (!active(f)) { f++; continue; }
    const start = f++;
    while (f < seconds * 10 && active(f)) f++;
    segments.push({ start: start / 10, end: f / 10 });
  }
  return segments;
}

function annotationAgreement(frames, seconds, segments) {
  let tp = 0, fn = 0, fp = 0, tn = 0, uncertain = 0;
  const speech = f => !!frames.get(f)?.some(c => c === 0 || c === 1);
  for (let f = 0; f < Math.floor(seconds * 10); f++) {
    // Exclude 200 ms either side of speech transitions. Non-speech candidates
    // require known domestic/water activity and exclude music/instruments/laughs.
    const interiorSpeech = [-2, -1, 0, 1, 2].every(d => speech(f + d));
    const knownNoise = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].every(d => {
      const c = frames.get(f + d) ?? [];
      return c.some(x => x === 5 || x === 10) && !c.some(x => [0, 1, 4, 8, 9].includes(x));
    });
    const detected = segments.some(s => s.start <= (f + .5) / 10 && s.end > (f + .5) / 10);
    if (interiorSpeech) { if (detected) tp++; else fn++; }
    else if (knownNoise) { if (detected) fp++; else tn++; }
    else uncertain++;
  }
  return { truePositiveSeconds: tp / 10, missedSpeechSeconds: fn / 10,
    noiseDisagreementSeconds: fp / 10, agreedNoiseSeconds: tn / 10, uncertainSeconds: uncertain / 10,
    precisionOnCandidates: tp + fp ? tp / (tp + fp) : null, recallOnSpeechInteriors: tp + fn ? tp / (tp + fn) : null,
    limitation: 'Human 100 ms target annotations with conservative guards. Unknown interference excluded where possible; candidate disagreements, not verified physical false speech.' };
}

let browser;
const rows = [];
const nativeBaseline = appLength ? JSON.parse(await readFile(path.join(root, `docs/starss22-${split}-results.json`))) : null;
if (nativeBaseline && (nativeBaseline.productionWorkerSha256 !== hash(productionWorker.outputFiles[0].text) || nativeBaseline.referenceSha256 !== hash(referenceBytes))) throw new Error('Native baseline differs from current worker/reference; regenerate native reports before context comparison');
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  for (const clip of manifest.clips.filter(c => c.split === split)) {
    const bytes = await readFile(path.join(fixtures, clip.file));
    const frozen = reference.clips.find(c => c.file === clip.file);
    const metadata = await readFile(path.join(fixtures, path.basename(clip.metadata_path)));
    if (hash(bytes) !== frozen.sha256 || hash(metadata) !== frozen.metadataSha256) throw new Error('Source checksum mismatch');
    const source = decode(bytes), rate = clip.sample_rate;
    const frames = new Map();
    for (const line of metadata.toString().trim().split(/\r?\n/)) {
      const [frame, cls] = line.split(',').map(Number), local = frame - clip.crop_frames[0];
      if (!frames.has(local)) frames.set(local, []);
      frames.get(local).push(cls);
    }
    const results = [];
    // Freeze contiguous crops by upstream speech onsets, never worker predictions.
    // Two seconds of context precede each onset; retain source PCM and all overlap.
    const runs = segmentsFromFrames(f => frames.get(f)?.some(c => c === 0 || c === 1), source.length / rate);
    const starts = [...new Set(runs.map(s => Math.min(Math.max(0, Math.round(s.start * 10) - 20), Math.floor(source.length / rate * 10) - 220)))];
    const scenarios = appLength ? starts.map(startFrame => ({ name: `contiguous-${startFrame / 10}`, startFrame })) : [{ name: 'native', tailGainDb: 0 }, ...frozen.cases];
    for (const scenario of scenarios) {
      let samples = source;
      let annotations = segmentsFromFrames(f => frames.get(f)?.some(c => c === 0 || c === 1), source.length / rate);
      let comparisonFrames = frames;
      if (appLength) {
        const start = scenario.startFrame;
        samples = source.slice(start * rate / 10, (start + 220) * rate / 10);
        comparisonFrames = new Map([...frames].map(([f, classes]) => [f - start, classes]));
        annotations = segmentsFromFrames(f => comparisonFrames.get(f)?.some(c => c === 0 || c === 1), 22);
      } else if (scenario.name !== 'native') {
        samples = new Float32Array(rate * 11.5);
        const [a, b] = frozen.speechSourceSamples;
        const noise = source.subarray(...frozen.noiseSourceSamples);
        const excerpt = source.subarray(a, b);
        for (let i = 0; i < samples.length; i++) {
          const t = i / rate;
          const gain = t >= reference.noiseEventLocalSeconds[0] && t < reference.noiseEventLocalSeconds[1] ? 10 ** (scenario.tailGainDb / 20) : 1;
          samples[i] = noise[i % noise.length] * gain + (t >= 2 && t < 7 ? excerpt[i - 2 * rate] : 0);
        }
        if (samples.some(x => Math.abs(x) >= 1)) throw new Error('Constructed case saturates; no limiting allowed');
        annotations = segmentsFromFrames(f => f >= 20 && f < 70 && frames.get(f - 20 + a / (rate / 10))?.some(c => c === 0 || c === 1), 11.5);
      }
      const annotatedEstimator = analyzeGuidedSamples(samples, rate, { use_case: 'meetings', device_type: 'unknown', mode: 'basic' },
        { quietSeconds: 2, speechDetection: 'silero', segments: annotations, capture: { format: 'pcm' } });
      const result = await page.evaluate(({ pcm, rate }) => new Promise((resolve, reject) => {
        const worker = new Worker('/worker.js', { type: 'module' });
        let vadProbabilities;
        const timer = setTimeout(() => { worker.terminate(); reject(new Error('Worker timeout')); }, 60000);
        const finish = () => { clearTimeout(timer); worker.terminate(); };
        worker.onerror = () => { finish(); reject(new Error('Worker error')); };
        worker.onmessage = ({ data }) => { if (data.vadProbabilities) vadProbabilities = data.vadProbabilities; if (data.error) { finish(); reject(new Error(data.error)); } else if (data.result) { finish(); resolve({ ...data.result, vadProbabilities }); } };
        worker.postMessage({ samples: Float32Array.from(pcm), sampleRate: rate, quietSeconds: 2,
          context: { use_case: 'meetings', device_type: 'unknown', mode: 'basic' }, capture: { format: 'pcm' }, classifyNoise: false });
      }), { pcm: Array.from(samples), rate });
      if (appLength && result.vadProbabilities?.length !== Math.ceil(samples.length / rate * 16000 / 512)) throw new Error('Incomplete diagnostic probability trace');
      const summary = r => ({ stability: r.evidence.noiseStability, retry: r.evidence.retryReason ?? null,
        state: r.specialState ?? 'graded', grade: r.specialState ? null : r.verdict.overall.grade,
        evidence: r.evidence, certainty: r.verdict.diagnosticCertainty, recommendation: r.recommendation });
      const expected = appLength || scenario.name === 'native' ? null : { stability: scenario.expectedStability, retry: scenario.expectedRetry, state: scenario.tailGainDb ? 'INSUFFICIENT_EVIDENCE' : 'graded' };
      const actual = summary(result), isolated = summary(annotatedEstimator);
      const meets = r => !expected || (r.stability === expected.stability && r.retry === expected.retry && r.state === expected.state);
      results.push({ scenario: scenario.name, expected, worker: actual, annotationDrivenEstimator: isolated,
        workerMeetsExpectation: expected ? meets(actual) : null, estimatorMeetsExpectation: expected ? meets(isolated) : null,
        segments: result.ai.segments,
        ...(appLength || scenario.name === 'native' ? { annotationAgreement: annotationAgreement(comparisonFrames, samples.length / rate, result.ai.segments) } : {}),
        ...(appLength ? { sourceLocalSeconds: [scenario.startFrame / 10, scenario.startFrame / 10 + 22],
          pcmSha256: hash(new Uint8Array(samples.buffer)),
          calibrationAnnotatedSpeechSeconds: annotations.reduce((n, s) => n + Math.max(0, Math.min(2, s.end) - s.start), 0),
          annotatedSpeechSegments: annotations,
          vadFrameSeconds: 0.032, vadProbabilities: result.vadProbabilities,
          noiseRetryTruth: 'unknown',
          fullContextAgreementOnSameCrop: annotationAgreement(comparisonFrames, 22,
            nativeBaseline.rows.find(r => r.file === clip.file).results.find(r => r.scenario === 'native').segments
              .map(s => ({ start: s.start - scenario.startFrame / 10, end: s.end - scenario.startFrame / 10 }))) } : {}) });
      console.log(`${split} ${clip.file} ${scenario.name}: worker=${actual.stability}/${actual.retry ?? actual.state}, annotated=${isolated.stability}/${isolated.retry ?? isolated.state}`);
    }
    rows.push({ file: clip.file, room: clip.room, split, results });
  }
  const labeled = rows.flatMap(r => r.results).filter(r => r.expected);
  const counts = appLength ? { labeledRetryCases: 0, note: 'Diagnostic speech comparisons only; no native retry truth or pass/fail accuracy gate.' } : { workerMisses: labeled.filter(r => r.expected.retry && !r.workerMeetsExpectation).length,
    workerStationaryFailures: labeled.filter(r => !r.expected.retry && !r.workerMeetsExpectation).length,
    estimatorMisses: labeled.filter(r => r.expected.retry && !r.estimatorMeetsExpectation).length,
    estimatorStationaryFailures: labeled.filter(r => !r.expected.retry && !r.estimatorMeetsExpectation).length };
  if (process.env.STARSS22_NO_REPORT !== '1') await writeFile(path.join(root, `docs/starss22-${appLength ? 'app-length-' : ''}${split}-results.json`), JSON.stringify({ protocol: appLength ? 'upstream-speech-onset-contiguous-22s-v1' : reference.protocol, split,
    referenceSha256: hash(referenceBytes), manifestSha256: hash(manifestBytes), browser: browser.version(),
    productionWorkerSha256: hash(productionWorker.outputFiles[0].text),
    ...(appLength ? { diagnosticWorkerSha256: hash(worker.outputFiles[0].text) } : {}), annotationEstimatorSha256: hash(guidedBundle.outputFiles[0].text),
    diagnosticProbabilityTap: appLength,
    description: appLength ? 'Unmodified contiguous 22 s source crops selected by upstream speech onsets. Same-crop full-context comparison; overlapping crops are not independent. Native noise retry truth unknown. Probability tap preserves detector decisions.' : 'Native recorded-room diagnostics plus exactly defined component gain changes. Native full-recording retry ground truth remains unknown; annotated estimator uses upstream frames instead of VAD, not a second real worker.', counts, rows }, null, 2) + '\n');
  console.log(JSON.stringify(counts));
  if (!appLength && Object.values(counts).some(Boolean)) process.exitCode = 1;
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
