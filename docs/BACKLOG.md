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

Status September 28, 2026: **open**, by user decision. Implemented behavior
passes the available controlled and recorded-fixture acceptance gates. Keep
the remaining validation checkbox open until broader independently supported
annotations and real-microphone validation are completed. The
[acceptance review](NOISE_STABILITY_ACCEPTANCE.md) consolidates evidence,
provisional parameter decisions, and the concrete remaining validation tasks.

A [STARSS22 real-room pilot](../apps/web/e2e/fixtures/starss22/README.md) now
provides four human-annotated physical room recordings (230.1 s), including
domestic noise and music with nearby speech. Two rooms are reserved for
evaluation and two for development; selection uses upstream annotations before
app outputs. That initial pilot did not claim parameter tuning or an improved
detection result; the later continuation improvement is documented below.
The [production-worker comparison](STARSS22_NOISE_BENCHMARK.md) now passes all
twelve frozen recorded-component stationary/+12/−12 dB cases, in both the worker
and annotation-driven estimator. No threshold change is justified. Native
whole-recording retry truth remains unknown; event presence alone is not a
change label. Room21 returns no speech despite upstream speech labels, and
room10 misses substantial speech interiors. Investigate app-length contiguous
excerpts before changing VAD or noise guards. The
[app-length investigation](STARSS22_APP_LENGTH_SPEECH.md) now reproduces both
misses in unmodified 22 s crops: room21 misses 1.4 of 1.7 s of interiors and
room10 misses 4.5 of 5.8 s. Low model probabilities contribute; that investigation
alone did not justify a production parameter change. The 100 ms grid cannot settle
short-transient policy; broader device/processing and native retry validation
remain open.

Speech-continuation follow-up: [confirmed continuation](VAD_CONTINUATION_BENCHMARK.md)
now retains weaker model evidence after the existing minimum speech span is
established, keeping the 0.5 onset gate. On three additional untouched rooms,
missed speech interiors decrease from 10.0 to 8.0 s without added speech in
66.0 s of separate domestic/instrument candidate controls. Normal fixture
acceptance retains the labeled noise-change and stationary cases. This is a
partial app improvement: room21 still requests longer speech and room10's
4.5 s interior miss remains. Room10's noise retry changes to stable/F, but
native retry truth is unknown; do not count that advice change as a verified
improvement. Low-score onsets, noisy speech, playback music/vocals and native
retry validation need stronger independent evidence and further untouched
evaluation conditions. Keep this broader item open.

- [x] Compare calibration noise with sufficiently long later nonspeech windows. Exclude speech boundaries to reduce contamination from breaths, missed speech, and reverberation.
- [x] Distinguish stable noise, unstable noise, and insufficient evidence to assess stability. Continuous speech alone must not imply unstable noise.
- [x] Surface unstable-noise evidence and define how it limits SNR confidence, grading, and retry guidance.
- [x] Address missed brief noise events demonstrated by the controlled benchmark. Check brief level increases separately from sustained increases/decreases and connect detection to confidence and retry guidance; verify stationary noise and speech-boundary residue controls.

The human recordings now participate in `apps/web/e2e/fixture-acceptance.spec.ts`. Its production-worker expectations fail normally when unmet; do not skip, mark expected-failure, or loosen them merely to make the suite green. Investigate the failing condition and improve the implementation, or revise an expectation only with evidence that its ground truth or acceptance requirement was wrong.
- [ ] Validate and tune provisional window lengths, change thresholds, and low-level floor using a broader annotated benchmark.

Low-frequency decrease investigation: 324 exact-label conditions detect all
81 completed 600 ms, −9 dB decreases at 20/55/120 Hz with square, linear and
cosine edges, with zero false alarms in 243 controls. The
[decision](NOISE_LOW_FREQUENCY_DECREASE_BENCHMARK.md) retains current parameters;
this is regression evidence, not a new app improvement. Borderline durations,
near-floor levels, tonal/tapered worker selection on independently annotated
held-out sources, native retry truth and physical capture remain open.

