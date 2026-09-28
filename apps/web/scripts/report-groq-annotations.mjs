import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {evaluateSpeechAnnotations} from './evaluate-speech-annotations.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const folder = path.join(root, 'apps/web/e2e/fixtures/human-speech');
const smallBytes = await readFile(path.join(folder, 'annotations.ai.json'));
const groqBytes = await readFile(path.join(folder, 'groq-large-v3-responses.json'));
const consensusBytes = await readFile(path.join(folder, 'annotations.consensus.ai.json'));
const workerBytes = await readFile(path.join(root, 'docs/ai-annotation-evaluation.json'));
const small = JSON.parse(smallBytes), consensus = JSON.parse(consensusBytes), worker = JSON.parse(workerBytes);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (consensus.parentHashes.smallAnnotationsSha256 !== hash(smallBytes) || consensus.parentHashes.groqResponsesSha256 !== hash(groqBytes)
  || worker.annotationsSha256 !== hash(smallBytes)) throw new Error('Stale source labels, responses, or worker snapshot');
const rows = worker.rows.map(row => {
  const clip = consensus.clips.find(c => c.file === row.file);
  if (!clip) throw new Error('Worker source missing from refined annotations');
  return {file:row.file, speaker:row.speaker, results:row.results.map(r => ({scenario:r.scenario,
    annotationAgreement:evaluateSpeechAnnotations(clip, r.segments, 2)}))};
});
await writeFile(path.join(root, 'docs/groq-annotation-evaluation.json'), JSON.stringify({
  description:'Offline re-evaluation of the same saved 48 production-worker results with frozen downgrade-only consensus labels. No additional Groq or worker requests; related-model agreement is not ground truth.',
  sourceWorkerReportSha256:hash(workerBytes), workerRecordedAt:worker.date, consensusAnnotationsSha256:hash(consensusBytes), rows,
}, null, 2) + '\n');
const totals = annotations => annotations.clips.reduce((sum, c) => {
  for (const [label, seconds] of Object.entries(c.secondsByLabel)) sum[label] = (sum[label] ?? 0) + seconds;
  return sum;
}, {});
const old = totals(small), current = totals(consensus);
const duration = Object.values(old).reduce((a,b) => a+b, 0);
const tokenCount = text => (text.toUpperCase().match(/[A-Z]+(?:'[A-Z]+)?/g) ?? []).length;
const referenceTokens = small.clips.reduce((sum,c) => sum+tokenCount(c.referenceTranscript),0);
const edits = annotations => annotations.clips.reduce((sum,c) => sum+Math.round(c.transcriptWer*tokenCount(c.referenceTranscript)),0);
const conditions = ['original', 'low-noise', 'noisy', 'quiet-source'];
const f = x => x.toFixed(3);
const tables = conditions.map(scenario => {
  const sum = rows.reduce((sum,row) => {
    for (const [key,value] of Object.entries(row.results.find(r=>r.scenario===scenario).annotationAgreement.seconds)) sum[key]=(sum[key]??0)+value;
    return sum;
  },{});
  return `| ${scenario} | ${f(sum.falseNegative)} | ${f(sum.falsePositive)} | ${(100*sum.truePositive/(sum.truePositive+sum.falsePositive)).toFixed(2)}% | ${(100*sum.truePositive/(sum.truePositive+sum.falseNegative)).toFixed(2)}% |`;
});
const clipRows = consensus.clips.map(c => {
  const previous = small.clips.find(p=>p.file===c.file);
  return `| ${c.file} | ${(100*previous.transcriptWer).toFixed(2)}% | ${(100*c.transcriptWer).toFixed(2)}% | ${f(c.refinement.downgradedSeconds.speech)} | ${f(c.refinement.downgradedSeconds.nonspeech)} | ${c.reviewFlags.includes('provider_timestamp_out_of_bounds') ? 'Yes' : 'No'} |`;
});
const report = `# Groq Large V3 annotation comparison

September 28, 2026. Twelve original licensed recordings (${f(duration)} seconds),
sent sequentially to Groq with English language, temperature 0, no transcript
prompt, verbose JSON, and word/segment timestamps. See
[Groq API reference](https://console.groq.com/docs/api-reference).
Only twelve requests were made, paced six seconds apart; one initial probe was
cached and reused. All returned HTTP 200, with no rate-limit error or retries.
Successful responses are saved per clip so resuming does not repeat calls.
The runner stops on 429, exhausted reported quota, or ambiguous timeout; it
prints quota/reset headers without printing credentials. The authorized Voice
Assistant credential was read in memory; its file was not modified or copied.
No key is stored in reports, source code, or annotations.

[Raw source responses](../apps/web/e2e/fixtures/human-speech/groq-large-v3-responses.json),
[refined candidates](../apps/web/e2e/fixtures/human-speech/annotations.consensus.ai.json),
[review page](../apps/web/e2e/fixtures/human-speech/annotations-consensus-review.html),
[saved-worker re-evaluation](groq-annotation-evaluation.json).
Original small.en annotations and their evaluation remain unchanged.

## Text improves slightly; boundaries remain uncertain

Under the existing unchanged tokenizer, small.en has ${edits(small)} word edits
over ${referenceTokens} reference tokens (${(100*edits(small)/referenceTokens).toFixed(2)}% pooled WER),
and Large V3 has ${edits(consensus)} (${(100*edits(consensus)/referenceTokens).toFixed(2)}%).
Exact transcript matches rise from ${small.clips.filter(c=>c.transcriptWer===0).length}/12
to ${consensus.clips.filter(c=>c.transcriptWer===0).length}/12. Corrections include
Unkus→Uncas and Poiser→Poyser. Remaining differences include Mrs./Missus and O/Oh;
orthography is not evidence of speech-boundary accuracy.

A separate Codex reviewer inspected both transcript/timestamp sets before the
refined labels were compared with worker output. Large V3 estimates “Four” in
1320-0012 at 0.32–0.54 s, versus small.en at 0–0.56 s. The disputed candidate
0.16–0.23 s consequently becomes uncertain. This is a corrected certainty claim,
not proof that the word was absent. “Hand” in 5639-0033 is estimated at 3.84–4.14 s
versus 3.82–4.10 s; listening is still needed to establish final consonants.
Large V3 estimates “mind” ending at 6.30 s in a 6.285 s clip and “different”
ending at 3.58 s in a 3.385 s clip. Those word regions are flagged and do not
support speech labels. Other bounded words in those clips remain eligible.
Raw provider timestamps are preserved instead of silently corrected.

## Conservative refinement

The related Whisper models may share errors. Groq does not return per-word
probabilities in these responses; no probabilities or calibrated confidence
were invented. Exact lexical-token sequence alignment handles compound words
such as servant-maid without treating punctuation as a recognition failure.
The shared compound-word extent does not establish separate token boundaries.

Original speech candidates survive only when the entire 10 ms frame is within
the same lexically matched word core in both timelines after 60 ms erosion,
with valid source bounds. Original nonspeech candidates survive only outside
both word timelines padded by 100 ms. Otherwise they become uncertain.
Previously uncertain frames stay uncertain. Nonfinite/reversed timestamps or
WER >25% leave the whole clip uncertain. Finite out-of-source words instead
withdraw speech support locally and exclude nearby nonspeech; they do not
discard the rest of a clip. Four focused tests cover alignment, invalid timing,
localized exclusions, and the rule against promoting uncertain labels.

${f(old.speech-current.speech)} s of speech candidates and
${f(old.nonspeech-current.nonspeech)} s of nonspeech candidates were withdrawn.
Coverage changes from ${(100*(old.speech+old.nonspeech)/duration).toFixed(1)}% to
${(100*(current.speech+current.nonspeech)/duration).toFixed(1)}%; uncertainty rises
from ${(100*old.uncertain/duration).toFixed(1)}% to ${(100*current.uncertain/duration).toFixed(1)}%.
This improves traceability and conservatism, not demonstrated label accuracy or
coverage. The original annotations remain available for comparison.

| Clip | Small WER | Large WER | Speech withdrawn s | Nonspeech withdrawn s | Out-of-source timing |
| --- | ---: | ---: | ---: | ---: | --- |
${clipRows.join('\n')}

## Same worker, stricter label subset

The same 48 saved worker results were re-evaluated offline. Parent annotation,
Groq response, and saved-worker hashes prevent accidental mixing of snapshots.
No extra Groq requests or production-worker executions were needed. Ratios pool
source-only durations, exclude uncertain regions and calibration/tail padding,
and describe pseudo-label agreement only. Any apparent increase in agreement
comes from excluding disputed labels; the app did not improve.

| Condition | Missed candidate speech s | Extra candidate nonspeech s | Precision agreement | Recall agreement |
| --- | ---: | ---: | ---: | ---: |
${tables.join('\n')}

Decision: preserve both annotation versions and retain current estimator/VAD
thresholds. Prioritize listening to the shifted opening words and out-of-source
final words before any broader threshold tuning. AI-assisted review has not
validated boundaries, original room noise/echo, or real microphone behavior.
The audiobook clips remain development data, not held-out evaluation speakers.

## Reproduce without spending API quota

Using the existing annotation Python environment:

    ./.annotation-env/Scripts/python.exe apps/web/scripts/refine-groq-annotations.py
    ./.annotation-env/Scripts/python.exe apps/web/scripts/test_groq_refinement.py
    node apps/web/scripts/review-speech-annotations.mjs annotations.consensus.ai.json annotations-consensus-review.html
    node apps/web/scripts/report-groq-annotations.mjs

To collect missing source responses, set GROQ_API_KEY locally and run
node apps/web/scripts/transcribe-groq-annotations.mjs. An optional --env-file
argument can read an authorized existing environment file. Cached successful
responses are reused. No API calls occur during normal app tests, builds, or
the offline commands above. Groq model weights/version are provider-managed;
the saved response snapshot, timestamps, settings, and source hashes are the
reproducible evidence rather than a claim of identical future provider output.

Verification: four refinement tests, 106 web unit tests with coverage, and the
web production build passed. A full cached transcription-run check made zero
API calls. Root npm run test and npm run build were attempted but npm is absent
from this runtime; direct Node checks were used. Standalone audio-metrics npm
build/test commands remain skipped per the known workspace-resolution limitation.
Snapshot hashes are preserved across OS checkouts using enforced LF newlines;
provenance/source-hash tests verify the saved annotation and evaluation chain.
`;
await writeFile(path.join(root, 'docs/GROQ_ANNOTATION_COMPARISON.md'), report);
console.log('Generated offline Groq comparison and saved-worker evaluation.');
