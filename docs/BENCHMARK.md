# Synthetic speech-detection benchmark

The purpose of these benchmarks and recording artifacts is to improve the mic checker. Use them to find measurement and advice failures, make targeted production changes, and demonstrate better behavior without introducing false alarms.

## Improvement workflow

1. Name the user-visible failure and intended improvement in measurements, grading, confidence, or advice.
2. Reproduce it with the smallest useful controlled case and relevant recorded speech. Add annotations or capture conditions where needed to judge correctness.
3. Define desired behavior independently of the current implementation. Keep tests of existing behavior clearly identified as regressions; preserve known failures as improvement targets.
4. Implement a scoped estimator or app change. Use tuning conditions to select parameters and separate speakers or capture conditions to evaluate them.
5. Compare before/after missed events, false alarms, measurement error, and resulting app guidance on relevant evaluation cases. Run the production worker and capture/UI path when the change affects those flows.
6. Record the decision, tradeoffs, validation limits, and remaining failure cases. Expand the corpus when it resolves a concrete uncertainty about the change.

A report or a larger corpus is supporting work. Completion of an app improvement requires an implemented change and evidence for its intended behavior. When evidence supports retaining the current behavior, explain why and keep unresolved weaknesses actionable rather than claiming an optimization.

Brief noise events missed by the original stability windows now have an implemented fix; see [the backlog](BACKLOG.md#2-assess-background-noise-stability--high-priority) and [before/after results](NOISE_STABILITY_BENCHMARK.md). The next accuracy work is independent human speech annotation, held-out capture conditions, and real-microphone validation. [MS-SNSD reference mixtures](../apps/web/e2e/fixtures/reference-noise/README.md) add SNR estimator gates with predefined intervals; keep these distinct from end-to-end speech-selection accuracy.

Recorded September 10, 2026 on Windows, Chromium 153.0.8010.12. Machine-readable output: [benchmark-results.json](benchmark-results.json). Each input lasts seven seconds. The speech fixture is locally generated synthetic speech; its provenance is in `apps/web/public/demo/README.md`.

| Input | Legacy energy detector: speech seconds | Silero: speech seconds | Worker wall time (ms) |
| --- | ---: | ---: | ---: |
| Silence | 0 | 0 | 812 |
| 50 Hz sine, amplitude 0.1 | 7 | 0 | 540 |
| Seeded white noise, amplitude 0.1 | 7 | 0 | 540 |
| Synthetic speech after 2 s quiet | 3.500 | 3.992 | 556 |
| Same speech at 10% amplitude | 0.209 | 3.960 | 679 |

The baseline is the actual `detectVoiceActivity` implementation at its default -35 dBFS threshold. The neural measurements come from the production worker and committed Silero model. The tone and noise cases show why energy alone cannot establish speech. The quieter fixture illustrates the fixed energy threshold's level sensitivity.

These are synthetic smoke results, not a labeled speech corpus, accuracy percentage, or representative latency benchmark. Segment boundaries are not manually annotated. Times are one sequential run per case, including worker startup and local model requests; cache warm-up differs between rows. No RAM, mobile battery, real microphone, or cold internet-download measurements are claimed. YAMNet classification is independently exercised by the recording browser test; its accuracy is not established here.

## Recorded human speech regression coverage

The [short-spike phase decision](NOISE_PHASE_BENCHMARK.md) fixes unsupported
noise retries when overlapping windows count one 10 ms spike repeatedly.
Eighty exact-label conditions and a before/after worker comparison retain
100 ms burst detection and stationary controls. Broader acoustic threshold
tuning remains open.

The [sample-grid decision](NOISE_SAMPLE_GRID_BENCHMARK.md) corrects missed
100 ms, +7 dB noise bursts at 22.05 kHz. Exact-label estimator cases and a
24-case recorded-speech worker comparison show the resulting retry/grade
improvement. Acoustic thresholds remain provisional; generated capture
conditions and existing speakers do not complete representative tuning.

[Independent AI-assisted annotations](AI_SPEECH_ANNOTATIONS.md) now supply
provisional source speech/nonspeech/uncertain intervals for all twelve clips,
exact injected-noise component labels, and 48 source-only worker comparisons.
Whisper and WebRTC labels are frozen before Miccheck comparison; uncertain
regions are excluded and coverage is reported. These model-assisted candidates
and separate AI protocol review do not replace human listening or validate
speech-boundary accuracy. The report preserves specific disagreements for the
next investigation rather than tuning thresholds to match pseudo-labels.

[Groq Large V3 corroboration](GROQ_ANNOTATION_COMPARISON.md) adds a separate
conservative consensus snapshot without replacing the original annotations.
The two Whisper models are related, so their agreement is not independent
ground truth. Timing disagreements withdraw labels into uncertainty; they do
not establish a production improvement or authorize broader threshold tuning.

The [human speech diagnostic benchmark](HUMAN_SPEECH_BENCHMARK.md) runs twelve natural human recordings from six additional speakers through the production worker under seven conditions (84 cases). The [baseline](HUMAN_SPEECH_BASELINE.md) reproduced clipping dilution and calibration-only noise reliability failures; the current report verifies the fixes. Speech-boundary annotation and listening review remain pending; these are diagnostic results, not accuracy claims.

`apps/web/e2e/real-speech.spec.ts` additionally runs two LibriSpeech human audiobook
recordings through the production worker. Both recordings pass with a two-second
quiet start and at 10% amplitude. Starting speech during calibration instead
returns `INSUFFICIENT_EVIDENCE` with reason `calibration_speech`; the restored UI
explains this without claiming no speech was detected. All six cases passed on
September 10, 2026. Sources, license, and hashes are in
[`e2e/fixtures/README.md`](../apps/web/e2e/fixtures/README.md).

These cover one speaker and do not establish accuracy across devices or rooms.

## Asset budget

Uncompressed files in this checkout: Silero model 2.33 MB, ONNX WASM 12.36 MB plus a 24 KB module; optional YAMNet weights 16.04 MB plus graph metadata. Actual network transfer depends on hosting compression and caching. JavaScript worker code is additional. These assets are served by the application origin, not fetched from third-party model providers at runtime.

## Reproduce

```bash
npm ci
npm run build
npx playwright install chromium
npm --workspace apps/web run test:e2e
```

To refresh the JSON report in PowerShell:

```powershell
$env:UPDATE_BENCHMARK = '1'
npm --workspace apps/web run test:e2e
Remove-Item Env:UPDATE_BENCHMARK
```

`UPDATE_SCREENSHOTS=1` similarly refreshes the checked-in home, result, and mobile screenshots. The tests use a fake microphone and never request physical microphone input.

A future accuracy evaluation should use consented, manually annotated recordings split by speaker, room, and device. Include quiet speech, fans, typing, music, processing on/off, and known signal/noise mixtures; report missed speech, false speech, SNR error, model latency, and memory by device. Until then, results stay explicitly heuristic and diagnostic certainty is capped.
