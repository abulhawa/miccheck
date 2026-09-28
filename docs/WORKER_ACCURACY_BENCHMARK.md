# Production-worker accuracy benchmark

September 28, 2026. This continuation of backlog item 3 runs the same 34 frozen
first-stage inputs through the actual production worker and local Silero model.
It closes the missing model-selected measurement report, while retaining explicit
accuracy failures. It does not complete the broader benchmark or claim a new
estimator improvement.

## References and protocol

The [first-stage protocol](ANNOTATED_ACCURACY_BENCHMARK.md) defines source
licenses, checksummed upstream annotations, generation settings and splits.
[Machine-readable results](worker-accuracy-results.json) retain the worker,
model manifest, estimator and source hashes, constructed PCM hashes, reference
and detected intervals, clipping errors, speech-bin agreement, boundary offsets,
SNR error, retry state and grade for every condition. Source PCM and labels are
unchanged. All sources are already inspected regression data; rooms retain their
existing development/evaluation assignments. No new speaker-independent or
untouched evaluation claim is made.

Speech precision/recall measures sample overlap with upstream 100 ms speech
bins. Outside-bin selections are disagreements, not verified false speech:
annotations have boundary uncertainty and overlapping event classes. Onset and
offset errors use the earliest/latest detected boundary overlapping each
reference interval. Missing intervals return null; overlapping selections are
counted. Splits/merges can inflate these offsets, so they are diagnostic boundary
distances, not one-to-one matched boundary accuracy. The report retains intervals
for independent review and does not invent an acceptance tolerance.

For MS-SNSD, whole padded clean-source intervals are **not speech labels**.
Speech precision/recall and boundary error are therefore null. The SNR oracle
sums retained clean and noise component power on the actual selected samples.
This matches the estimator's speech-selected quantity; comparing it directly
with the whole-source 0/10/20 dB target would conflate speech selection and SNR
error. The sources are digitally combined; native room noise already contained
in a recorded speech component is not independently recoverable.

## Findings and implementation decision

| Check | Result |
| --- | --- |
| Recording-wide clipping, 28 human-annotated component conditions | All exact duration/event-count gates pass |
| SNR, six production-worker mixtures | All errors below 0.11 dB; no missing reference or withheld grade |
| Speech clipping, four cases plus four pause extensions | Eight disagreements with annotated reference ratios |
| Three clipping sources: room21, room6, room10 | Inserted crossings excluded from selected speech; speech clipping is zero |
| room24 clipping | Crossing retained, but shorter selection raises ratio from 0.004 to about 0.004735 |

Stationary constructed-component speech-bin agreement (not native recordings):

| Room / existing split | Precision | Recall | Missed annotated seconds |
| --- | ---: | ---: | ---: |
| room21 / development | 0.9514 | 0.6576 | 0.856 |
| room6 / development | 1.0000 | 0.7497 | 0.876 |
| room24 / evaluation | 0.9835 | 0.8560 | 0.720 |
| room10 / evaluation | 0.9716 | 0.3909 | 2.132 |

These full-bin results differ from the guarded native speech-interior reports.
They must not be pooled with those different reference protocols.

room6 is the actionable grading case: the worker grades the input while reporting
zero speech clipping for an injected 20 ms crossing inside an upstream speech
interval (reference ratio approximately 0.005714). room21 and room10 withhold
grading for insufficient speech. All three preserve the recording-wide 20 ms
crossing and one event. These results distinguish speech selection from a sample
counting bug. They also show why passing supplied-annotation estimator checks
does not establish production clipping accuracy.

The implemented change is worker-level measurement verification with ordinary
acceptance gates for exact recording clipping and component SNR. Existing
estimator gates remain intact. Speech-selection disagreements stay visible as
unresolved accuracy targets; they are not marked expected failures or relabeled
as successful detection. No production threshold is changed, so no before/after
measurement benefit or optimization is claimed.

Next investigation: compare unmodified source speech and the inserted-crossing
versions around these exact intervals, using finer independently supported
speech boundaries and separate conditions for clipping in speech, nonspeech and
calibration. Determine whether the crossing itself disrupts selection or whether
an existing onset/interior miss explains it. Evaluate a targeted selection or
confidence fix on additional untouched sources before changing VAD thresholds
or grading. Do not include all recording crossings in speech grading without
checking nonspeech controls.

## Reproduce and acceptance

```powershell
node apps/web/scripts/benchmark-annotated-accuracy.mjs --worker
node apps/web/scripts/benchmark-annotated-accuracy.mjs --worker --check
```

The first command writes the separate worker report. `--check` writes no reports.
The original command without `--worker` still runs the 34 supplied-interval
estimator gates. Normal `fixture-acceptance.spec.ts` now runs the worker check and
requires all recording-clipping and selected-component SNR gates. Worker errors,
model checksum failures, missing SNR selections and out-of-tolerance SNR fail the
check. Each worker is terminated after its result or timeout; browser/server
resources close on failure. All execution is local, with zero Groq calls.

Physical microphone capture, browser processing on/off, broader languages,
speakers/devices/rooms, representative false-alarm labels and untouched evaluation
remain open. Echo remains experimental and excluded from grading.

Validation: all 34 worker cases and 34 supplied-interval estimator cases pass
their defined gates; both targeted Playwright fixture-acceptance tests pass.
The 113 web and 21 audio-core unit tests and web production build pass through
direct Node entrypoints. Root `npm run test` and `npm run build` were attempted
but cannot start because npm is unavailable in this runtime. Standalone
audio-metrics build/test remain skipped under the documented workspace-resolution
environment limitation. No production estimator or UI code changed.

The September 29 [clipping-selection continuation](CLIPPING_SELECTION_BENCHMARK.md)
now implements explicit uncertainty for omitted crossings and tests harder
recorded-waveform transformations on new reserved rooms. The results above are
the September 28 baseline; selection errors remain unresolved.
