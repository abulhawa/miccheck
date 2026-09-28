# Noise-stability sample-grid decision

September 28, 2026: a 100 ms, +7 dB rise at 22.05 kHz could receive
`stable` evidence and retain a calibration-based grade. Three elevated 50 ms
windows at rounded 25 ms hops cover 2,204 samples, while the old literal
100 ms comparison required 2,205. Stronger bursts hid this rounding failure
because partially overlapping edge windows also exceeded the level threshold.
This follows the [app-improvement workflow](BENCHMARK.md#improvement-workflow).

`test/noiseSampleGrid.test.ts` freezes speech [2, 4) s and burst [4.5, 4.6) s,
with calibration RMS .003 and a 1.2 s tail. Development uses 22.05 kHz and
seed 91; evaluation uses 24/96 kHz and seed 812. All three rates cross square,
997 Hz tone, and seeded broadband noise with six conditions: +7 dB burst,
stationary, 10 ms +18 dB spike, unfinished +18 dB rise, 280 ms boundary
residue, and sustained +5 dB shift. Exact component intervals define acceptance
independently of the detector. These are generated estimator conditions,
not independent human annotations or held-out microphones.

The [baseline](noise-grid-baseline.json) misses all three development bursts;
the six evaluation bursts already pass. Neither split produces an unsupported
unstable assessment among its 15/30 controls. The
[current results](noise-grid-results.json) resolve the three misses and retain
all evaluation behavior: zero misses among nine bursts, zero false alarms
among 45 controls. Coverage now requires one quantized event window plus two
quantized hops. At 22.05 kHz this is 99.955 ms rather than 100 ms; integer-grid
rates retain exactly 100 ms. Level threshold, floor, guards, recovery rule,
and sustained assessment stay unchanged. This corrects rounding rather than
selecting new acoustic thresholds. Overlapping-window coverage is not a
physical measurement of event duration.

The recorded-speech comparison uses twelve existing licensed clips decoded
at 22.05 kHz, with alternating-sign square noise at RMS .003 throughout and
an optional +7 dB burst 500-600 ms after the entire source waveform. A one-second
tail provides recovery. Frozen Groq-assisted consensus source labels and their
hash are preserved in both reports; uncertain intervals remain excluded.
The [worker baseline](noise-grid-worker-baseline.json) substitutes only
`guided.ts` from commit `ca475aa5b81608f5cd979f4f2ba0d1140af3adad`
into the current production-worker bundle. It misses all twelve bursts,
retaining grades B/C. The [current worker](noise-grid-worker-results.json)
detects all twelve, withholds the grade, and requests `noise_unstable`.
Both versions retain grading for all twelve stationary controls. Speech
segments and source candidate agreement are unchanged. This is a demonstrated
worker/guidance improvement on development speakers, not new speech accuracy
or representative capture evidence. The square waveform is a diagnostic
stress input, not a claim about typical room noise.

Decision: retain the provisional acoustic parameters and correct their
sample-grid representation. Backlog item 2 remains open. Arbitrary burst
alignment, modest rises near 6 dB, realistic fans/typing/music, physical
microphones, processing on/off, and independent speakers/capture conditions
still need evidence before threshold tuning. No Groq calls or new uploads were
needed; existing cached annotations were reused.

Reproduce estimator evidence from `packages/audio-metrics`:

```powershell
$env:NOISE_GRID_REPORT = 'noise-grid-results.json'
node ../../node_modules/vitest/vitest.mjs run test/noiseSampleGrid.test.ts
Remove-Item Env:NOISE_GRID_REPORT
```

Reproduce the recorded-speech comparison from the repository root:

```powershell
$env:NOISE_GRID_EVALUATION = '1'
node apps/web/scripts/benchmark-human-speech.mjs
$env:NOISE_GRID_BASELINE_REF = 'ca475aa5b81608f5cd979f4f2ba0d1140af3adad'
node apps/web/scripts/benchmark-human-speech.mjs
Remove-Item Env:NOISE_GRID_BASELINE_REF
Remove-Item Env:NOISE_GRID_EVALUATION
```

The historical worker baseline exits nonzero for its twelve unmet acceptance
requirements. Current acceptance remains mandatory.

Verification: 535 audio-metrics tests, 21 audio-core tests, 106 web unit tests
with coverage, the web production build, and all 12 Playwright tests passed.
Browser checks include the 156-variant fixture acceptance and complete
fake-microphone recording/playback/comparison flow. The separate 24-case
sample-grid worker run passes. Root `npm run test` and `npm run build` were
attempted but could not start because npm is absent from PATH; direct Node
entrypoints supplied the checks above. Standalone audio-metrics npm commands
were skipped per the documented workspace-resolution limitation. No physical
microphone or independently held-out human evaluation is claimed.
