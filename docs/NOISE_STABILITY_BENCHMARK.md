# Controlled noise-stability benchmark

Run September 28, 2026. [Baseline results](noise-stability-baseline.json) and [current results](noise-stability-results.json).

This artifact supports improving noise detection and app guidance. The historical misses below drove an implemented brief-event fix, evaluated against sustained changes, stationary noise, and boundary residue. Follow the [improvement workflow](BENCHMARK.md#improvement-workflow) for further changes.

This evaluates `analyzeGuidedSamples` with exact generated speech intervals. It isolates the noise estimator from speech detection. The speech interval contains a synthetic 200 Hz tone, not human speech; the supplied `silero` evidence value exercises the production grading path without running the model. These are controlled diagnostic cases, not representative accuracy evidence.

## Protocol

144 cases cross three sample rates (8, 16, 48 kHz), two noise shapes (seeded uniform broadband and a 997 Hz tone), three calibration RMS levels (-70, -50, -30 dBFS), and eight conditions. The seed is 12345. Calibration occupies [0, 2) seconds, generated speech [2, 4), and later noise [4, 5.2), except the short-gap case ending at 4.6 seconds. Noise continues throughout speech. The tone has amplitude RMS × sqrt(2); broadband has amplitude RMS × sqrt(3), with finite-sample RMS variation.

| Condition | Change after speech | Observed assessment | Cases |
| --- | --- | --- | ---: |
| Stationary | None | Stable | 18 |
| Increase | +12 dB from 4.2 s | Unstable at -50/-30; stable at -70 | 18 |
| Decrease | -12 dB from 4.2 s | Unstable at -50/-30; stable at -70 | 18 |
| Short gap | Only 400 ms remains after the boundary guard | Unassessed | 18 |
| Boundary residue | 180 ms of synthetic speech residue after 4 s | Stable | 18 |
| Burst | +18 dB over [4.45, 4.95) | Unstable at all levels | 18 |
| Short burst | +18 dB over [4.5, 4.6) | Baseline: stable despite burst; current: unstable | 18 |
| Near threshold | +5 dB from 4.2 s | Stable | 18 |

All 144 assessments matched the documented behavior. Retry guidance and noise reliability matched each assessment. This is a regression agreement count, not an accuracy percentage: the short-burst cases explicitly demonstrate a missed change. Together with guided and clipping regressions, 161 tests passed.

That historical run predates acceptance assertions. The tests then required short-burst detection and failed in all eighteen cases. The implemented short-window detector now passes those requirements. Both baseline and current JSON retain the observed behavior. Human-recording acceptance also runs in `apps/web/e2e/fixture-acceptance.spec.ts` with explicit injected-mixture SNR and reflection expectations: the four previously missed recordings now detect the burst, with all twelve stationary controls retained.

## Threshold implications

The baseline 200 ms guard excluded the tested 180 ms boundary residue; the current guards are wider as described below. The 500 ms usable-run requirement leaves the shorter gap unassessed. The 6 dB threshold tolerates the tested 5 dB shift. Flooring both levels at -60 dBFS suppresses the -70 to -58 dBFS increase (only a 2 dB comparison change) and the -70 to -82 decrease; it still detects the -70 to -52 burst.

Requiring two changed 250 ms windows missed the tested 100 ms burst. The current detector adds 50 ms windows at 25 ms hops and requires 100 ms of consecutive elevated-window coverage. A first attempt caused false alarms on human speech tails; widening the brief-event boundary guard to 500 ms retained all twelve recording controls. Sustained windows use a 300 ms guard, verified against 280 ms synthetic speech residue. Additional regressions cover burst alignment and isolated 10 ms spikes. The broader annotated human-recording validation and tuning backlog item remains open: these recordings have been used during development and are not held-out accuracy evidence. Stable means no qualifying change detected; shorter events, events inside guards, and floor-suppressed changes can still be missed.

Six separate MS-SNSD reference-component mixtures verify 0/10/20 dB SNR within 1 dB using predefined intervals independent of app-selected speech. Their [manifest and protocol](../apps/web/e2e/fixtures/reference-noise/README.md) state scope and source-license limitations. They isolate the estimator and do not replace worker/VAD or physical-microphone evaluation.

Capture-path verification exposed a cut-off utterance mistaken for a noise burst at recording end. A completed burst now requires recovery to calibration level; an unfinished short event receives an unassessed stability result and low certainty. The sensitive check also excludes the leading voice interval, where missed soft onsets can occur. Regressions cover both cases, and the paired recording/playback/comparison browser flow passes. These protections preserve the positive burst assertions; they do not skip or mark them expected failures.

Final verification September 28, 2026: 176 focused audio tests, 101 web unit tests with coverage, all 12 Playwright browser tests (including 108 production-worker acceptance variants), and the web production build passed. Root `npm run test` and `npm run build` were attempted but Turbo was blocked by Windows Application Control (`spawn UNKNOWN`); direct web and focused audio checks were used without bypassing that policy. The known audio-metrics standalone build/test workspace-resolution limitation was not invoked. Physical microphones, manual speech annotation, and held-out conditions remain pending.

## Reproduce

From `packages/audio-metrics`, with Node and dependencies available:

```powershell
$env:UPDATE_NOISE_BENCHMARK = '1'
node ../../node_modules/vitest/vitest.mjs run test/noiseStabilityBenchmark.test.ts
Remove-Item Env:UPDATE_NOISE_BENCHMARK
```

Without the environment variable, the tests validate behavior without rewriting results. Generated input requires no downloads or external recordings. These results do not evaluate Silero boundaries, the worker, microphone capture, processing, fans, typing, or music. Listening review and human annotations are still required before selecting thresholds for those conditions.
