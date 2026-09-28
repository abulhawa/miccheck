# STARSS22 production-worker comparison

September 28, 2026. Four real recorded rooms, frozen upstream human event
annotations, and independently defined component-level retry expectations.
This is supporting evidence for open backlog point 2. It does not complete
representative window/threshold/floor tuning or establish native recording SNR.

## Target and independent labels

The intended improvement target is missed noise changes or unnecessary retries
with natural recorded background waveforms and independently annotated speech.
The [corpus selection](../apps/web/e2e/fixtures/starss22/README.md) was frozen
before inspecting app outputs. Two rooms are development conditions and two
different rooms are evaluation conditions; both sites appear in each split.

Native event presence is not a noise-change label. In these excerpts, typical
domestic/music event levels are close to initial calibration. A one-second
mixture RMS measurement cannot exclude unannotated voices/interference or label
all other quiet intervals. Therefore native whole-recording retry expectations
are explicitly **unknown**, rather than adjusted to match the app.

For twelve independently labeled comparisons, use each recording's first 2 s
as a repeating background component, and select a continuous 5 s source excerpt
containing the most upstream speech frames (at least 2 s). Select by upstream
metadata, tie by onset; no VAD outputs are involved. Construct 2 s calibration,
5 s source excerpt plus background, and 4.5 s background tail. The three cases
are unchanged background and an exact +12/−12 dB component gain change from
0.75 to 3.25 s after the source excerpt. The 2.5 s plateau exceeds the existing
sustained-change evidence requirement with substantial threshold margin.

These are constructed sequences using recorded components, not contiguous
physical captures. The reference signal is the complete source excerpt,
including its unknown residual background. There is no normalization, clipping,
limiting, or absolute source SNR claim. Source samples, hashes, independent
mixture-level measurements, cases, and expected stability/retry are frozen in
[reference.json](../apps/web/e2e/fixtures/starss22/reference.json). Changing the
reference generator to produce different labels fails against the saved
snapshot; a changed protocol requires a separately reviewed version.

## Estimator and production-worker results

The annotation-driven estimator receives the upstream speech intervals instead
of Silero predictions. Its `silero` evidence flag exercises grading eligibility;
it does not mean a second neural model ran. The production worker independently
runs real Silero and the current source-bundled estimator in Chromium.
Capture processing flags remain unknown; no raw/browser-processing-off claim
is made for the source. The production worker hash is identical in both reports:
`2a3cd1a9e9d2032ccc6de99a774047cb201c4cc85663397bef4debf0d7bb8b42`.

| Frozen case | Development | Evaluation | Worker failures | Annotation-driven estimator failures |
| --- | ---: | ---: | ---: | ---: |
| Stationary component, stable and graded | 2 | 2 | 0 | 0 |
| +12 dB component, unstable and noise retry | 2 | 2 | 0 | 0 |
| −12 dB component, unstable and noise retry | 2 | 2 | 0 | 0 |

All eight changed cases withhold grading and return `noise_unstable`; all four
stationary cases retain grading (F in this particular mixture). Retaining a
grade is the noise-stability requirement, not a claim of good microphone quality.
The reports preserve state, stability, noise reliability, certainty, segments,
and recommendation. Counts apply to these frozen component cases; native clips
are excluded from noise missed-event/false-retry counts.

[Development results](starss22-development-results.json) were inspected first.
No parameters or production code were changed before the
[evaluation results](starss22-evaluation-results.json) were generated.
This is a held-out-room check of the current implementation, not a before/after
improvement claim. After inspection these four sources are reusable regression
evidence; future tuning should retain an untouched additional evaluation set.

## Native speech-selection findings

Native clips remain unmodified contiguous mono excerpts. Comparison uses 100 ms
annotation bins: speech interiors exclude 200 ms around speech transitions;
candidate nonspeech requires domestic/water labels and a 500 ms collar excluding
speech, laughter, music, and instruments. Remaining bins are uncertain. This
limits the effect of annotation quantization and avoids treating music with
unknown vocals or empty metadata as verified nonspeech.

| Native recording | Matched speech interiors (s) | Missed interiors (s) | Candidate-noise agreement (s) | Uncertain (s) | Worker guidance |
| --- | ---: | ---: | ---: | ---: | --- |
| room21 / mix023, development | 0 | 1.7 | 45.3 | 13.0 | No speech detected |
| room6 / mix007, development | 6.2 | 3.1 | 26.0 | 24.7 | Noise retry |
| room24 / mix011, evaluation | 10.5 | 2.7 | 22.6 | 14.3 | Noise retry |
| room10 / mix003, evaluation | 1.2 | 4.6 | 0 | 54.2 | Graded F, stable |

Pooled interior speech recall is 17.9/30.0 = 59.7% on these annotated interiors.
No speech predictions intersect the 93.9 s of conservative candidate-noise
bins. This is not a representative accuracy percentage or proof of no false
speech: 106.2 s (46.2%) is excluded, and target annotations do not exhaust all
interference. Event-level boundary error and original SNR remain unmeasured.

Room21's native recording returns zero detected speech despite 2.8 s of upstream
speech labels (1.7 s after collars). Its constructed excerpt is detected well
enough to grade. Room10 also has substantial speech-interior misses. Investigate
the annotated source regions and app-length contiguous excerpts before changing
VAD thresholds or treating detected nonspeech as definitive background.
The 50–60 s native clips exceed the app's current 20 s voice-stage limit; their
context-length behavior is diagnostic, not a demonstrated failure in the real
20 s capture flow. The 11.5 s component cases fit that duration.

## Decision and remaining work

Retain the current noise windows, guards, >6 dB change threshold, and −60 dBFS
floor. The labeled component cases pass and do not justify tuning. Native
speech-selection disagreements are actionable; they do not justify changing
noise parameters to match output or assigning noise false-retry labels where
ground truth is unknown. No estimator optimization was made in this expansion.

Next: independently assess native quiet/event regions and shorter contiguous
speech examples, define retry truth with uncertainty, and evaluate any resulting
fix against new reserved rooms. Collect more devices and browser processing
conditions, cases near the threshold/floor, and independently supported short
transient policy. STARSS22's 100 ms grid cannot label 20–90 ms behavior precisely.
Point 2 stays open as requested.

## Reproduction

```powershell
python apps/web/scripts/verify-starss22.py
python apps/web/scripts/prepare-starss22-reference.py
node apps/web/scripts/benchmark-starss22.mjs
node apps/web/scripts/benchmark-starss22.mjs --evaluation
```

All commands are offline with committed fixtures and installed model/runtime
assets. No Groq calls or network model downloads occur. Normal fixture acceptance
runs both splits with `STARSS22_NO_REPORT=1`, asserting all labeled cases and
preserving report snapshots. Native unknown labels are diagnostic, not skipped
or expected-failure acceptance targets.

Validation: all 111 web unit tests with coverage, the production web build,
and both Playwright fixture-acceptance tests passed. The browser suite includes
the existing human recording gate and all twelve frozen STARSS22 component
cases. Source/reference verification, JavaScript/Python syntax checks, and
`git diff --check` passed. Root `npm run test` and `npm run build` were attempted
but npm is absent in this runtime; the web checks ran through direct Node
entrypoints. Standalone audio-metrics build/test remain skipped under the
documented workspace-resolution limitation. No production estimator code changed
in this comparison, and no Groq calls were made.
