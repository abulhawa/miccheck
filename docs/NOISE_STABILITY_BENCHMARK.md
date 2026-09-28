# Controlled noise-stability benchmark

Run September 28, 2026. [Machine-readable results](noise-stability-results.json).

This artifact supports improving noise detection and app guidance. The missed 100 ms bursts below are an open implementation target, not successful accuracy results. Follow the [improvement workflow](BENCHMARK.md#improvement-workflow) to compare a proposed fix against these failures, sustained changes, stationary noise, and boundary residue. This run establishes a baseline; it does not claim a noise-stability optimization.

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
| Short burst | +18 dB over [4.5, 4.6) | Stable, despite the injected burst | 18 |
| Near threshold | +5 dB from 4.2 s | Stable | 18 |

All 144 assessments matched the documented behavior. Retry guidance and noise reliability matched each assessment. This is a regression agreement count, not an accuracy percentage: the short-burst cases explicitly demonstrate a missed change. Together with guided and clipping regressions, 161 tests passed.

That historical run predates acceptance assertions. The current test now requires short-burst cases to be detected as unstable, so these cases fail until the implementation meets that requirement. The committed JSON remains a baseline of observed behavior; it is not the desired-result oracle. Human-recording acceptance also runs in `apps/web/e2e/fixture-acceptance.spec.ts` with explicit injected-mixture SNR and reflection expectations.

## Threshold implications

The 200 ms guard excludes the tested 180 ms boundary residue. The 500 ms usable-run requirement leaves the shorter gap unassessed. The 6 dB threshold tolerates the tested 5 dB shift. Flooring both levels at -60 dBFS suppresses the -70 to -58 dBFS increase (only a 2 dB comparison change) and the -70 to -82 decrease; it still detects the -70 to -52 burst.

Requiring two changed 250 ms windows misses the tested 100 ms burst, which lies inside one window. Shorter windows or a one-window trigger could catch it but also increase sensitivity to contamination and missed speech. No production thresholds were changed on this synthetic evidence alone. The broader annotated human-recording validation and tuning backlog item remains open. Stable here means no sustained change detected in the sampled quiet windows; it does not guarantee constant noise or absence of intermittent events.

## Reproduce

From `packages/audio-metrics`, with Node and dependencies available:

```powershell
$env:UPDATE_NOISE_BENCHMARK = '1'
node ../../node_modules/vitest/vitest.mjs run test/noiseStabilityBenchmark.test.ts
Remove-Item Env:UPDATE_NOISE_BENCHMARK
```

Without the environment variable, the tests validate behavior without rewriting results. Generated input requires no downloads or external recordings. These results do not evaluate Silero boundaries, the worker, microphone capture, processing, fans, typing, or music. Listening review and human annotations are still required before selecting thresholds for those conditions.
