# Groq Large V3 annotation comparison

September 28, 2026. Twelve original licensed recordings (80.595 seconds),
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

Under the existing unchanged tokenizer, small.en has 7 word edits
over 237 reference tokens (2.95% pooled WER),
and Large V3 has 5 (2.11%).
Exact transcript matches rise from 7/12
to 8/12. Corrections include
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

7.010 s of speech candidates and
1.150 s of nonspeech candidates were withdrawn.
Coverage changes from 44.2% to
34.1%; uncertainty rises
from 55.8% to 65.9%.
This improves traceability and conservatism, not demonstrated label accuracy or
coverage. The original annotations remain available for comparison.

| Clip | Small WER | Large WER | Speech withdrawn s | Nonspeech withdrawn s | Out-of-source timing |
| --- | ---: | ---: | ---: | ---: | --- |
| 1320-122617-0003.flac | 0.00% | 0.00% | 0.540 | 0.200 | Yes |
| 1320-122617-0012.flac | 3.85% | 0.00% | 0.950 | 0.000 | No |
| 5639-40744-0002.flac | 0.00% | 0.00% | 0.420 | 0.330 | No |
| 5639-40744-0033.flac | 0.00% | 0.00% | 0.730 | 0.220 | No |
| 260-123440-0018.flac | 10.00% | 10.00% | 0.160 | 0.000 | No |
| 260-123440-0007.flac | 0.00% | 0.00% | 0.530 | 0.040 | Yes |
| 7729-102255-0045.flac | 0.00% | 0.00% | 0.730 | 0.110 | No |
| 7729-102255-0012.flac | 0.00% | 0.00% | 0.220 | 0.000 | No |
| 2094-142345-0059.flac | 6.67% | 6.67% | 1.280 | 0.250 | No |
| 2094-142345-0045.flac | 25.00% | 12.50% | 0.160 | 0.000 | No |
| 3575-170457-0023.flac | 0.00% | 0.00% | 0.690 | 0.000 | No |
| 3575-170457-0020.flac | 3.23% | 3.23% | 0.600 | 0.000 | No |

## Same worker, stricter label subset

The same 48 saved worker results were re-evaluated offline. Parent annotation,
Groq response, and saved-worker hashes prevent accidental mixing of snapshots.
No extra Groq requests or production-worker executions were needed. Ratios pool
source-only durations, exclude uncertain regions and calibration/tail padding,
and describe pseudo-label agreement only. Any apparent increase in agreement
comes from excluding disputed labels; the app did not improve.

| Condition | Missed candidate speech s | Extra candidate nonspeech s | Precision agreement | Recall agreement |
| --- | ---: | ---: | ---: | ---: |
| original | 0.060 | 0.000 | 100.00% | 99.76% |
| low-noise | 0.056 | 0.000 | 100.00% | 99.78% |
| noisy | 0.288 | 0.062 | 99.75% | 98.85% |
| quiet-source | 0.182 | 0.000 | 100.00% | 99.27% |

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
