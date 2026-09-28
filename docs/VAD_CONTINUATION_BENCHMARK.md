# Confirmed speech continuation

September 28, 2026. Implemented a scoped speech-selection improvement in
`apps/web/lib/ai/silero.ts`. This partially advances backlog item 2, which
remains open. It does not resolve all room21/room10 misses.

## Problem, candidate and split

The [app-length investigation](STARSS22_APP_LENGTH_SPEECH.md) showed missed
human-annotated speech even within the app's capture duration. The old
segmentation uses 0.5 both to start and continue speech; softer frames can end
an otherwise established segment early.

The new rule retains the 0.5 onset gate and existing 160 ms minimum-span and
silence-gap rules. Only after the high-threshold segment reaches that minimum
span may scores of at least 0.35 continue it. Confirmation resets when the
segment ends. A lone high spike followed by sustained 0.4 evidence cannot
become speech. There is no fixed boundary padding or energy fallback. The
ONNX model, resampling, noise guards and acoustic noise thresholds are unchanged.

The [upstream Silero segmentation implementation](https://github.com/snakers4/silero-vad/blob/master/src/silero_vad/utils_vad.py)
uses distinct onset/end thresholds. Miccheck adds the confirmation restriction
to retain its existing minimum-span requirement for ambiguous spike controls.
This is an engineering hypothesis verified on the conditions below, not a
claim that the provisional values are generally optimal.

Development uses cached real-model probabilities from room21/room6. Baseline
replay must exactly reproduce the saved production-worker segments; source PCM
and annotations are checksummed. Hysteresis and small boundary padding were
explored on those development probabilities; padding was not adopted. No global
onset reduction was selected. Nine overlapping development crops improve in
five conditions and worsen in none; summed misses go 14.0 to 13.3 s, but those
overlapping sums are not independent capture-level accuracy estimates.

Before evaluation, freeze the rule/function/model hashes and select six new
contiguous 22 s crops in rooms22/23/8 by upstream annotations only. Per room,
choose maximum speech-interior coverage and maximum candidate-noise coverage,
with no annotated speech in initial 2 s; deterministic ties use other label
count, metadata path and onset. [Corpus/protocol](../apps/web/e2e/fixtures/starss22-vad/README.md)
records hashes, license, source intervals and limitations. These rooms were
not used in the earlier Miccheck pilot. Their upstream train/test designation
is distinct from this Miccheck evaluation split. No parameter changed after
their outputs were inspected.

## Actual production-worker before/after

Both workers run the same local model and current estimator in Chromium. A
frozen copy of the previous Silero wrapper supplies the baseline. Each worker
independently processes the identical original PCM. This evaluation uses actual
model inference, not supplied segments or a mocked neural detector.

| Previously untouched room | Speech interiors | Missed before | Missed after | Matched gain |
| --- | ---: | ---: | ---: | ---: |
| room22 / mix004 | 19.2 s | 2.5 s | 1.6 s | 0.9 s |
| room23 / mix007 | 19.1 s | 5.5 s | 4.6 s | 0.9 s |
| room8 / mix001 | 19.8 s | 2.0 s | 1.8 s | 0.2 s |
| Total annotated interiors | 58.1 s | 10.0 s | 8.0 s | 2.0 s |

All three speech crops improve without increasing misses. Pooled recall on
these interiors increases from 48.1/58.1 (82.8%) to 50.1/58.1 (86.2%). Missed
interior duration drops 20% relative on these three crops only. This is not a
representative device/language accuracy percentage or word-boundary evaluation.

Three distinct noise/instrument crops contribute 66.0 s of conservative
candidate-noise bins. Neither worker predicts speech in those bins; all three
retain `NO_SPEECH`/`no_speech` guidance and no grade. Candidate controls are
human event annotations with collars, not proof that every interfering sound
is exhaustively labeled. Across the three speech crops, predicted speech in
uncertain bins rises from 1.0 to 1.1 s; the added 0.1 s is unscored, not labeled
correct or false. Playback music with possible vocals remains unvalidated.

Native grades/advice are unchanged in the six evaluation crops: room22 and
room8 retain F with unassessed noise stability, room23 retains the noise retry.
Source SNR components and native retry truth are unavailable, so different
speech RMS/SNR estimates are recorded without calling them more accurate.

[Evaluation results](vad-continuation-evaluation-results.json) preserve both
workers' segments, metrics, evidence, state, grade, certainty and recommendation,
source/model/function/worker hashes, candidate agreements and acceptance results.
Frozen relative gates reject any increased speech misses, added candidate-noise
speech, new calibration retries, or changed noise-only guidance, and require a
speech gain. Existing independently labeled noise cases remain separate gates.

## Original targets and remaining failures

[Development replay](vad-continuation-development-results.json) and
[previously inspected evaluation-room replay](vad-continuation-regression-results.json)
reuse cached real probabilities; they are not new independent model reviews.
The nine regression crops improve in six conditions, with no candidate-noise
speech additions or worsening speech conditions. Crops overlap and some contain
annotated calibration speech, so aggregate sums are diagnostic only.

Room21 38–60 s improves from 1.4 to 1.3 s of missed interiors. Detected speech
increases from 0.512 to 0.544 s and still returns `speech_too_short`. Its earlier
low-score speech never crosses 0.5 and cannot be recovered by continuation.

Room10 38–60 s remains at 4.5 s of missed interiors on the 100 ms scoring grid.
Detected speech expands from 1.536 to 1.664 s. Its noise retry becomes stable/F
after the changed segment boundaries alter excluded noise windows. Native retry
truth is unknown, so this is an unresolved advice change, not a verified removal
of a false retry. The noisy-speech target remains actionable. Room10 has no
conservative candidate-noise bins and cannot establish false-speech safety.

Retain the scoped continuation improvement because it generalizes to the three
untouched speech conditions without added candidate-noise speech in their
separate controls. Do not claim the original misses are solved. Next investigate
low-score onsets and noisy speech with stronger independent speech/nonspeech
evidence and a further untouched evaluation set; these newly inspected rooms
are now regression evidence. Physical consumer captures, browser processing,
playback music/vocals, broader acoustic threshold tuning and native retry labels
remain open. Keep echo outside grading.

## Reproduction and verification

```powershell
python apps/web/scripts/verify-starss22-vad.py
node apps/web/scripts/benchmark-vad-continuation.mjs
node apps/web/scripts/benchmark-vad-continuation.mjs --evaluation
node apps/web/scripts/benchmark-vad-continuation.mjs --regression
```

All benchmark runs are offline. Eighteen original probability traces were
reused across development/regression; initial evaluation made twelve local
worker inference runs (six cases × before/after). No Groq calls or uploads.
Unit coverage now includes weak continuation, spike-with-ambiguous-tail rejection,
expired confirmation, subthreshold tails and partial final-frame bounds. The
new evaluation participates in normal Playwright fixture acceptance, alongside
the existing human and twelve frozen recorded-component noise cases; expectations
are asserted normally, not skipped or weakened.

The web production build, all 113 web unit tests with coverage, and all 13
selected Playwright tests pass. Browser checks include all three fixture
acceptance tests, six clean/quiet/early human-speech worker cases, and the
production two-stage PCM capture, local classification, result restoration,
take comparison and playback flow using Chromium's fake microphone. This
checks the capture/UI path without claiming physical-microphone validation.
Offline fixture provenance, Python/JavaScript syntax and `git diff --check`
also pass. Root
`npm run test`/`npm run build` were attempted but npm is absent in this runtime;
web checks ran through direct Node entrypoints. Standalone audio-metrics
build/test remain skipped under the documented workspace-resolution limitation.
