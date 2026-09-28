# Measurement accuracy backlog

Added September 28, 2026. Checkboxes track implemented work; remaining accuracy and real-world validation work is pending.

The main aim is to improve the mic checker: more accurate measurements, fewer misleading grades, and more useful advice. Benchmarks and recording artifacts are evidence for identifying, implementing, and verifying app improvements. More cases or passing tests alone do not complete an improvement task.

Work in this order: clipping invariance, noise-stability fixes informed by focused evidence, repeatability and threshold tuning, then broader coverage driven by unresolved app weaknesses. Keep echo outside grading throughout. Use the [benchmark improvement workflow](BENCHMARK.md#improvement-workflow) for each change.

## 1. Make clipping independent of pauses — high priority

- [x] Report speech-only clipping and use it for grading and clipping advice. Retain recording-wide clipped duration so events outside detected speech remain visible.
- [x] Define clipped-event grouping and duration explicitly. Describe threshold crossings as an indicator of clipping, not proof of distortion.
- [x] Update metric types, exports, UI labels, and regression coverage for scoring/recommendation invariance together.

Implemented duration is the sum of near-full-scale sample durations across the entire recording, including calibration. Events now count maximal consecutive near-full-scale runs in recording PCM, with no gap merging or minimum length; see [methodology](TECHNICAL_METHODOLOGY.md) for the exact definition and capture-join limitation. The [current benchmark](HUMAN_SPEECH_BENCHMARK.md) verifies unchanged speech clipping, total clipped duration, and grade for all twelve appended-silence pairs.

Acceptance: appending nonspeech silence to the same clipped speech does not reduce speech clipping or improve its clipping grade/advice; recording-wide clipped duration remains unchanged. Include regressions for clipping outside detected speech and recordings with no speech.

Starting points: `packages/audio-metrics/src/guided.ts`, `packages/audio-metrics/src/metrics/clipping.ts`, `apps/web/lib/metricFormatting.ts`.

## 2. Assess background-noise stability — high priority

- [x] Compare calibration noise with sufficiently long later nonspeech windows. Exclude speech boundaries to reduce contamination from breaths, missed speech, and reverberation.
- [x] Distinguish stable noise, unstable noise, and insufficient evidence to assess stability. Continuous speech alone must not imply unstable noise.
- [x] Surface unstable-noise evidence and define how it limits SNR confidence, grading, and retry guidance.
- [ ] Address missed brief noise events demonstrated by the controlled benchmark. Distinguish intermittent events from sustained changes and connect the result to confidence or guidance; verify against stationary noise and speech-boundary residue before changing grading or retry behavior.
- [ ] Validate and tune provisional window lengths, change thresholds, and low-level floor using a broader annotated benchmark.

Progress September 28, 2026: the [controlled estimator benchmark](NOISE_STABILITY_BENCHMARK.md) adds 144 cases with exact generated intervals across sample rates, noise shapes, levels, changes, bursts, and boundary residue. It confirms the current behavior and demonstrates missed 100 ms bursts and floor-suppressed low-level changes. Human annotation and representative threshold tuning remain pending; production thresholds are unchanged.

Acceptance: controlled stationary noise remains reliable; meaningful increases/decreases and intermittent noise are flagged; short gaps and speech-boundary contamination do not cause unsupported stability claims. Missing later quiet windows receive an explicit unknown assessment.

Starting points: `packages/audio-metrics/src/guided.ts`, `packages/audio-metrics/src/guided.test.ts`, existing evidence/retry UI in `apps/web`.

## 3. Build an accuracy benchmark — high priority, staged

Progress September 28, 2026: collected twelve human speech clips from six additional speakers and completed [84 production-worker diagnostic cases](HUMAN_SPEECH_BENCHMARK.md). The baseline reproduced clipping dilution and missing noise-stability evidence; the current run verifies both fixes. This does not complete the accuracy benchmark: listening review, speech annotation, SNR ground truth, and wider capture coverage remain pending.

- [ ] First add annotated speech and known signal/noise mixtures covering clipping and noise stability, with reproducible expected measurements.
- [ ] Expand to consented/licensed recordings across speakers, languages, devices, rooms, quiet speech, fans, typing, music, and browser processing on/off.
- [ ] Separate tuning and evaluation data by speaker and capture conditions; record provenance, licenses, annotations, and reproducible generation settings.
- [ ] Report speech precision/recall, boundary error, SNR error against known mixtures, clipping accuracy, and noise-stability detection results.
- [ ] Evaluate individual estimators, the production worker, and the complete real capture-and-analysis path. Keep synthetic smoke tests distinct from representative accuracy evidence.

Acceptance: publish a reproducible report with per-condition results and limitations, extending the existing benchmark documentation. Use results to justify thresholds; two recordings from one speaker cannot establish general accuracy.

Each benchmark expansion must target a specific measurement, grading, confidence, or advice weakness and record the resulting implementation decision. Report before/after failures and false alarms on evaluation conditions; matching existing behavior is regression coverage, not evidence of improvement. If a fix is deferred, retain an actionable backlog item and state the missing evidence.

Starting points: `docs/BENCHMARK.md`, `apps/web/e2e/real-speech.spec.ts`, `apps/web/e2e/fixtures/README.md`, `packages/audio-metrics/test`.

## 4. Establish repeatability and meaningful comparisons — follows initial benchmark

- [ ] Use a consistent spoken passage and repeated takes under unchanged conditions to measure within-setup variability.
- [ ] Evaluate speech-duration requirements against measured reliability instead of assuming that a longer recording guarantees accuracy.
- [ ] Tune minimum-evidence gates and displayed precision using results. Decimal formatting alone does not establish measurement accuracy.
- [ ] Show an empirically supported uncertainty range or "no clear change" when before/after differences are smaller than measured variability. Define which conditions the comparison applies to.

Acceptance: document the repeatability protocol, sample size, observed variability, and resulting comparison thresholds. Do not invent uncertainty ranges before collecting evidence.

Starting points: `packages/audio-metrics/src/guided.ts`, `apps/web/lib/metricFormatting.ts`, existing before/after comparison components in `apps/web`.

## 5. Improve and validate experimental echo — lower priority

- [ ] Analyze original contiguous audio segments, preserving timing instead of concatenating detected speech across pauses. Define aggregation across segments.
- [ ] Validate against controlled echo conditions and clean speech patterns that can produce similar autocorrelation peaks.
- [ ] Revisit estimator confidence using validation evidence; fixing segment timing alone does not validate echo accuracy.

Acceptance: test pause/segment handling and false positives from ordinary speech; publish limitations. Echo remains explicitly experimental and excluded from grades and purchase advice unless separate validation justifies a future change.

Starting points: `packages/audio-metrics/src/guided.ts`, `packages/audio-metrics/src/metrics/echo.ts`, `packages/audio-metrics/src/metrics/echo.test.ts`.
