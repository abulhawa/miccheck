import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const web = path.join(root, 'apps/web');
const fixtures = path.join(web, 'e2e/fixtures/human-speech');
const manifest = JSON.parse(await readFile(path.join(fixtures, 'manifest.json'), 'utf8'));
// Bundle current production sources, rather than relying on a potentially stale build.
const bundle = await build({ entryPoints: [path.join(web, 'lib/ai/audioAnalysis.worker.ts')], bundle: true,
  write: false, format: 'esm', platform: 'browser', target: 'es2022',
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
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  for (const clip of manifest.clips) {
    const bytes = await readFile(path.join(fixtures, clip.file));
    if (createHash('sha256').update(bytes).digest('hex') !== clip.sha256) throw new Error(`Checksum mismatch: ${clip.file}`);
    const row = await page.evaluate(async clip => {
      const rate = 16000;
      const ctx = new AudioContext({ sampleRate: rate });
      const decoded = await ctx.decodeAudioData(await (await fetch(`/fixtures/${clip.file}`)).arrayBuffer());
      const voice = decoded.getChannelData(0).slice();
      await ctx.close();
      let power = 0, peak = 0, nearFullScale = 0;
      for (const x of voice) { power += x*x; peak = Math.max(peak, Math.abs(x)); if (Math.abs(x) >= .98) nearFullScale++; }
      const rms = Math.sqrt(power / voice.length);
      const results = [];
      for (const scenario of ['original', 'low-noise', 'noisy', 'clipped', 'clipped-plus-silence', 'echo', 'changing-noise']) {
        const tail = scenario === 'clipped-plus-silence' ? rate*10 : rate;
        const samples = new Float32Array(rate*2 + voice.length + tail);
        let seed = 12345, signalPower = 0, noisePower = 0;
        for (let i = 0; i < samples.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          const position = i-rate*2;
          const active = position >= 0 && position < voice.length;
          const source = active ? voice[position] : 0;
          let amplitude = scenario === 'original' ? 0 : scenario === 'noisy' ? .065 : .0008;
          if (scenario === 'changing-noise' && i >= rate*2) amplitude = .065;
          // Appended silence changes only the denominator, not the clipped samples.
          const appended = scenario === 'clipped-plus-silence' && i >= rate*2+voice.length+rate;
          const noise = appended ? 0 : (seed/4294967296*2-1)*amplitude;
          const reflected = scenario === 'echo' && position >= 1920 && position-1920 < voice.length ? voice[position-1920]*.65 : 0;
          const gain = scenario.startsWith('clipped') ? 12 : 1;
          samples[i] = Math.max(-1, Math.min(1, source*gain + noise + reflected));
          if (active) { signalPower += source*source; noisePower += noise*noise; }
        }
        const start = performance.now();
        const result = await new Promise((resolve, reject) => {
          const worker = new Worker('/audio-analysis.worker.js', { type: 'module' });
          const cleanup = () => { clearTimeout(timer); worker.terminate(); };
          const timer = setTimeout(() => { cleanup(); reject(new Error('Worker timed out')); }, 60000);
          worker.onerror = () => { cleanup(); reject(new Error('Worker failed')); };
          worker.onmessage = ({data}) => { if (data.result || data.error) { cleanup(); data.error ? reject(new Error(data.error)) : resolve(data.result); } };
          worker.postMessage({samples, sampleRate: rate, quietSeconds: 2,
            context: {use_case:'meetings',device_type:'unknown',mode:'basic'},
            capture: {format:'pcm',echoCancellation:false,noiseSuppression:false,autoGainControl:false}, classifyNoise:false});
        });
        results.push({scenario, durationSeconds:samples.length/rate,
          addedNoiseSnrDb: noisePower > 0 ? 10*Math.log10(signalPower/noisePower) : null,
          metrics:result.metrics, grade:result.specialState ? null : result.verdict.overall.grade,
          state:result.specialState ?? 'graded', evidence:result.evidence, segments:result.ai.segments,
          recommendation:result.recommendation, wallMs:Math.round(performance.now()-start)});
      }
      return {file:clip.file,speaker:clip.speaker, source:{durationSeconds:voice.length/rate,
        rmsDb:20*Math.log10(Math.max(rms,1e-8)),peak,nearFullScaleSamples:nearFullScale}, results};
    }, clip);
    rows.push(row);
    console.log(`${clip.file}: ${row.results.map(r=>`${r.scenario}=${r.grade ?? r.state}`).join(', ')}`);
  }
  const report = {date:new Date().toISOString(),browser:browser.version(),platform:process.platform,
    description:'Human speech production-worker diagnostic benchmark. No manual speech boundaries or listening review; source residual noise is unknown. Added-noise SNR uses whole-clip source power, not annotated speech-only power, and is not an SNR accuracy ground truth.',
    parameters:{sampleRate:16000,calibrationSeconds:2,normalTailSeconds:1,extendedTailSeconds:10,seed:12345,lowNoiseAmplitude:.0008,highNoiseAmplitude:.065,clippingGain:12,echoDelayMs:120,echoGain:.65}, rows};
  await writeFile(path.join(root,'docs/human-speech-results.json'),JSON.stringify(report,null,2)+'\n');
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
