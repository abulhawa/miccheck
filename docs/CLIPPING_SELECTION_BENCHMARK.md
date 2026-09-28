# Clipping-selection uncertainty: recorded benchmark and improvement

September 29, 2026. Continues backlog item 3 with an implemented confidence and
result-explanation improvement. Detected speech can omit near-full-scale samples,
so a speech-clipping ratio of zero is not evidence that all speech is free of
crossings. The app now reports the unselected post-calibration crossing duration,
labels the ratio as **clipping in detected speech**, and limits diagnostic
certainty to low when that attribution is unknown. Graded results explain the limitation
and asks the user to listen for distortion.

## Failure and independent construction

The [previous worker benchmark](WORKER_ACCURACY_BENCHMARK.md) exposed three
missed inserted speech crossings. Comparing its unchanged and flat-crossing
inputs establishes two different causes:

- room6 already excludes the crossing's location (3.70–3.72 s) in the unmodified
  mixture. Its selected intervals are identical before/after the insertion.
- room21 loses its first utterance and room10 loses its early selection after
  inserting a flat 20 ms plateau. These affect speech evidence as well as clipping.

A flat plateau is a sample-count reference, not a realistic overdriven utterance.
The new comparison therefore adds hard clipping of the recorded waveform:
select upstream annotated speech spans of at least 500 ms, trim 200 ms from both
boundaries, scale those samples so the original maximum reaches magnitude 4,
and clamp to ±0.99. Gain comes only from retained source samples and upstream
labels, before model inference. This preserves the waveform below the cap while
introducing exactly enumerable crossings. It is a controlled nonlinear
transformation, not measured microphone distortion or audibility truth.

Each speech source has original, flat-crossing, hard-clipped-speech,
tail-crossing and calibration-crossing cases. Tail controls on contiguous crops
append 500 ms from the calibration background before inserting the crossing;
they do not overwrite speech at the source's end. Model continuation can still
select this constructed tail, which is reported rather than assumed nonspeech.
Noise controls use original and hard-clipped-noise cases; the transformation is
restricted to 3–5 s. Source WAVs remain unchanged.

The oracle enumerates post-calibration crossing samples against the actual
selected mask, independently of the new metric computation. Separate upstream
speech interiors count clipping misses; those annotations are not substituted
for the production detector. Recording counts, unselected duration, confidence,
control confidence, grade and advice have ordinary failing acceptance gates.

## Data separation and results

[Regression results](clipping-selection-all-results.json) include 41 conditions
from the original four rooms plus six existing continuation crops.
[Evaluation results](clipping-selection-evaluation-results.json) include twelve
conditions from three new licensed crops in two unused rooms. Their
[selection, provenance and licenses](../apps/web/e2e/fixtures/clipping-selection-evaluation/README.md)
were frozen from upstream labels before app outputs. Existing development rooms
informed the change; new rooms were not used to select a VAD threshold.

| Measurement / behavior | Existing regression conditions | Reserved room conditions |
| --- | ---: | ---: |
| Total cases | 41 | 12 |
| Exact duration/confidence/grade/advice gate failures | 0 | 0 |
| Medium certainty despite unselected crossings, before → after | 6 → 0 | 3 → 0 |
| Hard-clipped speech with missed interior crossings | 6 of 7 | 1 of 2 |
| Original/calibration controls with changed certainty when no unselected crossing exists | 0 | 0 |
| Hard-clipped noise reporting detected speech | 0 of 3 | 0 of 1 |

For reserved room4 hard-clipped speech, 2,985 of 20,164 annotated-interior
crossing samples fall outside selected speech (0.124375 s). The app now retains
that unknown-attribution evidence; it already withheld grading for insufficient
speech. Reserved room2's hard-clipped waveform retains all 11,720 crossing
samples. Both reserved flat-crossing speech cases remain graded while omitting
the inserted crossing; their certainty changes from medium to low. This is a
confidence correction, not improved VAD recall or clipping-ratio accuracy.

The baseline is the frozen previous guided estimator on the same actual worker
segments. Current VAD/model and scoring dependencies are unchanged. This
isolates confidence/metric behavior without claiming a separate historic model
run. Reports retain baseline/worker/model hashes, source and label hashes,
constructed PCM hashes, gain/spans, selected intervals, exact counts, guidance
and every gate. Room selection and the candidate are frozen in separate files.

## Decision, tradeoffs and remaining failures

Keep speech-only grading and clipping/gain recommendations. Outside-selected
crossings may be actual nonspeech; assigning them to speech would create false
clipping advice. Calibration is excluded from the new uncertainty count. All
53 states, grades and recommendations remain identical to the previous estimator
on the same selections. Confidence is intentionally more conservative for real
nonspeech crossings too, because their attribution cannot be established from
selection alone. No new retry reason is introduced.

The guarded hard-clipped cases confirm that some crossing misses survive a more
speech-like transformation. Coarse source event bins do not justify expanding
VAD into every crossing or changing its onset gate. Fine independently supported
speech boundaries and physical overdrive captures are still needed before
optimizing selection or grading. Next target: distinguish late/weak speech
onsets from clipping-induced model disruption, with untouched speakers and
microphones plus nonspeech/transient controls. These nine rooms are now
regression data and must not be called fresh held-out sources again.

This stage expands licensed rooms and implements uncertainty handling. It does
not complete the corpus's speaker/language/device coverage, a speaker-independent
split, representative speech precision/recall and boundary truth, or the complete
physical capture path. Capture flags are worker inputs; original browser
processing settings are unknown. Echo remains experimental and outside grading.

## Reproduce and validate

```powershell
node apps/web/scripts/benchmark-clipping-selection.mjs
node apps/web/scripts/benchmark-clipping-selection.mjs --evaluation
node apps/web/scripts/benchmark-clipping-selection.mjs --check
node apps/web/scripts/benchmark-clipping-selection.mjs --evaluation --check
```

`--pilot` restricts the same protocol to the two original development rooms.
`--check` writes no reports. Normal fixture acceptance runs both 41- and 12-case
checks without skipped/expected failures. The recorded UI tests send actual PCM
through the production worker, persist the paired playable audio/result, and
verify the mobile result's warning and its absence on the original control.
This is fixture-based worker/rendering coverage, not physical capture validation.
All inference is local; zero Groq API calls.

Physical capture remains open by the user's September 29 instruction to use
licensed datasets. No microphone recording or upload was requested or performed.

Validation: all 53 new worker conditions and all existing fixture-acceptance
gates pass. Fifteen Playwright checks pass across full fixture acceptance,
real-speech regressions, the new mobile result checks and the fake-microphone
PCM capture/restore/compare/track-release flow. All 119 web and 21 audio-core
unit tests and the web production build pass through direct Node entrypoints.
An initial unit run under concurrent benchmark load timed out on the existing
five-second noise-phase test; the full rerun with four workers passed without
changing test expectations or timeouts. Fixture/candidate checks and staged
source/annotation hashes pass, with exact fixture bytes preserved by Git attributes.

Root `npm run test` and `npm run build` were attempted but npm is unavailable in
this runtime. Standalone audio-metrics build/test remain skipped under the
repository's documented workspace-resolution environment limitation. Normal
builds/tests use no external inference. No physical capture accuracy is claimed
from the fake-microphone flow.
