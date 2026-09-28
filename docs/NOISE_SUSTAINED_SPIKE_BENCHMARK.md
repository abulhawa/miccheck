# Sustained-window spike false alarms

September 28, 2026. Scoped implementation advance for backlog item 2;
representative threshold tuning remains open.

## Failure and independent acceptance

An isolated 10 ms, +30 dB spike can elevate two neighboring 250 ms windows
when it crosses their boundary. The app then reports unstable background noise,
withholds the grade, and requests another take despite the existing policy that
an isolated 10 ms event cannot establish noise instability. The earlier brief
window duration guard did not constrain the sustained path. These fixtures use
RMS 0.003 background; spike peak is approximately 0.095, below clipping.

Exact generated speech is 2–4 s, calibration 0–2 s. Five onset phases starting
at 4.535 s cover both sides of the sustained boundary at 4.55 s. Acceptance is
specified independently from the estimator: isolated spikes, stationary noise,
and boundary residue retain grading; completed 100 ms, +7 dB bursts request
`noise_unstable`. This is the existing duration policy, not an audibility claim.

## Scoped change

Each sustained 250 ms candidate above the existing 6 dB change threshold now
also needs three consecutive disjoint 25 ms hops above that same threshold.
The corroboration belongs to that candidate window: evidence from speech
residue elsewhere in a quiet run must not validate an unrelated spike. An
isolated 10 ms spike overlaps at most two hops and cannot meet this requirement.
Two corroborated sustained windows are still required. The hop uses the existing
sample-grid quantization. Brief-event behavior, boundaries, floor, clipping,
SNR computation, and grading rules are unchanged; echo stays outside grading.
Additional short RMS calculations run only for elevated sustained candidates.

## Before/after evidence

| Outcome | Before, 7977760 | After |
| --- | ---: | ---: |
| Spike false alarms, 20 exact-label conditions | 4 | 0 |
| Missed 100 ms bursts, 20 conditions | 0 | 0 |
| Stationary/boundary false alarms, 40 conditions | 0 | 0 |
| Recorded-source spike retries, 12 clips | 9 | 0 |
| Recorded-source stationary false alarms, 12 clips | 0 | 0 |

[Estimator baseline](noise-sustained-spike-baseline.json) and
[current results](noise-sustained-spike-results.json) preserve all 80 conditions.
16 kHz is development evidence; 22.05/44.1/48 kHz evaluate sample-grid behavior
of the same carrier. These are not independently held-out acoustic captures.
The normal web acceptance test enforces all labeled conditions.

[Worker baseline](noise-sustained-spike-worker-baseline.json) and
[current results](noise-sustained-spike-worker-results.json) cover 24 cases on
existing twelve licensed recordings. The stationary control supplies the VAD
boundary solely to position the exact injected 10 ms spike 5 ms before a later
sustained-window boundary, beyond source end +550 ms. The report records spike
and boundary sample indices. This intentionally targeted reproducer is regression
evidence, not an independent representative benchmark. At 22.05 kHz the spike
rounds to 221 samples. Frozen AI candidate labels retain source provenance but
are not used to claim human boundary accuracy. All nine affected clips now keep
the stationary control's grade instead of receiving a noise retry.

## Remaining failure: tonal bursts

A separate [600-condition sine-carrier diagnostic](noise-tone-results.json)
retains five missed 100 ms, +7 dB bursts at 55 Hz, at the 15 ms phase, across
16/22.05/44.1/48/96 kHz. [Baseline](noise-tone-baseline.json) has the same five
misses and zero false alarms; this fix neither improves nor worsens them.
The independently generated signal has a constant-amplitude plateau, but RMS
in a partial-period 25 ms hop can dip below the threshold. The existing brief
path requires consecutive elevated hops and can reject the otherwise qualifying
burst. This remains a failing improvement target; its runner exits nonzero.
It is not relabeled, skipped, or placed in an expected-failure test.

Next action: improve duration corroboration for low-frequency bursts while
retaining the isolated-spike and boundary-residue controls. Evaluate additional
carrier phases/frequencies and recorded speech before changing the brief guard.
Do not lower acoustic thresholds to match unsupported short-transient labels.
Listening review, independent capture conditions, physical-microphone validation,
and the short tapered-event policy remain open. Backlog item 2 stays unchecked.

## Reproduction

```powershell
# Saved pre-change estimator implementation, exits nonzero on its four failures.
$env:NOISE_SPIKE_BASELINE_REF = '7977760'
node apps/web/scripts/benchmark-noise-sustained-spike.mjs
Remove-Item Env:NOISE_SPIKE_BASELINE_REF
node apps/web/scripts/benchmark-noise-sustained-spike.mjs

$env:NOISE_GRID_EVALUATION = '1'
$env:NOISE_SUSTAINED_SPIKE_EVALUATION = '1'
# Also set NOISE_GRID_BASELINE_REF=7977760 to reproduce the worker baseline.
node apps/web/scripts/benchmark-human-speech.mjs
Remove-Item Env:NOISE_GRID_EVALUATION
Remove-Item Env:NOISE_SUSTAINED_SPIKE_EVALUATION

# Known failing tonal-burst target, five misses remain.
node apps/web/scripts/benchmark-noise-tone.mjs
```

No API calls or physical microphone uploads were used. Offline validation:
556 audio-core/metrics tests passed using a temporary source alias configuration;
109 web tests passed with coverage; production web build passed. Root
`npm run test` and `npm run build` were attempted but npm is unavailable in this
runtime. Direct Node entrypoints ran the available checks. Standalone metrics
npm build/test commands remain skipped under the workspace-resolution guardrail.

Production-worker fixture acceptance also passed all 156 existing variants.
All five browser acceptance tests passed, including PCM recording, result
restore, paired comparison, track release, and desktop/mobile presentation.
Chromium uses a fake microphone; these checks do not establish physical capture
accuracy. The new spike regression additionally asserts the retry reason and
whether grading is available, beyond the stability label alone.

Subsequent follow-up: the [tonal recovery correction](NOISE_TONE_BENCHMARK.md)
resolves the five missed bursts described above. The earlier five-miss state is
preserved in the tonal baseline; `noise-tone-results.json` now reports the fixed
implementation. The short-transient policy and physical validation remain open.
