# Alternatives to physical capture validation

September 29, 2026. All three agreed alternatives now have executable coverage:
additional licensed recordings, retained-component measurement references, and
real browser capture of prerecorded WAV input with processing disabled/enabled.
They reduce the evidence gap; point 3 remains open for the accuracy limitations
below. Physical microphones remain open by user decision.

## Sources and splits

The [fixture manifest](../apps/web/e2e/fixtures/accuracy-expansion/manifest.json)
pins fourteen recordings, eight AMI microphone crops and six FLEURS language
clips (8.97 MB of derived WAV data). The [fixture README](../apps/web/e2e/fixtures/accuracy-expansion/README.md)
contains attribution, CC BY 4.0 licenses, source URLs, original sample ranges,
conversion/cropping rules and annotation provenance. Collection selects inputs
before worker outputs and never sends audio to an external inference service.

| Coverage            | Development                                | Evaluation / supplementary                             |
| ------------------- | ------------------------------------------ | ------------------------------------------------------ |
| AMI meeting         | ES2002a, Edinburgh                         | IS1001a, Idiap                                         |
| AMI participants    | Four meeting participant IDs               | Four disjoint meeting participant IDs                  |
| AMI target excerpts | Two participants, two device channels each | Two participants, two device channels each             |
| Microphone channels | Headset and distant array                  | Headset and distant array                              |
| FLEURS languages    | No tuning set                              | Two clips each: German, French, Latin American Spanish |

AMI's human transcripts have **automatically forced-aligned word times**.
Precision/recall and per-interval boundary errors are diagnostic agreement with
those times, not independently verified boundary accuracy. All-speaker unions
include potential headset bleed and words that may be inaudible on a particular
channel; channel audibility has not been independently verified. A headset
recording is not an isolated clean speaker. Native calibration selection avoids annotated words/vocal sounds with
a guard, but absence of labels is not verified silence.

FLEURS has transcripts without speech-boundary labels or participant/device
identifiers here. These clips test language coverage, not speaker-separated
accuracy. Two twenty-second prefixes are truncated; their full transcripts do
not describe only the retained prefix. They use inserted digital calibration,
not physical room measurements. Evaluation recordings have now been inspected;
future tuning needs new untouched evaluation sources.

## Measurement protocol and results

[Machine-readable results](accuracy-expansion-results.json) record the source
manifest, worker and local model hashes, generated PCM hashes, selected
intervals, diagnostic speech agreement/boundaries, independent sample-enumerated
clipping references, selected-component SNR errors, stability/retry results,
grades and confidence. The worker is the current production Silero/WASM worker.
The estimator is bundled independently from the current production source.

| Conditions                                             | Cases | Reference / result                                                                                                                                              |
| ------------------------------------------------------ | ----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native, −12 dB waveform gain, controlled hard clipping |    42 | Fourteen recordings × three; exact crossing arithmetic and uncertainty handling pass                                                                            |
| Retained recording plus stationary generated noise     |    36 | Six FLEURS sources × white/fan-tone noise × 0/10/20 dB; estimator and selected-component SNR error within 1 dB                                                  |
| Known signal-free tail noise changes                   |    12 | Six sources × +12/−12 dB, 1.25 s changes; estimator and worker detect all changes                                                                               |
| Generated nonspeech negatives                          |     4 | White noise, fan-like tone, typing-like clicks, instrumental tones; three return no speech, instrumental startup produces an incorrect calibration-speech retry |

The 90 recorded-input **measurement gates** pass. These gates check recording
and selected-sample clipping arithmetic, conservative confidence when graded
results contain unselected crossings, stationary-component SNR arithmetic,
estimator stability under explicitly supplied component intervals, and
production-worker detection of introduced tail changes. A selected-sample ratio
oracle does not establish whether selection found all speech. AMI's
alignment-based speech-clipping ratio difference is separately reported as a
diagnostic, rather than turned into an independent truth gate.

The retained signal component includes the source recording's native background.
Component SNR is the ratio of its power to the **added noise component**, measured
on selected samples; it is not ground truth for acoustically clean speech SNR.
The mixture uses source RMS 0.04, deterministic one-second noise periods,
seeded xorshift32 white noise or 120/240 Hz fan-like tones, and no limiter.
Recorded source components and added noise remain separately reconstructible.
The estimator labels the entire source component interval, including its pauses;
those intervals are not invented speech-boundary annotations.

Two stationary-added-noise cases (`fleurs-de_de-10004059102127011984.wav`, white
and fan tone at 20 dB) request noise retry although the supplied-component
estimator is stable. Their source background is not independently decomposed;
these are **unresolved worker disagreements**, not established false alarms.
The original overbroad stationary-worker expectation was corrected because a
constant added component does not establish constant total native background.
The disagreements remain explicit in every report.

The generated instrumental negative is a **confirmed speech-detector false
positive**: no human speech exists by construction, yet the worker selects
0–0.224 s during calibration. Its no-speech acceptance gate remains failed.
The complete 94-case diagnostic command exits nonzero; this is not skipped,
marked expected-failure or counted as a successful detection result. The
separate [four-control report](accuracy-expansion-controls-results.json) records
the same failure. Generated fan/typing/music-like controls do not substitute for
representative real appliance, keyboard or music recordings.

