# Background-noise stability: implementation acceptance review

Reviewed September 28, 2026. The implemented behavior meets the controlled and
recorded-fixture acceptance gates. Representative acoustic validation remains
unfinished. This review does not establish calibrated thresholds or physical
microphone accuracy.

## Accepted behavior and evidence

| Requirement | Implemented behavior | Evidence |
| --- | --- | --- |
| Compare later nonspeech with calibration | Sustained 250 ms windows, 300 ms boundary guard; decreases additionally require consecutive disjoint-hop duration evidence | [Controlled benchmark](NOISE_STABILITY_BENCHMARK.md), [decrease fix](NOISE_DECREASE_BENCHMARK.md) |
| Catch completed intermittent increases | Overlapping 50 ms windows / 25 ms hops, nominal 100 ms coverage, disjoint-hop corroboration, 500 ms guard, recovery requirement | [Tone recovery](NOISE_TONE_BENCHMARK.md), [short-tail evidence](NOISE_STABILITY_BENCHMARK.md#short-trailing-pauses) |
| Avoid unsupported retries from spikes or residue | Duration corroboration, boundary exclusion, no accumulation across quiet runs | [Phase controls](NOISE_PHASE_BENCHMARK.md), [sustained spike controls](NOISE_SUSTAINED_SPIKE_BENCHMARK.md) |
| Keep stationary noise reliable | Stationary, subthreshold, and below-floor negative controls retain grading with valid calibration | Controlled reports above; production-worker fixture acceptance |
| Distinguish missing evidence from instability | Missing later quiet windows and unfinished brief events are unassessed; continuous speech does not itself force a retry | `guided.test.ts`; [methodology](TECHNICAL_METHODOLOGY.md) |
| Connect instability to app guidance | Unstable noise invalidates calibration-based SNR, withholds grading, lowers certainty, and supplies `noise_unstable` retry guidance | Production-worker reports; web retry-copy tests; browser acceptance |

Parameter decision: retain the provisional >6 dB change threshold, -60 dBFS
floor, and existing windows/guards. Available labeled evidence justified
specific detection and duration corrections. It does not justify broad acoustic
threshold tuning. Stable means no qualifying change detected in usable quiet
windows; it is not proof that the entire recording's noise is stationary.

## Latest validation

September 29 follow-up: [separated short decreases](NOISE_SEPARATED_DECREASE_BENCHMARK.md)
exposed eight controlled false retries and one recorded-source false retry from
nonconsecutive duration accumulation. Routing decreases solely through the
existing consecutive-hop check resolves all nine across 120 paired cases, with
no lost positives. The 140 sustained-decrease, 324 low-frequency/tapered-decrease
and 600 tonal regression conditions retain zero misses and zero false alarms.
The broader evidence requirements below remain open.

The sustained-decrease improvement resolves eight controlled misses in 140
conditions and two missed retries in twelve recorded-source pairs. There are
zero false alarms in the 120 controlled negatives and twelve stationary worker
controls. Web unit tests (111), audio-core tests (21), production web build,
human-fixture acceptance, and the PCM recording/restore/comparison browser flow
passed. The browser microphone is simulated.

Root npm checks could not launch because npm is absent; direct Node entrypoints
ran the web/core checks. Standalone audio-metrics build/test remain skipped under
the repository's documented workspace-resolution limitation. Existing source
annotations and cached Groq outputs were reused; no new API calls were made.

## Evidence still required

The [STARSS22 pilot](../apps/web/e2e/fixtures/starss22/README.md) now supplies
four externally recorded, human-annotated room excerpts, with two rooms reserved
for evaluation. Selection and provenance checks are complete. The
[worker comparison](STARSS22_NOISE_BENCHMARK.md) passes twelve frozen
recorded-component retry/stationary cases; native full-recording retry truth
remains unknown and speech-selection disagreements remain actionable. This broadens physical room
evidence without requiring the user's microphone, but does not establish browser
processing behavior or consumer-device coverage.

1. Independently supported labels for 20–90 ms events and tapered transients.
   The [envelope investigation](NOISE_ENVELOPE_BENCHMARK.md) contains fifty
   explicitly unlabeled cases; their 30 stable / 20 unstable split is not an
   established false-alarm count. Define whether such an event requires retry
   or only a visible observation before tuning duration policy.
2. Held-out speakers and capture conditions, including rooms, microphones,
   fans, typing, music, quiet speech, and browser processing on/off. Freeze
   source/event annotations and development/evaluation splits before selecting
   parameters. Existing audiobook sources have already informed development.
3. Physical capture through the actual app, with traceable reference noise and
   consent/license records. Synthetic injection and a fake browser microphone
   do not establish physical capture accuracy.
4. Evaluate low-frequency/tapered decreases and borderline durations, the
   low-level floor, and speech-boundary errors. Report misses, false retries,
   SNR error, and guidance before/after any proposed parameter change. Preserve
   uncertainty in model-assisted labels and investigate source-timing
   disagreements before using them to change VAD or boundary guards.

These are concrete remaining validation tasks, not reasons to alter working
thresholds without ground truth. The broader annotated-tuning requirement is
not satisfied by this implementation acceptance review.
