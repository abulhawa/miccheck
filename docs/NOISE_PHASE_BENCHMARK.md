# Short-spike phase sensitivity

September 28, 2026. This advances backlog item 2; representative window,
threshold, and floor tuning remains unfinished.

## Failure and independent acceptance

A 10 ms, +18 dB noise spike could be counted repeatedly by overlapping
50 ms windows, causing an unsupported `noise_unstable` retry and withholding
the grade. Existing spike controls used one onset. The new diagnostic shifts
onsets by 0/5/10/15/20 ms relative to 4.55 s at 16/22.05/44.1/48 kHz.
Exact generated speech is labeled 2–4 s, calibration 0–2 s, and background
RMS is 0.003. Component event endpoints are stored as sample indices.

Acceptance follows the existing spike-versus-burst policy, defined before the
change: isolated 10 ms spikes must not establish instability; completed
100 ms, +7 dB bursts must request retry. Stationary noise and 280 ms boundary
residue must retain grading. This is a duration-policy check, not a claim that
spikes are inaudible or harmless.

## Change and comparison

The brief-event check still requires the existing overlapping-window coverage
and recovery. It additionally requires three consecutive, disjoint hop-sized
intervals above the existing 6 dB threshold. A 100 ms event contains three
full 25 ms hops at any onset phase; a 10 ms spike cannot occupy three hops.
Coverage and corroboration can complete on different iterations, including
the recovery iteration. Sustained windows, guards, floor, and grading policy
are unchanged. This adds one short RMS calculation per event-window hop.

| Diagnostic | Before | After |
| --- | ---: | ---: |
| Missed 100 ms bursts (20 conditions) | 0 | 0 |
| Short-spike false alarms (20 conditions) | 4 | 0 |
| Stationary/boundary false alarms (40 conditions) | 0 | 0 |
| Recorded-source spike retries (12 clips) | 2 | 0 |
| Recorded-source stationary retries (12 clips) | 0 | 0 |

[Estimator baseline](noise-phase-baseline.json) and
[current results](noise-phase-results.json) preserve all 80 conditions.
16 kHz supplied development conditions; other sample grids are evaluation
conditions for the scoped duration guard, using the same generated carrier.
They are not held-out acoustic environments. The
[worker baseline](noise-phase-worker-baseline.json) and
[current worker results](noise-phase-worker-results.json) inject a 10 ms spike
570 ms after each complete source waveform, at 22.05 kHz. The affected clips
were `1320-122617-0003` and `2094-142345-0059`; both now retain their stationary
control grade B instead of withholding grading. Existing speakers are regression
evidence. Frozen AI-assisted annotations remain provisional; the injected tail
event timing is exact and does not depend on disputed speech boundaries.

## Reproduction and limits

```powershell
node apps/web/scripts/benchmark-noise-phase.mjs
$env:NOISE_GRID_EVALUATION = '1'
$env:NOISE_PHASE_EVALUATION = '1'
node apps/web/scripts/benchmark-human-speech.mjs
Remove-Item Env:NOISE_GRID_EVALUATION
Remove-Item Env:NOISE_PHASE_EVALUATION
```

For the worker baseline, also set `NOISE_GRID_BASELINE_REF` to the pre-change
Git revision. The estimator baseline is the saved pre-change run. Both runners
exit unsuccessfully on unmet acceptance; no expected-failure exemptions are used.
The phase diagnostic is also enforced by a normal web unit test, with report
writing disabled. No API calls were used.

This does not establish accuracy for 20–90 ms events, other event envelopes,
missed speech, human speech boundaries, or physical microphones. Keep those
duration/envelope controls in the next annotated expansion before adjusting
acoustic thresholds. Listening review, held-out rooms/devices, processing
on/off, and physical capture validation remain required for the open item.

Verification: 556 audio-core/metrics tests passed using a temporary source-alias
configuration, and 107 web tests passed with coverage. The production web build
passed. Root `npm run test` and `npm run build` were attempted but unavailable:
this runtime has Node and no `npm` executable. Standalone audio-metrics npm
commands remain skipped under the documented workspace-resolution guardrail.
All 156 production-worker fixture variants passed their existing acceptance
requirements. The browser PCM recording, result restore, paired comparison,
and track-release test also passed with Chromium's fake microphone; it does
not establish physical capture accuracy.
