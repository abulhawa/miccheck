import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const report=JSON.parse(await readFile(path.join(root,'docs/human-speech-results.json'),'utf8'));
const n=x=>x.toFixed(2);
const checks={expectedStates:true,noisySnrLower:true,clippedRatioHigher:true,clippingInvariant:true,clippingDilutedBySilence:0,changingNoiseStillReliable:0};
for(const row of report.rows){
  const get=name=>row.results.find(r=>r.scenario===name);
  checks.expectedStates &&= row.results.every(r=>r.scenario==='changing-noise' ? r.state==='INSUFFICIENT_EVIDENCE' && r.evidence.retryReason==='noise_unstable' : r.state==='graded');
  checks.noisySnrLower &&=get('noisy').metrics.snrDb<get('low-noise').metrics.snrDb;
  checks.clippedRatioHigher &&=get('clipped').metrics.clippingRatio>get('low-noise').metrics.clippingRatio;
  checks.clippingInvariant &&= get('clipped-plus-silence').metrics.clippingRatio===get('clipped').metrics.clippingRatio &&
    Math.abs(get('clipped-plus-silence').metrics.clippedDurationSeconds-get('clipped').metrics.clippedDurationSeconds)<1e-9 &&
    get('clipped-plus-silence').grade===get('clipped').grade;
  if(get('clipped-plus-silence').metrics.clippingRatio<get('clipped').metrics.clippingRatio) checks.clippingDilutedBySilence++;
  if(get('changing-noise').evidence.noiseReliable) checks.changingNoiseStillReliable++;
}
const lines=['# Human speech diagnostic benchmark','',`Recorded ${report.date}; ${report.platform}, Chromium ${report.browser}.`,'',
  'The purpose of these recordings and results is to improve mic-checker measurements and guidance. Follow the [improvement workflow](BENCHMARK.md#improvement-workflow): reproduce a concrete failure, implement a fix, and compare missed failures and false alarms before and after. This report verifies earlier clipping and sustained-noise fixes; further passing cases alone do not establish a new optimization. Brief noise-event detection remains an [open improvement target](BACKLOG.md#2-assess-background-noise-stability--high-priority).','',
  'Twelve unmodified English audiobook clips from six speakers were each analyzed under seven conditions (84 production-worker runs). All fixture SHA-256 hashes were checked before analysis. The runner bundles current production sources and uses the actual Silero model in Chromium; it supplies no speech boundaries or mocked model outputs. Background classification is disabled.','',
  '## Scope and source review','',
  'This is an automated signal review and diagnostic benchmark, not a completed listening review or accuracy evaluation. Source residual noise and reverberation are unknown. Near-full-scale samples are a clipping indicator, not proof of distortion. No manually labeled speech timestamps exist, so speech precision/recall and boundary error are not reported. Grades use meeting mode with an unknown device.','',
  '| Source recording | Seconds | RMS dBFS | Peak | Samples ≥ 0.98 | Original grade |',
  '| --- | ---: | ---: | ---: | ---: | --- |'];
for(const row of report.rows) lines.push(`| [${row.file}](../apps/web/e2e/fixtures/human-speech/${row.file}) | ${n(row.source.durationSeconds)} | ${n(row.source.rmsDb)} | ${n(row.source.peak)} | ${row.source.nearFullScaleSamples} | ${row.results[0].grade??row.results[0].state} |`);
lines.push('','## Conditions','',
  '- Original: two seconds of digital silence, the unmodified source, then one second of silence. Its SNR is inflated by silent calibration and must not be interpreted as original room quality.',
  '- Low-noise / noisy: identical seeded broadband noise throughout calibration, speech, and the one-second tail, with amplitudes 0.0008 / 0.065.',
  '- Clipped: 12× source gain, low background noise, hard limiting at ±1.',
  '- Clipped-plus-silence: identical clipped input followed by nine extra seconds of digital silence.',
  '- Echo: low noise plus a delayed source copy at 120 ms and gain 0.65. This is a single reflection, not a realistic room impulse response.',
  '- Changing-noise: low noise during calibration, high noise afterwards, including the final nonspeech second.','',
  'The JSON includes an added-noise power ratio measured over the whole source clip. It is not ground-truth speech-only SNR: the source already contains unknown noise and internal pauses, and VAD selects a different interval.','',
  '## Findings','',
  `- All 84 variants reached the expected state (grade for stationary variants; retry for changing noise): ${checks.expectedStates}.`,
  `- Stationary high noise reduced measured SNR for every clip: ${checks.noisySnrLower}.`,
  `- Amplification/hard limiting increased reported clipping for every clip: ${checks.clippedRatioHigher}.`,
  `- Speech clipping, recording-wide clipped duration, and overall grade stayed invariant after appending silence for all twelve: ${checks.clippingInvariant}. Clipping dilution occurred in ${checks.clippingDilutedBySilence}/12 clips.`,
  `- Changing-noise recordings were still marked noiseReliable in ${checks.changingNoiseStillReliable}/12 clips; these now request a retry instead of issuing a misleading grade.`,
  '- Echo is excluded from grading. A reflection can nevertheless change level and VAD selection, so its overall grade need not equal the source grade.','',
  'Retain all twelve as provisional source candidates for regression testing. None is certified clean or representative of microphone quality; suitability for accuracy ground truth remains pending listening review and annotation.','',
  '## Detailed results','',
  '| Clip | Condition | Grade | Speech seconds | SNR dB | Level dBFS | Clipping % | Echo score |',
  '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |');
for(const row of report.rows) for(const r of row.results) lines.push(`| ${row.file} | ${r.scenario} | ${r.grade??r.state} | ${n(r.evidence.speechSeconds)} | ${n(r.metrics.snrDb)} | ${n(r.metrics.rmsDb)} | ${n(r.metrics.clippingRatio*100)} | ${n(r.metrics.echoScore)} |`);
lines.push('','## Reproduce','',
  'From the repository root, with dependencies and Playwright Chromium installed:','',
  '```sh','node apps/web/scripts/benchmark-human-speech.mjs','node apps/web/scripts/report-human-speech.mjs','```','',
  'The benchmark starts and closes its own loopback server and headless browser; no Next.js server or physical microphone is required. Variants are generated in memory and originals stay unchanged. The run writes [human-speech-results.json](human-speech-results.json); the second command regenerates this report. Timings are one run per input, include model startup, and are not representative device latency.','',
  'The [baseline report](HUMAN_SPEECH_BASELINE.md) records the original failures before these fixes. Noise stability currently uses 250 ms windows in nonspeech runs with at least 500 ms of usable audio, excludes 200 ms around speech boundaries, and requires at least two windows differing from calibration by more than 6 dB. Both levels are floored at -60 dBFS. These are provisional heuristics; they do not establish calibrated accuracy. Missing usable quiet audio is unassessed and lowers diagnostic certainty without forcing a retry.','',
  'Next: listen to source clips, annotate speech boundaries, and expand beyond English audiobooks and test actual microphones before making real-world accuracy claims.','');
await writeFile(path.join(root,'docs/HUMAN_SPEECH_BENCHMARK.md'),lines.join('\n'));
console.log(JSON.stringify(checks));
if(!checks.expectedStates || !checks.noisySnrLower || !checks.clippedRatioHigher || !checks.clippingInvariant || checks.changingNoiseStillReliable) process.exitCode=1;