## Browser capture and processing

`e2e/licensed-capture.spec.ts` launches real Chromium virtual microphone devices
using licensed AMI evaluation WAVs. It changes actual getUserMedia constraints,
then checks **actual track settings**, production AudioWorklet PCM capture,
staged room/voice recording, local analysis, saved paired result/WAV, result
reload/playback and ended tracks. It does not mock getSettings, audio samples,
model output or saved results, and does not mute the track during calibration.

Two participants × headset/distant-array × processing off/on provide eight
captures. Two repeats of the native two-second room interval are prepended to allow the app's
three-second room phase and worker startup to precede the retained speech.
The replay modification/hash are recorded. This is a controlled replay,
not an untouched contiguous physical capture.

The processing-on run requests echo cancellation, noise suppression and automatic
gain control together; all must actually report enabled. It verifies low
diagnostic certainty and visible processing advice. Processing-off capture is
aligned to the looping source independently of wall-clock timers; correlation
must exceed 0.85. The paired processing runs must differ in observed waveform
behavior after alignment, not solely metadata. Alignment/gain are diagnostics,
not calibrated DSP measurements: browser resampling, filters and scheduling vary.
AEC enabled does not validate acoustic echo or change its experimental status.

A fifth test applies processing-on constraints to an existing processing-off
track. Chromium keeps suppression disabled on this source; the test verifies
the app does not report the ignored request as enabled processing. The room
sample's actual saved duration, bounded between two and three seconds, is used
for alignment. The target three seconds is not claimed as the captured duration.

Per-run outputs: [participant A headset](browser-capture-A-headset-results.json),
[participant A array](browser-capture-A-distant-array-results.json),
[participant B headset](browser-capture-B-headset-results.json), and
[participant B array](browser-capture-B-distant-array-results.json).
The actual browser version/settings, source/replay/captured hashes, duration,
alignment and full analysis are retained. Capture PCM files remain local ignored
artifacts; no physical ADC, acoustic path, operating-system processing or
Safari/Firefox accuracy is claimed.

## Implementation decision and remaining work

The instrumental control exposed a misleading assertion: the room-check error
and calibration retry title said that speech was detected. They now explain that
**speech-like sounds can trigger the detector**, including music, and suggest
pausing nearby playback. Existing staged-recorder and rendered-retry tests
verify the wording. Detector false positives remain one before and one after;
this improves disclosure and advice, not detection accuracy. Thresholds,
grading, confidence rules and experimental echo are retained.

Do not lower onset thresholds or add a tonal rejection rule based on one
generated startup. AMI timing agreement remains low in several conditions;
inaudible other-speaker words and alignment errors may contribute. Those timings
cannot justify fine-boundary tuning. Actionable work
besides physical capture:

- Independently verify channel audibility, speech boundaries and native background in the AMI
  disagreements and German 20 dB cases; separate missed speech from changing
  source noise before adjusting retry guards.
- Investigate the instrumental calibration startup with independently annotated
  real music/keyboard/appliance negatives and speech-onset controls, then assess
  a detector/decision fix on new untouched evaluation recordings.
- Add participant-known multilingual splits and actual consumer-device/native
  processing recordings. FLEURS identity/device metadata here cannot supply them.
- Validate representative retry tolerances and short-event policy; existing
  exact generated changes do not establish perceptual or physical significance.
- Repeat browser checks in Safari/Firefox and validate actual device/settings
  changes; Chromium's ignored applyConstraints request does not test a successful
  mid-session processing change.

## Reproduction and verification

From `apps/web`, after a production build:

```sh
python scripts/verify-accuracy-expansion.py
node scripts/benchmark-accuracy-expansion.mjs --recorded-only --check
node scripts/benchmark-accuracy-expansion.mjs --controls-only --check
node scripts/benchmark-accuracy-expansion.mjs
npm run test:e2e -- licensed-capture.spec.ts
```

The control-only and complete diagnostic commands currently return exit code 1
for the instrumental failure. `--recorded-only --check` performs the 90 supported
measurement gates without writing a report; it participates in normal fixture
acceptance. `CAPTURE_REPORT=1` writes browser reports (timing-dependent hashes
are evidence of that run, not frozen expectations). Collection is a separate,
explicit network command; verification, benchmarks, tests and builds stay offline
with checked-in assets. Groq inference/API calls: **zero**.

Final verification: all five browser tests pass (eight capture runs plus
the ignored-constraint case), as does the normal 90-case measurement acceptance
test. The offline provenance verifier passes. The FFT alignment helper has
known-offset, looping and silent-input regression checks; the raw-capture
correlation requirement remains 0.85.

Root `npm run build` and `npm run test -- -- --maxWorkers=4` pass: 21 audio-core,
535 audio-metrics and 122 web unit tests. The unbounded initial root test run
hit the existing five-second phase-test timeout under concurrent work; bounding
workers resolves it without changing expectations or timeouts. Workspace
resolution worked in this environment; no required root check was skipped.
