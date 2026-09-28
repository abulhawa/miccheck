# Noise-event envelopes: retain current parameters

September 28, 2026. Supporting investigation for the open noise-stability
window/threshold/floor item; no production optimization or completed tuning claim.

## User-visible risk and independent acceptance

The phase duration guard could miss a meaningful burst with gradual edges,
leaving calibration-based SNR grading available when background noise changed.
The smallest labeled case has a 100 ms plateau at +7 dB over calibration,
with either square edges or 25 ms linear/cosine amplitude ramps on each side.
The plateau alone satisfies the existing completed 100 ms burst policy.
Stationary and +5 dB controls must remain stable; isolated square 10 ms spikes
retain the previously established negative-control policy. These expectations
were specified before running the estimator.

Tapered 10 ms plateaus have 60 ms total support. They do not share the exact
10 ms square-spike label. Their desired treatment remains unspecified; all
50 are explicitly exploratory and excluded from missed-event/false-alarm counts.
An amplitude envelope is applied to a square carrier of RMS 0.003. Speech is
exactly labeled 2–4 s; calibration is 0–2 s. Per-case sample endpoints, plateau
length, and ramp length are saved in [estimator results](noise-envelope-results.json).

## Evaluation and implementation decision

The 16 kHz cases are development diagnostics. 22.05/44.1/48/96 kHz conditions
check additional sample grids, using the same generated carrier and labels;
they are not independent rooms/devices or representative acoustic evaluation.
All five onset phases (0/5/10/15/20 ms) are tested for each rate and envelope.

| Outcome | Current estimator at e43fd36 |
| --- | ---: |
| Missed completed bursts, 75 labeled cases | 0 |
| Stationary/subthreshold false alarms, 150 labeled cases | 0 |
| Square 10 ms spike false alarms, 25 labeled cases | 0 |
| Exploratory tapered spikes | 30 stable, 20 unstable |
| Recorded-source tapered burst misses, 12 clips | 0 |
| Recorded-source stationary false alarms, 12 clips | 0 |

The [24 production-worker cases](noise-envelope-worker-results.json) use all
existing twelve licensed recordings at 22.05 kHz with a linear-ramp event
550–700 ms after source end; the +7 dB plateau is 575–675 ms after source end.
Frozen consensus AI annotations and source checksums retain provenance;
source-boundary accuracy remains unverified. The burst requests `noise_unstable`
and withholds grading for every clip; each stationary control keeps its grade.
This is recorded-speech regression evidence, not new held-out speakers.

Retain current windows, threshold, floor, and duration guard. No independently
labeled failure in this expansion supports a production change. The before/after
behavior is therefore identical: no estimator code changed and no improvement
in error or advice is claimed. The benchmark mode and acceptance regression
preserve the tested behavior. Capture/UI behavior is unaffected, so no new
physical capture or UI-path result is claimed.

## Remaining actionable work

Before changing short-event duration rules, obtain listening/capture labels for
20–90 ms events and tapered transient envelopes. In particular, decide when a
short elevated event invalidates calibration SNR versus merely deserving a
visible event observation. The 30/20 exploratory split exposes a concrete
uncertainty, not proven false alarms. A threshold change to force uniform
results would tune to unsupported labels. Independent annotation, held-out
rooms/devices, processing on/off, and physical capture remain necessary.
The broader backlog checkbox stays open.

## Reproduction and validation

```powershell
node apps/web/scripts/benchmark-noise-envelope.mjs
$env:NOISE_GRID_EVALUATION = '1'
$env:NOISE_ENVELOPE_EVALUATION = '1'
node apps/web/scripts/benchmark-human-speech.mjs
Remove-Item Env:NOISE_GRID_EVALUATION
Remove-Item Env:NOISE_ENVELOPE_EVALUATION
```

Both runners fail on unmet labeled acceptance. Exploratory cases have explicit
null expectations rather than expected-failure exemptions. The web regression
runs the controlled check without rewriting reports. No Groq/API calls were used.

Validation: 107 existing web tests passed with coverage; the new acceptance test
also passed. The production web build passed through direct Node entrypoints.
Root `npm run test` and `npm run build` were attempted but npm is unavailable in
this runtime. Standalone audio-metrics npm test/build commands remain skipped
under the repository workspace-resolution guardrail. This work adds supporting
evidence and leaves the app improvement unfinished pending actionable ground truth.
