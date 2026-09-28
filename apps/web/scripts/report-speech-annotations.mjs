import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const annotationsBytes = await readFile(path.join(root, 'apps/web/e2e/fixtures/human-speech/annotations.ai.json'));
const annotations = JSON.parse(annotationsBytes);
const evaluation = JSON.parse(await readFile(path.join(root, 'docs/ai-annotation-evaluation.json'), 'utf8'));
if (createHash('sha256').update(annotationsBytes).digest('hex') !== evaluation.annotationsSha256) throw new Error('Evaluation labels are stale');
const f = value => value.toFixed(3);
const sums = annotations.clips.reduce((sum, c) => {
  for (const [key, value] of Object.entries(c.secondsByLabel)) sum[key] = (sum[key] ?? 0) + value;
  return sum;
}, {});
const duration = sums.speech + sums.nonspeech + sums.uncertain;
const conditions = ['original', 'low-noise', 'noisy', 'quiet-source'];
const conditionRows = conditions.map(scenario => {
  const totals = {};
  for (const row of evaluation.rows) for (const [key, value] of Object.entries(row.results.find(r => r.scenario === scenario).annotationAgreement.seconds)) totals[key] = (totals[key] ?? 0) + value;
  const precision = totals.truePositive / (totals.truePositive + totals.falsePositive);
  const recall = totals.truePositive / (totals.truePositive + totals.falseNegative);
  return `| ${scenario} | ${f(totals.falseNegative)} | ${f(totals.falsePositive)} | ${(100 * precision).toFixed(2)}% | ${(100 * recall).toFixed(2)}% |`;
});
const clips = annotations.clips.map(c => `| ${c.file} | ${f(c.durationSeconds)} | ${f(c.secondsByLabel.speech)} | ${f(c.secondsByLabel.nonspeech)} | ${f(c.secondsByLabel.uncertain)} | ${(100 * c.transcriptWer).toFixed(1)}% |`);
const targets = evaluation.rows.flatMap(row => row.results.filter(r => r.annotationAgreement.seconds.falseNegative > .05).map(r => {
  const annotation = annotations.clips.find(c => c.file === row.file);
  const predicted = r.segments.map(s => ({start: s.start - 2, end: s.end - 2}));
  const missed = annotation.intervals.filter(i => i.label === 'speech' && predicted.reduce((sum, p) => sum + Math.max(0, Math.min(i.end, p.end) - Math.max(i.start, p.start)), 0) < i.end - i.start - .001);
  return `| ${row.file} | ${r.scenario} | ${f(r.annotationAgreement.seconds.falseNegative)} | ${missed.map(i => `${f(i.start)}–${f(i.end)}`).join(', ')} |`;
}));
const report = `# Independent AI-assisted speech annotations

Generated September 28, 2026. Twelve LibriSpeech source clips, six speakers,
${f(duration)} seconds. [Frozen annotations](../apps/web/e2e/fixtures/human-speech/annotations.ai.json),
[listening-review page](../apps/web/e2e/fixtures/human-speech/annotations-review.html),
and [production-worker results](ai-annotation-evaluation.json).

These are provisional model-assisted labels, not human ground truth. No listening
review was performed. They were generated independently of Miccheck's Silero
outputs and frozen before worker comparison. Existing clips have informed app
development; none is held-out evaluation evidence. No production thresholds were
selected from these results.

## Protocol and independent review

Local Whisper small.en supplies word timestamps with VAD filtering disabled,
English language, beam size 5, CPU int8, and no transcript prompt or previous-text
conditioning. WebRTC modes 1 and 3 provide a second algorithm; the two modes are
related configurations, not independent models. The Whisper revision and weight
hashes, dependency versions, clip hashes, raw words, probabilities, and both
WebRTC timelines are retained in the annotation JSON. The model is
\`${annotations.models.whisper.repo}@${annotations.models.whisper.revision}\`.
See [faster-whisper](https://github.com/SYSTRAN/faster-whisper) and
[WebRTC VAD](https://github.com/wiseman/py-webrtcvad).

Labels partition source time at 10 ms resolution:

- Speech candidate: both WebRTC modes positive, and the entire frame inside a
  word with model probability >=0.5 after excluding 60 ms at each word boundary.
- Nonspeech candidate: both modes negative and no word within 100 ms. This can
  still include missed unvoiced speech, breaths, or reverberation.
- Uncertain: all other frames, including final partial frames. A transcript word
  error rate above 25% makes the whole clip uncertain. Word probabilities are
  model outputs, not calibrated annotation confidence.

A separate Codex reviewer inspected the protocol, every clip's transcripts and
candidate coverage, and the uncertainty policy without consulting worker output.
The highest WER clip (2094-142345-0045) differs on “Mrs. Poiser” versus upstream
“MISSUS POYSER”; this is not evidence of an omitted phrase and does not warrant
discarding it. Similar spelling differences occur for Uncas and “O/Oh”. The
reviewer did not listen, certify precise boundaries, or change labels to fit app
behavior. Protocol/schema review by another AI is not independent listening.

Original noise events, room SNR, and echo remain unknown. Each clip separately
records exact injected-component intervals for the existing stationary −70 dBFS,
−70→−58 dBFS rise, and 100 ms brief-noise scenarios. Those labels describe added
noise and seeded generation settings only; they do not assert that the source
waveform is noiseless. The existing acceptance runner evaluates those conditions
through the worker.

## Coverage

${f(sums.speech)} s are speech candidates, ${f(sums.nonspeech)} s nonspeech
candidates, and ${f(sums.uncertain)} s uncertain. Only
${(100 * (sums.speech + sums.nonspeech) / duration).toFixed(1)}% of source duration
is included in agreement calculations. These conservative labels preferentially
cover easy word interiors; their high agreement must not be presented as overall
speech accuracy. Padded calibration/tail silence is excluded, preventing easy
added silence from inflating agreement.

| Clip | Duration s | Speech candidate s | Nonspeech candidate s | Uncertain s | Transcript WER |
| --- | ---: | ---: | ---: | ---: | ---: |
${clips.join('\n')}

## Current worker agreement

48 current-worker/Silero runs: original source with digital-silence calibration,
seeded low noise (uniform amplitude 0.0008), high noise (0.065), and source gain
0.1 with low noise. Each input adds two seconds of calibration and one second of
tail. Frame-duration confusion accounting uses only labeled source regions;
uncertain regions are excluded. Overlapping worker intervals are unioned.
“Missed” and “extra” below mean disagreement with candidate labels, not proven
false negatives/positives. Ratios pool durations instead of averaging clips.

| Condition | Missed candidate speech s | Extra candidate nonspeech s | Pseudo-label precision agreement | Pseudo-label recall agreement |
| --- | ---: | ---: | ---: | ---: |
${conditionRows.join('\n')}

First/last word-to-worker boundary differences are retained in JSON as candidate
timing comparisons. They are not boundary error: ASR word timestamps can extend
into silence and are unvalidated. No SNR accuracy or confidence calibration is
derived from these speech labels.

## Actionable disagreements and implementation decision

The following cases omit more than 50 ms of candidate speech. Times refer to
original source audio and show candidate regions overlapping a disagreement,
not necessarily the exact missed portion. Use the listening-review page before
adjusting VAD thresholds or noise-boundary guards.

| Clip | Condition | Missed candidate s | Review regions in source seconds |
| --- | --- | ---: | --- |
${targets.join('\n')}

Retain current production thresholds pending listening or stronger independent
alignment. The 1320-122617-0012 opening and noisy 5639-40744-0033,
260-123440-0007, and 7729-102255-0012 cases now provide specific review targets.
After labels were frozen, the separate reviewer also inspected disagreement
regions and source PCM levels. In 1320-0012, Whisper estimates “Four” at 0–0.56 s;
the disputed 0.16–0.23 s is about −40 dBFS, followed by a rise to about −19 dBFS
at 0.39–0.50 s. This could be an unvoiced /f/, breath, or timestamp overextension.
Listen to 0–0.7 s before deciding. In 5639-0033, estimated “hand” spans
3.82–4.10 s; the noisy worker ends that speech run at 3.952 s, while the disputed
tail is about −38 dBFS, below injected noise at roughly −28.5 dBFS. Compare clean
and noisy 3.5–4.3 s for final consonants versus breath/reverberation. Neither PCM
RMS nor a second AI's text review resolves that distinction, or proves a grading
or noise-stability failure. No labels were revised after seeing worker output.
This is supporting annotation work, not a claimed app optimization. Changes in
grading/confidence/advice require validated labels, a reproduced failure, and
before/after evaluation under the benchmark improvement workflow. Human speech
boundaries and original noise events remain unverified. Real microphone, room,
device, language, and processing diversity remain outside this corpus.

## Reproduce

Use Python 3.12 and the pinned annotation dependencies in
\`apps/web/scripts/annotation-requirements.txt\`. Model weights and the local
environment are ignored by Git and never bundled into the web app. Download
requires network access; inference keeps the recordings local.

\`\`\`powershell
py -3.12 -m venv .annotation-env
& './.annotation-env/Scripts/python.exe' -m pip install -r apps/web/scripts/annotation-requirements.txt
& './.annotation-env/Scripts/python.exe' apps/web/scripts/annotate-human-speech.py --revision ${annotations.models.whisper.revision}
node apps/web/scripts/review-speech-annotations.mjs
$env:ANNOTATION_EVALUATION = '1'
node apps/web/scripts/benchmark-human-speech.mjs
Remove-Item Env:ANNOTATION_EVALUATION
node apps/web/scripts/report-speech-annotations.mjs
\`\`\`

Worker reports pin the annotation-file hash; the report generator rejects stale
results. Annotation and fixture acceptance are separate modes and cannot be
combined. Current verification: 106 web unit tests with coverage, the production
web build, and all 132 worker acceptance variants passed; 48 annotation-based
worker comparisons completed. Root \`npm run test\` and
\`npm run build\` were attempted but this runtime lacks \`npm\`; direct Node
checks were used. The standalone audio-metrics npm commands remain skipped per
the documented workspace-resolution limitation.
Hashed snapshot files use LF line endings on every OS, enforced by Git attributes
and Python output settings; provenance and source-hash regression tests protect
the reports across checkouts.
`;
await writeFile(path.join(root, 'docs/AI_SPEECH_ANNOTATIONS.md'), report);
console.log('Generated docs/AI_SPEECH_ANNOTATIONS.md');
