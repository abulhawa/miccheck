# Tonal burst recovery-window coverage

September 28, 2026. Scoped improvement for the open noise-stability item.

## User-visible failure and independent acceptance

Five generated 100 ms, +7 dB bursts at 55 Hz were graded using calibration noise
instead of requesting a noise retry. The same failure occurs at
16/22.05/44.1/48/96 kHz when onset is 4.565 s, 15 ms into the tested onset grid.
Speech is exactly labeled 2–4 s, calibration 0–2 s, and background RMS is 0.003.
The square amplitude plateau is an independent component label; original room
noise or manually reviewed speech boundaries are not asserted.

Acceptance follows the established completed-burst policy: a 100 ms, +7 dB rise
invalidates calibration-based SNR guidance. Stationary, +5 dB, and isolated
10 ms spike controls must retain grading. Both stability and resulting retry/
grading availability are checked. Expected values were not changed to fit output.

## Diagnosis and change

At 16 kHz, the elevated 50 ms windows beginning at 4.575 and 4.600 s measure
approximately +7.24 and +6.99 dB. The window at 4.625 s also includes the return
to quiet and averages about +5.96 dB. Its first disjoint 25 ms hop is still
+6.74 dB, completing three consecutive elevated hops. Previously the window
reset prevented the nominal 100 ms coverage requirement from completing.
The initial hypothesis that a hop dip erased corroboration was not the cause
of these five cases; the recovery window's average was the limiting condition.

Permit coverage to complete on the recovery iteration when its first hop still
completes three consecutive elevated disjoint hops within the existing event
span. Require the same quantized 100 ms window/hop coverage and recovery.
An isolated 10 ms spike still occupies at most two hops. Do not lower the 6 dB
threshold, change the floor or boundary guards, or remove duration corroboration.
The previous sustained-window spike fix remains in place. No additional RMS
calculation is needed; the change uses the hop measurement already computed.
Echo remains experimental and outside grading.

## Before/after evidence

| Diagnostic | Before | After |
| --- | ---: | ---: |
| Missed tonal bursts, 150 development conditions | 5 | 0 |
| Development stationary/subthreshold/spike false alarms, 450 conditions | 0 | 0 |
| Missed bursts, 180 additional parameter-evaluation conditions | 0 | 0 |
| Evaluation control false alarms, 540 conditions | 0 | 0 |
| Recorded-source burst misses, 12 clips | 0 | 0 |
| Recorded-source stationary false alarms, 12 clips | 0 | 0 |

[Development baseline](noise-tone-baseline.json) and
[current results](noise-tone-results.json) contain 600 cases. The pre-change
baseline is reproducible from commit 7977760; its earlier sustained-window
implementation also has identical outcomes for these tonal conditions.
The scoped sustained-spike fix was already present during tonal development.
Its 80-condition acceptance regression and the earlier phase-spike regression
retain zero misses/false alarms after this change.

[Evaluation baseline](noise-tone-evaluation-baseline.json) and
[current results](noise-tone-evaluation-results.json) contain 720 additional
conditions. These were selected after the development fix, before running the
evaluation: 24/88.2 kHz, carriers 27/37/49/61/83/103 Hz, carrier phases
0/pi-quarter/pi-half, and onset shifts 3/7/11/17/23 ms. They exercise different
generated parameters, not held-out microphones, rooms, languages, or people.
Their unchanged success is regression evidence, not an accuracy improvement.

[Worker baseline](noise-tone-worker-baseline.json) and
[current results](noise-tone-worker-results.json) cover twelve existing licensed
recordings at 22.05 kHz. An added 55 Hz background rises +7 dB for 100 ms,
565–665 ms after complete source end. Exact injected sample endpoints and frozen
AI-annotation provenance are recorded. All bursts request `noise_unstable`, and
all stationary controls retain grading before and after. These source clips
are recorded-speech regression evidence; their VAD-relative phases do not
reproduce the generated failure. No recorded-source improvement is claimed.

## Decision, limits, and next work

Keep the recovery-iteration correction: it fixes the independently labeled
five missed events without observed control regressions. The app now withholds
calibration-based grading and supplies the existing noise retry in those cases.
It does not establish representative acoustic thresholds or exact physical
event-duration discrimination. The short 20–90 ms/tapered-transient retry policy
still needs independently supported listening/capture labels. Held-out physical
capture conditions, speech annotation, processing on/off, and repeatability
remain required; the broader backlog item stays open.

## Reproduction

```powershell
$env:NOISE_TONE_BASELINE_REF = '7977760'
node apps/web/scripts/benchmark-noise-tone.mjs
Remove-Item Env:NOISE_TONE_BASELINE_REF
node apps/web/scripts/benchmark-noise-tone.mjs

$env:NOISE_TONE_EVALUATION = '1'
# Also set NOISE_TONE_BASELINE_REF=7977760 for the evaluation baseline.
node apps/web/scripts/benchmark-noise-tone.mjs
Remove-Item Env:NOISE_TONE_EVALUATION

$env:NOISE_GRID_EVALUATION = '1'
$env:NOISE_TONE_WORKER_EVALUATION = '1'
# Also set NOISE_GRID_BASELINE_REF=7977760 for the worker baseline.
node apps/web/scripts/benchmark-human-speech.mjs
Remove-Item Env:NOISE_GRID_EVALUATION
Remove-Item Env:NOISE_TONE_WORKER_EVALUATION
```

The original baseline exits nonzero for its five misses. Current cases are
normal acceptance regressions, not skipped or expected failures. Report writing
is disabled by the unit test. No Groq/API calls or physical capture uploads were
used. Validation results are recorded below after completion.

Offline validation: 556 audio-core/metrics tests passed using a temporary source
alias configuration, 110 web tests passed with coverage, and the production web
build passed. The unit regression uses the 20-condition subset containing all
five original failure cases and stationary/subthreshold/spike controls; the full
600/720 diagnostics were run separately. This keeps ordinary offline tests fast
without removing a known failure condition. Root `npm run test` and `npm run
build` were attempted but npm is unavailable in this runtime. Direct Node
entrypoints ran the available suites/build. Standalone audio-metrics npm
build/test remain skipped under the documented workspace-resolution guardrail.

All 156 existing production-worker fixture variants and all five browser
acceptance tests passed, including PCM recording, result restore, paired
comparison, track release, and desktop/mobile presentation. Chromium uses a
fake microphone; this does not validate physical capture accuracy.