Sustained-decrease follow-up: 600 ms, −9 dB decreases exposed eight missed
changes across window alignments and two missed retries on recorded sources.
Consecutive disjoint-hop duration evidence now resolves these, with no false
alarms in 120 controlled negatives or twelve stationary worker controls. See
the [decrease decision](NOISE_DECREASE_BENCHMARK.md). Acoustic thresholds remain
provisional; held-out physical captures and independent listening remain open.

Tonal recovery follow-up: five missed 55 Hz, 100 ms +7 dB bursts now request
noise retry. Coverage can complete when the recovery window's first hop still
corroborates duration; thresholds and spike guards are retained. All 600
development and 720 additional parameter-evaluation conditions pass, alongside
24 recorded-worker regression cases. See the
[tonal decision](NOISE_TONE_BENCHMARK.md). Short tapered-event policy and
independent physical/listening evidence remain open; this does not complete
representative threshold tuning.

Sustained-window follow-up: an isolated loud 10 ms spike crossing adjacent
250 ms windows caused four estimator false alarms and nine recorded-source
retries. Per-window disjoint-hop corroboration resolves these without losing
the tested 100 ms bursts or stationary controls. See the
[sustained-spike decision](NOISE_SUSTAINED_SPIKE_BENCHMARK.md). The five
55 Hz burst misses identified there are resolved by the tonal recovery
follow-up above. Broader tuning and physical validation remain open.

Envelope follow-up: 250 exact-label conditions retain completed 100 ms burst
detection with square/linear/cosine edges and stationary/subthreshold/spike
controls; all 24 recorded-source worker cases pass. Fifty tapered short-spike
cases remain explicitly unlabeled (30 stable, 20 unstable). The
[envelope decision](NOISE_ENVELOPE_BENCHMARK.md) retains current parameters;
listening/capture evidence must define short-event retry policy before tuning.
This is supporting regression evidence, not a completed app improvement.

Phase-sensitivity follow-up: shifted 10 ms spikes exposed four estimator false
alarms and two unnecessary retries on existing recorded speakers. Brief-event
duration now requires disjoint-hop corroboration as well as overlapping-window
coverage; all 80 controlled conditions pass without losing the 100 ms bursts.
See the [phase decision](NOISE_PHASE_BENCHMARK.md). Intermediate event durations
and envelopes, independent listening, held-out capture conditions, and physical
validation remain open; this duration guard does not complete threshold tuning.

Sample-grid follow-up: a 54-condition exact-label expansion found three missed
100 ms, +7 dB bursts at 22.05 kHz. Brief-event coverage now uses the quantized
window/hop grid, resolving those misses without false alarms in 45 controls;
24/96 kHz evaluation conditions remain correct. See the
[sample-grid decision](NOISE_SAMPLE_GRID_BENCHMARK.md).
This is a rounding correction, not representative threshold tuning. The item
remains open for independent annotation, held-out devices/rooms, and physical
capture validation.

