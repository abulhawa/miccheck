# Sustained noise decreases across window alignments

September 28, 2026. This is partial progress on backlog item 2, not completion
of representative threshold tuning or physical capture validation.

## Failure and decision

A 600 ms, 9 dB decrease in background noise could leave stability marked
stable and a grade displayed using the louder calibration noise. Two fixed
250 ms windows must exceed the 6 dB change threshold. When the decrease begins
between their boundaries, both edge windows can average enough unchanged noise
to leave only one qualifying window. The intended behavior is a noise retry
for a sustained change independently labeled in the injected noise component.

Retain the provisional 6 dB threshold, -60 dBFS floor, and 300 ms sustained
speech-boundary guard. Supplement the existing check with consecutive disjoint
25 ms hops whose noise level is more than 6 dB below calibration for at least
two quantized 250 ms windows. Reset duration on every nonqualifying hop and
every quiet-run boundary. This prevents separated dips from accumulating.
It supplements decrease detection only; brief-increase detection is unchanged.
No threshold was selected by fitting the evaluation conditions.

## Before and after

Baseline guided implementation: `2b859fccfc04ccaa7829aa08ad968b63b93e8fc1`.
Exact generated intervals and desired results are defined in the benchmark
script before estimator comparison. The development split uses 16 kHz square
noise; evaluation uses 22.05/44.1/48 kHz, 997 Hz tonal noise. Each uses five
onset shifts (0/50/100/150/200 ms), 2 s calibration, speech at 2–4 s, and
noise decreases starting at 4.8 s plus the shift. Baseline noise RMS is .01;
the below-floor control uses .0003. Labels concern the added noise component,
not independent speech boundary accuracy.

| Conditions | Count | Baseline misses | Current misses | Baseline/current control false alarms |
| --- | ---: | ---: | ---: | ---: |
| Development decreases | 5 | 2 | 0 | — |
| Evaluation decreases | 15 | 6 | 0 | — |
| Development controls | 30 | — | — | 0 / 0 |
| Evaluation controls | 90 | — | — | 0 / 0 |

Controls include stationary noise, 5 dB decreases, 100 ms dips, separated
250 ms dips, decreases entirely below the floor, and 280 ms boundary changes.
All checks assert stability plus retry reason and whether grading is withheld.
Machine-readable [baseline](noise-decrease-baseline.json) and
[current results](noise-decrease-results.json) preserve individual conditions.

The actual production worker and Silero additionally analyze all twelve
checksummed human fixtures at 22.05 kHz with a 2 s tail. A 600 ms decrease is
injected 800 ms after the entire source ends, keeping its ground truth clear
without assuming human speech boundaries. The stationary paired condition
uses identical source and calibration noise. Frozen Groq-assisted consensus
annotations remain source candidates; the worker report records their hash.
No new API calls were needed.

| Recorded-source worker conditions | Count | Baseline | Current |
| --- | ---: | ---: | ---: |
| Missed decrease / missing noise retry | 12 | 2 | 0 |
| Stationary false retry | 12 | 0 | 0 |

`1320-122617-0003.flac` and `3575-170457-0020.flac` previously displayed grade
C; both now withhold grading and return `noise_unstable` for the decrease.
The other ten already requested retry. See [worker baseline](noise-decrease-worker-baseline.json)
and [worker results](noise-decrease-worker-results.json). In this inherited
benchmark mode, `grid-burst` names the decrease scenario.

## Reproduce and limits

From the repository root, run `node apps/web/scripts/benchmark-noise-decrease.mjs`.
Set `NOISE_DECREASE_BASELINE_REF` to the baseline commit above and
`NOISE_DECREASE_REPORT=noise-decrease-baseline.json` to reproduce baseline
failures. From the root, set `NOISE_GRID_EVALUATION=1` and
`NOISE_DECREASE_WORKER_EVALUATION=1`, then run
`node apps/web/scripts/benchmark-human-speech.mjs`. Add
`NOISE_GRID_BASELINE_REF` with that commit for the worker baseline. Unset these
variables afterward. Baselines deliberately fail their acceptance checks.

The additional duration check requires 500 ms of qualifying hop measurements,
not an exact physical event-duration estimate. Borderline durations, tapered
decreases, low-frequency noise, rooms, devices, processing, and listening
validation remain open. Existing recorded speakers are regression sources;
new generated sample grids/carriers are evaluation conditions, not new capture
devices or representative acoustic evidence. Grading still uses calibration
noise when a change remains undetected, including changes during speech or
inside boundary guards. Do not close the broader tuning backlog item.

Validation: web unit tests and coverage (111 tests), audio-core tests (21),
and the production Next.js build passed via direct Node entrypoints. Root
`npm run test` and `npm run build` could not execute because npm is absent
from this runtime. The standalone audio-metrics build/test were skipped under
the documented workspace-resolution limitation; the web suite exercises the
new estimator benchmark through source bundling.
The expanded benchmark's focused web regression also passed after adding the
separated-dip and below-floor controls. Playwright passed the production-worker
human-fixture acceptance gate and the PCM recording/restore/comparison flow
(two tests). The capture flow uses a fake microphone; it is browser integration
evidence, not physical-microphone validation. `git diff --check` passed.
