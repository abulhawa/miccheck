// Offline annotation tool. Credentials stay in memory and never enter reports.
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const fixtures = path.join(root, 'apps/web/e2e/fixtures/human-speech');
const destination = path.join(fixtures, 'groq-large-v3-responses.json');
const options = process.argv.slice(2);
const option = name => options.includes(name) ? options[options.indexOf(name) + 1] : undefined;
const manifest = JSON.parse(await readFile(path.join(fixtures, 'manifest.json'), 'utf8'));
const parameters = {model:'whisper-large-v3', language:'en', response_format:'verbose_json', temperature:0,
  timestamp_granularities:['word', 'segment'], prompt:null};
const settingsHash = createHash('sha256').update(JSON.stringify(parameters)).digest('hex');
let report;
try { report = JSON.parse(await readFile(destination, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
report ??= {schemaVersion:1, provider:'Groq', parameters, settingsHash,
  note:'Source-only annotation calls; API model version is provider-managed. Credentials are not stored.', clips:[]};
if (report.settingsHash !== settingsHash) throw new Error('Saved response settings differ; use a separate report');
let key = process.env.GROQ_API_KEY;
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const paceMs = 6000;
let nextRequest = 0;
const limit = Number(option('--limit') ?? manifest.clips.length);
if (!Number.isInteger(limit) || limit < 1 || limit > manifest.clips.length) throw new Error('Invalid request limit');
for (const clip of manifest.clips.slice(0, limit)) {
  if (report.clips.some(c => c.file === clip.file && c.sha256 !== clip.sha256)) throw new Error('Saved source checksum differs; use a separate response snapshot');
  if (report.clips.some(c => c.file === clip.file && c.sha256 === clip.sha256)) {
    console.log(`${clip.file}: cached; no API call`); continue;
  }
  const bytes = await readFile(path.join(fixtures, clip.file));
  if (createHash('sha256').update(bytes).digest('hex') !== clip.sha256) throw new Error('Source checksum mismatch');
  if (!key && option('--env-file')) key = parseEnv(await readFile(option('--env-file'), 'utf8')).GROQ_API_KEY;
  if (!key) throw new Error('No configured Groq API credential found');
  await sleep(Math.max(0, nextRequest - Date.now()));
  const form = new FormData();
  form.append('file', new Blob([bytes], {type:'audio/flac'}), clip.file);
  for (const field of ['model', 'language', 'response_format', 'temperature']) form.append(field, String(parameters[field]));
  for (const granularity of parameters.timestamp_granularities) form.append('timestamp_granularities[]', granularity);
  let response;
  try {
    response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method:'POST', headers:{Authorization:`Bearer ${key}`}, body:form, signal:AbortSignal.timeout(60000),
    });
  } catch {
    // Do not automatically repeat an ambiguous timeout: the request may have completed.
    throw new Error('Groq request did not complete locally; saved results retained. No automatic retry.');
  }
  const rateLimits = Object.fromEntries([...response.headers].filter(([name]) => name.startsWith('x-ratelimit-') || name === 'retry-after'));
  console.log(`${clip.file}: HTTP ${response.status}; rate limits ${JSON.stringify(rateLimits)}`);
  if (response.status === 429) {
    // Stop rather than repeatedly spending a free-tier quota. A later run resumes cache.
    throw new Error(`Groq rate limit reached. Resume after the displayed reset/retry interval; saved responses retained.`);
  }
  if (!response.ok) throw new Error(`Groq returned HTTP ${response.status}; response body withheld to protect credentials`);
  const data = await response.json();
  if (!Array.isArray(data.words) || data.words.some(w => !Number.isFinite(w.start) || !Number.isFinite(w.end) || w.end < w.start)) throw new Error('Groq did not return valid word timestamps');
  report.clips.push({file:clip.file, sha256:clip.sha256, speaker:clip.speaker, durationSeconds:clip.duration_seconds,
    retrievedAt:new Date().toISOString(), rateLimits, response:data});
  await writeFile(destination, JSON.stringify(report, null, 2) + '\n');
  nextRequest = Date.now() + paceMs;
  // Pause the run before another request if a returned quota is exhausted.
  if (Object.entries(rateLimits).some(([name, value]) => name.includes('remaining') && Number(value) <= 0)) {
    if (report.clips.length < limit) throw new Error('Groq reports exhausted quota; saved responses retained for later resume');
  }
}
key = undefined;
console.log(`Saved ${report.clips.length} source transcriptions; no credentials written.`);
