# Synthetic speech-detection benchmark

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