Short-tail follow-up: completed 100 ms bursts are now checked even when a
quiet run is too short for sustained stability assessment. Fifteen exact-label
cases reproduce three misses before the fix and zero afterward, with twelve
negative controls retained. A 36-case production-worker comparison uses frozen
Groq-assisted speech annotations and exact injected-noise labels; existing
recordings are regression evidence, not new evaluation speakers. See
[short-tail decision](NOISE_STABILITY_BENCHMARK.md#short-trailing-pauses). Groq-assisted
review substitutes for human review as authorized; physical capture and broader
threshold tuning remain open.

Partial progress: a 320-condition controlled expansion reproduced eight missed
−70 to −58 dBFS increases and two missed 100 ms bursts at 44.1 kHz. Above-floor
increases now use actual calibration RMS, and brief-window hops round to the
nearest sample. All 320 conditions pass, including sub-floor and stationary
controls; see [results and limits](NOISE_STABILITY_BENCHMARK.md#low-level-increases-and-441-khz).
This remains open for independent human annotation, held-out capture conditions,
and physical-microphone validation; these generated development cases do not
justify representative threshold tuning.

Independent AI-assisted source annotations are now available for all twelve
recordings, using Whisper small.en plus WebRTC and a separate Codex protocol/
candidate review. [Annotation report](AI_SPEECH_ANNOTATIONS.md) includes exact
added-noise event labels and 48 worker comparisons. Only 44.2% of source audio
receives conservative candidate labels; the rest is explicitly uncertain.
Listening review remains pending. Investigate the possible missed opening in
`1320-122617-0012` and noisy-speech disagreements in `5639-40744-0033`,
`260-123440-0007`, and `7729-102255-0012` using the source-time review regions
before changing VAD thresholds or noise guards. These are actionable model
disagreements, not established speech errors or held-out accuracy claims.

Groq Large V3 now corroborates the source recordings through twelve paced,
cached API calls. [Comparison](GROQ_ANNOTATION_COMPARISON.md) shows pooled
transcript WER improving from 2.95% to 2.11%, but timing disagreements remain.
A separate downgrade-only consensus version withdraws unsupported labels;
coverage falls from 44.2% to 34.1%. Preserve both versions and review shifted
opening words and provider timestamps beyond source duration before tuning.
This strengthens provenance/uncertainty handling, not demonstrated boundary
accuracy or an app optimization.

Initial baseline September 28, 2026: the [controlled estimator benchmark](NOISE_STABILITY_BENCHMARK.md) added 144 cases with exact generated intervals across sample rates, noise shapes, levels, changes, bursts, and boundary residue. It demonstrated missed 100 ms bursts and floor-suppressed low-level changes before the following implementation update.

Implementation update: overlapping 50 ms windows now catch the tested 100 ms increases; the sustained 250 ms check remains for increases/decreases. Guards are 300 ms for sustained measurements and 500 ms for the more sensitive brief-event check. The 18 controlled misses now pass, and all twelve human recordings pass the burst and stationary controls. Six [MS-SNSD reference mixtures](../apps/web/e2e/fixtures/reference-noise/README.md) additionally verify independently defined 0/10/20 dB SNR within 1 dB. These fixes do not complete representative threshold tuning or manual human annotation.

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

Deferred by user decision on September 28, 2026: revisit echo after the other mic-checker accuracy work. Keep the experimental label and exclude echo from grading and purchase advice until validation supports changing that policy.

- [ ] Add traceable reference fixtures using measured room impulse responses and/or separate echo/reference components. Distinguish room reflections from loudspeaker acoustic echo cancellation data.
- [ ] Define the quantity the app should identify (echo presence, delay, relative strength, or reverberation) and justified acceptance tolerances; the current score is not a calibrated physical measurement.
- [ ] Measure missed detections and false alarms on held-out rooms, speakers, microphones, reflection delays/strengths, and clean periodic/repeated speech. Use failing acceptance tests to drive estimator improvements.

- [x] Analyze original contiguous audio segments, preserving timing instead of concatenating detected speech across pauses. Define aggregation across segments.
- [ ] Validate against controlled echo conditions and clean speech patterns that can produce similar autocorrelation peaks.
- [ ] Revisit estimator confidence using validation evidence; fixing segment timing alone does not validate echo accuracy.

Acceptance: test pause/segment handling and false positives from ordinary speech; publish limitations. Echo remains explicitly experimental and excluded from grades and purchase advice unless separate validation justifies a future change.

Starting points: `packages/audio-metrics/src/guided.ts`, `packages/audio-metrics/src/metrics/echo.ts`, `packages/audio-metrics/src/metrics/echo.test.ts`.

Contiguous-run echo scores are averaged by eligible sample count; runs of 200 ms or less do not contribute. A regression verifies invariance when pauses between identical speech runs change. This fixes timing semantics, not echo calibration; echo remains experimental and outside grading.
