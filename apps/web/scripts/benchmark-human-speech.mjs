import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateSpeechAnnotations } from './evaluate-speech-annotations.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const web = path.join(root, 'apps/web');
const fixtures = path.join(web, 'e2e/fixtures/human-speech');
const manifest = JSON.parse(await readFile(path.join(fixtures, 'manifest.json'), 'utf8'));
const noiseGridEvaluation = process.env.NOISE_GRID_EVALUATION === '1';
const baselineRef = process.env.NOISE_GRID_BASELINE_REF;
if (baselineRef && !noiseGridEvaluation) throw new Error('Noise-grid baseline requires NOISE_GRID_EVALUATION=1');
// Bundle current production sources, rather than relying on a potentially stale build.
const bundle = await build({ entryPoints: [path.join(web, 'lib/ai/audioAnalysis.worker.ts')], bundle: true,
  write: false, format: 'esm', platform: 'browser', target: 'es2022',
  plugins: baselineRef ? [{ name: 'noise-grid-baseline', setup(builder) {
    builder.onLoad({ filter: /[/\\]audio-metrics[/\\]src[/\\]guided\.ts$/ }, () => ({
      contents: execFileSync('git', ['show', `${baselineRef}:packages/audio-metrics/src/guided.ts`], { cwd: root, encoding: 'utf8' }),
      loader: 'ts',
    }));
  } }] : [],
  alias: { '@miccheck/audio-core': path.join(root, 'packages/audio-core/src/index.ts'),
    '@miccheck/audio-metrics': path.join(root, 'packages/audio-metrics/src/index.ts') } });
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Human speech benchmark</title>'); return; }
    if (url.pathname === '/audio-analysis.worker.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].text); return; }
    const base = url.pathname.startsWith('/fixtures/') ? fixtures : path.join(web, 'public');
    const relative = url.pathname.startsWith('/fixtures/') ? url.pathname.slice(10) : url.pathname.slice(1);
    const target = path.resolve(base, relative);
    if (!target.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', target.endsWith('.wasm') ? 'application/wasm' : target.endsWith('.mjs') ? 'text/javascript' : 'application/octet-stream');
    res.end(await readFile(target));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const rows = [];
const acceptance = process.env.FIXTURE_ACCEPTANCE === '1';
const shortTailEvaluation = process.env.SHORT_TAIL_EVALUATION === '1';
const annotationEvaluation = process.env.ANNOTATION_EVALUATION === '1';
if ([acceptance, annotationEvaluation, shortTailEvaluation, noiseGridEvaluation].filter(Boolean).length > 1) throw new Error('Run benchmark evaluation modes separately');
const annotations = (annotationEvaluation || shortTailEvaluation || noiseGridEvaluation) ? JSON.parse(await readFile(path.join(fixtures, annotationEvaluation ? 'annotations.ai.json' : 'annotations.consensus.ai.json'), 'utf8')) : null;
if (annotations && (annotations.clips.length !== manifest.clips.length || manifest.clips.some(clip =>
  annotations.clips.find(a => a.file === clip.file)?.sha256 !== clip.sha256))) throw new Error('Annotation provenance mismatch');
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  for (const clip of manifest.clips) {
    const bytes = await readFile(path.join(fixtures, clip.file));
    if (createHash('sha256').update(bytes).digest('hex') !== clip.sha256) throw new Error(`Checksum mismatch: ${clip.file}`);
    const row = await page.evaluate(async ({clip, acceptance, annotationEvaluation, shortTailEvaluation, noiseGridEvaluation}) => {
      const rate = noiseGridEvaluation ? 22050 : 16000;
      const ctx = new AudioContext({ sampleRate: rate });
      const decoded = await ctx.decodeAudioData(await (await fetch(`/fixtures/${clip.file}`)).arrayBuffer());
      const voice = decoded.getChannelData(0).slice();
      await ctx.close();
      let power = 0, peak = 0, nearFullScale = 0;
      for (const x of voice) { power += x*x; peak = Math.max(peak, Math.abs(x)); if (Math.abs(x) >= .98) nearFullScale++; }
      const rms = Math.sqrt(power / voice.length);
      const results = [];
      const scenarios = noiseGridEvaluation ? ['grid-burst', 'grid-stationary'] : shortTailEvaluation ? ['low-noise', 'short-tail-burst', 'short-tail-stationary'] : annotationEvaluation ? ['original', 'low-noise', 'noisy', 'quiet-source'] : ['original', 'low-noise', 'noisy', 'clipped', 'clipped-plus-silence', 'echo', 'changing-noise', ...(acceptance ? ['known-mixture', 'brief-noise', 'low-floor-rise', 'low-floor-stationary', 'short-tail-burst', 'short-tail-stationary'] : [])];
      for (const scenario of scenarios) {
        const tail = scenario.startsWith('short-tail') ? Math.round(rate*.75) : scenario === 'clipped-plus-silence' ? rate*10 : scenario.startsWith('low-floor') ? rate*2 : rate;
        const samples = new Float32Array(rate*2 + voice.length + tail);
        const signalComponent = new Float32Array(samples.length);
        const noiseComponent = new Float32Array(samples.length);
        let sourcePower = 0;
        for (const x of voice) sourcePower += x*x;
        // Entire source waveform is the reference signal, including its unknown
        // residual noise. This is injected-mixture SNR, not original room SNR.
        const mixtureAmplitude = Math.sqrt(sourcePower / voice.length) * Math.sqrt(3) / 10;
        let seed = 12345, signalPower = 0, noisePower = 0;
        for (let i = 0; i < samples.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          const position = i-rate*2;
          const active = position >= 0 && position < voice.length;
          const source = active ? voice[position] : 0;
          let amplitude = scenario === 'original' ? 0 : scenario === 'noisy' ? .065 : .0008;
          if (scenario === 'changing-noise' && i >= rate*2) amplitude = .065;
          if (scenario === 'known-mixture') amplitude = mixtureAmplitude;
          const tailStart = rate*2 + voice.length;
          // Known added-noise RMS: -70 dBFS calibration, -58 dBFS tail.
          // Delay the step 500 ms beyond the entire source waveform so neither
          // reference interval needs manually inferred human speech boundaries.
          if (scenario.startsWith('low-floor')) amplitude = Math.sqrt(3) * 10 ** (-70 / 20);
          if (scenario === 'low-floor-rise' && i >= tailStart + rate*.5) amplitude = Math.sqrt(3) * 10 ** (-58 / 20);
          if ((scenario === 'brief-noise' || scenario === 'short-tail-burst') && i >= tailStart + rate*.5 && i < tailStart + rate*.6) amplitude = .065;
          // Appended silence changes only the denominator, not the clipped samples.
          const appended = scenario === 'clipped-plus-silence' && i >= rate*2+voice.length+rate;
          const gridGain = scenario === 'grid-burst' && i >= tailStart + rate*.5 && i < tailStart + rate*.6 ? 10 ** (7 / 20) : 1;
          const noise = noiseGridEvaluation ? .003 * (i % 2 ? -1 : 1) * gridGain : appended ? 0 : (seed/4294967296*2-1)*amplitude;
          const reflected = scenario === 'echo' && position >= 1920 && position-1920 < voice.length ? voice[position-1920]*.65 : 0;
          const gain = scenario.startsWith('clipped') ? 12 : scenario === 'quiet-source' ? .1 : 1;
          samples[i] = Math.max(-1, Math.min(1, source*gain + noise + reflected));
          signalComponent[i] = source*gain;
          noiseComponent[i] = noise;
          if (active) { signalPower += source*source; noisePower += noise*noise; }
        }
        const start = performance.now();
        const result = await new Promise((resolve, reject) => {
          const worker = new Worker('/audio-analysis.worker.js', { type: 'module' });
          const cleanup = () => { clearTimeout(timer); worker.terminate(); };
          const timer = setTimeout(() => { cleanup(); reject(new Error('Worker timed out')); }, 60000);
          worker.onerror = () => { cleanup(); reject(new Error('Worker failed')); };
          worker.onmessage = ({data}) => {
            if (data.result || data.error) {
              cleanup();
              if (data.error) reject(new Error(data.error));
              else resolve(data.result);
            }
          };
          worker.postMessage({samples, sampleRate: rate, quietSeconds: 2,
            context: {use_case:'meetings',device_type:'unknown',mode:'basic'},
            capture: {format:'pcm',echoCancellation:false,noiseSuppression:false,autoGainControl:false}, classifyNoise:false});
        });
        let selectedSignalPower = 0, selectedNoisePower = 0, saturated = false;
        const selected = new Uint8Array(samples.length);
        for (const segment of result.ai.segments) {
          for (let i = Math.max(rate*2, Math.floor(segment.start*rate)); i < Math.min(samples.length, Math.ceil(segment.end*rate)); i++) selected[i] = 1;
        }
        for (let i = 0; i < samples.length; i++) {
          if (Math.abs(samples[i]) >= 1) saturated = true;
          if (selected[i]) { selectedSignalPower += signalComponent[i]**2; selectedNoisePower += noiseComponent[i]**2; }
        }
        results.push({scenario, durationSeconds:samples.length/rate,
          ...(scenario === 'known-mixture' ? {referenceMixtureSnrDb:10*Math.log10(selectedSignalPower/selectedNoisePower), saturated} : {}),
          addedNoiseSnrDb: noisePower > 0 ? 10*Math.log10(signalPower/noisePower) : null,
          metrics:result.metrics, grade:result.specialState ? null : result.verdict.overall.grade,
          state:result.specialState ?? 'graded', evidence:result.evidence, segments:result.ai.segments,
          recommendation:result.recommendation, wallMs:Math.round(performance.now()-start)});
      }
      return {file:clip.file,speaker:clip.speaker, source:{durationSeconds:voice.length/rate,
        rmsDb:20*Math.log10(Math.max(rms,1e-8)),peak,nearFullScaleSamples:nearFullScale}, results};
    }, {clip, acceptance, annotationEvaluation, shortTailEvaluation, noiseGridEvaluation});
    if (annotationEvaluation || shortTailEvaluation || noiseGridEvaluation) {
      const annotation = annotations.clips.find(a => a.file === clip.file);
      for (const result of row.results) result.annotationAgreement = evaluateSpeechAnnotations(annotation, result.segments, 2);
    }
    rows.push(row);
    console.log(`${clip.file}: ${row.results.map(r=>`${r.scenario}=${r.grade ?? r.state}`).join(', ')}`);
  }
  const report = {date:new Date().toISOString(),browser:browser.version(),platform:process.platform,
    description:'Human speech production-worker diagnostic benchmark. No manual speech boundaries or listening review; source residual noise is unknown. Added-noise SNR uses whole-clip source power, not annotated speech-only power, and is not an SNR accuracy ground truth.',
    parameters:{sampleRate:16000,calibrationSeconds:2,normalTailSeconds:1,extendedTailSeconds:10,seed:12345,lowNoiseAmplitude:.0008,highNoiseAmplitude:.065,clippingGain:12,echoDelayMs:120,echoGain:.65}, rows};
  if (noiseGridEvaluation) {
    report.description = '22.05 kHz production-worker diagnostic with exact injected square-noise labels and frozen AI-assisted source candidates. Existing development speakers; no physical capture or human boundary accuracy claim.';
    report.annotationsSha256 = createHash('sha256').update(await readFile(path.join(fixtures, 'annotations.consensus.ai.json'))).digest('hex');
    report.parameters = { sampleRate: 22050, calibrationSeconds: 2, tailSeconds: 1, noiseRms: .003, burstRiseDb: 7, burstAfterSourceSeconds: [.5, .6] };
    if (baselineRef) report.baselineGuidedRef = baselineRef;
    await writeFile(path.join(root, baselineRef ? 'docs/noise-grid-worker-baseline.json' : 'docs/noise-grid-worker-results.json'), JSON.stringify(report,null,2)+'\n');
    const misses = rows.filter(row => row.results.find(r => r.scenario === 'grid-burst').evidence.retryReason !== 'noise_unstable').length;
    const falseAlarms = rows.filter(row => row.results.find(r => r.scenario === 'grid-stationary').state !== 'graded').length;
    console.log(`Noise-grid evaluation: ${misses} misses, ${falseAlarms} stationary false alarms`);
    if (misses || falseAlarms) process.exitCode = 1;
  } else if (shortTailEvaluation) {
    report.description = 'Short-tail noise-event evaluation with exact injected event labels and frozen Groq-assisted source speech candidates; uncertain speech excluded. Existing development speakers, new tail conditions; no physical microphone claim.';
    report.annotationsSha256 = createHash('sha256').update(await readFile(path.join(fixtures, 'annotations.consensus.ai.json'))).digest('hex');
    report.parameters.shortTailSeconds = .75;
    report.parameters.burstAfterSourceSeconds = [.5, .6];
    await writeFile(path.join(root, 'docs/short-tail-noise-results.json'), JSON.stringify(report,null,2)+'\n');
    const misses = rows.filter(row => row.results.find(r => r.scenario === 'short-tail-burst').evidence.retryReason !== 'noise_unstable').length;
    const falseAlarms = rows.filter(row => row.results.find(r => r.scenario === 'short-tail-stationary').state !== 'graded').length;
    console.log(`Short-tail evaluation: ${misses} misses, ${falseAlarms} stationary false alarms`);
    if (misses || falseAlarms) process.exitCode = 1;
  } else if (annotationEvaluation) {
    report.description = 'Production-worker agreement with frozen independent model-assisted provisional labels. Uncertain source regions excluded. These are not human-ground-truth precision/recall or boundary accuracy.';
    report.annotationsSha256 = createHash('sha256').update(await readFile(path.join(fixtures, 'annotations.ai.json'))).digest('hex');
    report.annotationProtocol = annotations.protocol;
    await writeFile(path.join(root,'docs/ai-annotation-evaluation.json'), JSON.stringify(report,null,2)+'\n');
  } else if (!acceptance) await writeFile(path.join(root,'docs/human-speech-results.json'),JSON.stringify(report,null,2)+'\n');
  if (acceptance) {
    const failures = [];
    for (const row of rows) {
      const get = scenario => row.results.find(r => r.scenario === scenario);
      const check = (ok, message) => { if (!ok) failures.push(`${row.file}: ${message}`); };
      const mixture = get('known-mixture');
      check(!mixture.saturated, 'known mixture must not saturate');
      check(mixture.evidence.speechSeconds >= 1, 'known mixture must detect sufficient speech');
      check(Number.isFinite(mixture.referenceMixtureSnrDb) && Math.abs(mixture.metrics.snrDb-mixture.referenceMixtureSnrDb) <= 2,
        `mixture SNR error must be <= 2 dB (estimated ${mixture.metrics.snrDb}, reference ${mixture.referenceMixtureSnrDb})`);
      check(get('echo').metrics.echoScore - get('low-noise').metrics.echoScore >= .2,
        'strong 120 ms reflection must raise experimental echo score by >= 0.2');
      check(get('brief-noise').evidence.noiseStability === 'unstable',
        '100 ms high-noise burst must flag changed noise evidence');
      check(get('short-tail-burst').evidence.noiseStability === 'unstable' && get('short-tail-burst').evidence.retryReason === 'noise_unstable' && get('short-tail-burst').grade === null,
        '100 ms burst in a 750 ms source tail must withhold grading and request retry');
      check(get('short-tail-stationary').state === 'graded' && get('short-tail-stationary').evidence.noiseStability !== 'unstable',
        'short stationary tail must not cause an unsupported retry');
      check(get('low-noise').evidence.noiseStability === 'stable', 'stationary control must remain stable');
      check(get('low-floor-stationary').evidence.noiseStability === 'stable', 'sub-floor stationary control must remain stable');
      check(get('low-floor-stationary').state === 'graded', 'sub-floor stationary control must retain grading');
      check(get('low-floor-rise').evidence.noiseStability === 'unstable', '-70 to -58 dBFS tail increase must invalidate calibration');
      check(get('low-floor-rise').evidence.retryReason === 'noise_unstable' && get('low-floor-rise').grade === null,
        'low-floor increase must withhold grade and request noise-stability retry');
      for (const scenario of ['original', 'low-noise', 'noisy', 'clipped', 'clipped-plus-silence', 'echo', 'known-mixture']) {
        check(get(scenario).state === 'graded', `${scenario} must not request an unsupported retry`);
      }
      check(get('changing-noise').evidence.retryReason === 'noise_unstable', 'sustained noise increase must request retry');
      check(get('clipped').metrics.speechClippingRatio === get('clipped-plus-silence').metrics.speechClippingRatio,
        'speech clipping must be invariant to appended silence');
    }
    console.log(`Fixture acceptance: ${rows.length} recordings, ${failures.length} unmet expectations`);
    for (const failure of failures) console.error(failure);
    if (failures.length) process.exitCode = 1;
  }
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
