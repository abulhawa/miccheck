# Low-frequency and tapered noise decreases

September 28, 2026. Supporting investigation for backlog item 2; no production
parameter change and no claim of a completed app improvement.

The user-visible risk is a missed noise retry when a low-frequency background
sound fades down after calibration, leaving calibration-based SNR unsupported.
The focused question is whether the existing decrease-duration correction also
handles low-frequency carriers and gradual edges. Desired behavior follows the
existing provisional policy, independently of estimator output: a 600 ms plateau
at -9 dB should invalidate noise reliability and request `noise_unstable`;
stationary, -5 dB and 100 ms plateau dips should preserve grading. Short-dip
ramps extend the event to at most 300 ms, still below the sustained 500 ms gate.
This does not establish a perceptual policy for borderline durations.

## Protocol and result

The reproducible generator defines exact sample intervals before comparison.
Noise RMS is -40 dBFS, calibration lasts 2 s, supplied speech spans 2–4 s, and
capture lasts 6 s. Carriers are 20, 55 and 120 Hz; onset offsets are 0, 37 and
113 ms. Square edges and linear/cosine 100 ms ramps surround a 600 ms plateau
(or 100 ms for short-dip controls). Ramp gain interpolates in dB.
Development uses 16 kHz; separate sample-grid evaluation uses 22.05/48 kHz.
This split is controlled numerical coverage, not held-out speakers or devices.
No parameters were selected or changed using either split.

| Split | Conditions | Missed decreases | Control false alarms |
| --- | ---: | ---: | ---: |
| Development | 108 | 0 / 27 | 0 / 81 |
| Evaluation | 216 | 0 / 54 | 0 / 162 |

[Machine-readable results](noise-low-frequency-decrease-results.json) include
exact component intervals, speech interval, source hash, stability, retry reason,
state and grade. Each positive returns insufficient evidence with a noise retry;
each negative retains grading. These are current-behavior regressions. There is
no before/after gain because no fix was justified.

## Decision and remaining work

Retain current acoustic thresholds, windows and decrease-duration rule for these
conditions. Adding lower thresholds or shorter duration gates has no demonstrated
benefit here. This resolves the narrow uncertainty about completed 600 ms tonal
decreases with the tested ramps, not broader annotated tuning.

The existing 24 recorded-source worker decrease/stationary cases are rerun as
separate regression evidence. They use broadband generated components and
existing audiobook speakers; they do not validate tonal/tapered selection through
Silero. A further targeted worker corpus should use independently annotated
held-out room components with these envelopes, and measure speech exclusion and
native retry truth. Borderline durations, levels near the floor, real device
processing and actual app microphone capture remain actionable. No new API
calls, uploads or physical microphone requests are needed for this investigation.

## Reproduction

```powershell
node apps/web/scripts/benchmark-noise-low-frequency-decrease.mjs
$env:NOISE_GRID_EVALUATION = '1'
$env:NOISE_DECREASE_WORKER_EVALUATION = '1'
node apps/web/scripts/benchmark-human-speech.mjs
Remove-Item Env:NOISE_GRID_EVALUATION, Env:NOISE_DECREASE_WORKER_EVALUATION
```

The focused script exits nonzero on missed retries, false alarms, or lost grading
in its controls. Web unit tests (113), audio-core tests (21) and the web production
build pass through direct Node entrypoints. Root `npm run test` and `npm run build`
were attempted but npm is absent. Standalone audio-metrics build/test remain
skipped under the documented workspace-resolution limitation. No production or
UI behavior changed, so no additional capture/UI validation is claimed.
