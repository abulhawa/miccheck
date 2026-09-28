# Human speech diagnostic benchmark

Recorded 2026-09-28T07:28:11.529Z; win32, Chromium 153.0.8010.12.

Twelve unmodified English audiobook clips from six speakers were each analyzed under seven conditions (84 production-worker runs). All fixture SHA-256 hashes were checked before analysis. The runner bundles current production sources and uses the actual Silero model in Chromium; it supplies no speech boundaries or mocked model outputs. Background classification is disabled.

## Scope and source review

This is an automated signal review and diagnostic benchmark, not a completed listening review or accuracy evaluation. Source residual noise and reverberation are unknown. Near-full-scale samples are a clipping indicator, not proof of distortion. No manually labeled speech timestamps exist, so speech precision/recall and boundary error are not reported. Grades use meeting mode with an unknown device.

| Source recording | Seconds | RMS dBFS | Peak | Samples ≥ 0.98 | Original grade |
| --- | ---: | ---: | ---: | ---: | --- |
| [1320-122617-0003.flac](../apps/web/e2e/fixtures/human-speech/1320-122617-0003.flac) | 6.29 | -23.87 | 0.37 | 0 | B |
| [1320-122617-0012.flac](../apps/web/e2e/fixtures/human-speech/1320-122617-0012.flac) | 7.59 | -23.76 | 0.46 | 0 | B |
| [5639-40744-0002.flac](../apps/web/e2e/fixtures/human-speech/5639-40744-0002.flac) | 8.91 | -28.17 | 0.45 | 0 | C |
| [5639-40744-0033.flac](../apps/web/e2e/fixtures/human-speech/5639-40744-0033.flac) | 9.15 | -29.79 | 0.34 | 0 | C |
| [260-123440-0018.flac](../apps/web/e2e/fixtures/human-speech/260-123440-0018.flac) | 3.64 | -22.73 | 0.40 | 0 | B |
| [260-123440-0007.flac](../apps/web/e2e/fixtures/human-speech/260-123440-0007.flac) | 3.38 | -22.34 | 0.33 | 0 | B |
| [7729-102255-0045.flac](../apps/web/e2e/fixtures/human-speech/7729-102255-0045.flac) | 6.80 | -25.66 | 0.59 | 0 | C |
| [7729-102255-0012.flac](../apps/web/e2e/fixtures/human-speech/7729-102255-0012.flac) | 4.08 | -23.62 | 0.64 | 0 | B |
| [2094-142345-0059.flac](../apps/web/e2e/fixtures/human-speech/2094-142345-0059.flac) | 10.01 | -24.35 | 0.56 | 0 | B |
| [2094-142345-0045.flac](../apps/web/e2e/fixtures/human-speech/2094-142345-0045.flac) | 3.00 | -25.00 | 0.38 | 0 | B |
| [3575-170457-0023.flac](../apps/web/e2e/fixtures/human-speech/3575-170457-0023.flac) | 9.10 | -25.65 | 0.51 | 0 | C |
| [3575-170457-0020.flac](../apps/web/e2e/fixtures/human-speech/3575-170457-0020.flac) | 8.64 | -23.48 | 0.57 | 0 | B |

## Conditions

- Original: two seconds of digital silence, the unmodified source, then one second of silence. Its SNR is inflated by silent calibration and must not be interpreted as original room quality.
- Low-noise / noisy: identical seeded broadband noise throughout calibration, speech, and the one-second tail, with amplitudes 0.0008 / 0.065.
- Clipped: 12× source gain, low background noise, hard limiting at ±1.
- Clipped-plus-silence: identical clipped input followed by nine extra seconds of digital silence.
- Echo: low noise plus a delayed source copy at 120 ms and gain 0.65. This is a single reflection, not a realistic room impulse response.
- Changing-noise: low noise during calibration, high noise afterwards, including the final nonspeech second.

The JSON includes an added-noise power ratio measured over the whole source clip. It is not ground-truth speech-only SNR: the source already contains unknown noise and internal pauses, and VAD selects a different interval.

## Findings

- All 84 variants received grades: true.
- Stationary high noise reduced measured SNR for every clip: true.
- Amplification/hard limiting increased reported clipping for every clip: true.
- Appending silence reduced reported clipping in 12/12 clips. This reproduces the denominator defect even when the overall grade stays F.
- Changing-noise recordings were still marked noiseReliable in 12/12 clips. Calibration-only SNR cannot establish later noise quality.
- Echo is excluded from grading. A reflection can nevertheless change level and VAD selection, so its overall grade need not equal the source grade.

Retain all twelve as provisional source candidates for regression testing. None is certified clean or representative of microphone quality; suitability for accuracy ground truth remains pending listening review and annotation.

## Detailed results

| Clip | Condition | Grade | Speech seconds | SNR dB | Level dBFS | Clipping % | Echo score |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1320-122617-0003.flac | original | B | 5.57 | 80.00 | -23.35 | 0.00 | 0.02 |
| 1320-122617-0003.flac | low-noise | B | 5.57 | 43.39 | -23.35 | 0.00 | 0.02 |
| 1320-122617-0003.flac | noisy | F | 5.60 | 5.19 | -22.20 | 0.00 | 0.02 |
| 1320-122617-0003.flac | clipped | F | 5.57 | 62.11 | -4.63 | 14.73 | 0.03 |
| 1320-122617-0003.flac | clipped-plus-silence | F | 5.57 | 62.11 | -4.63 | 6.59 | 0.03 |
| 1320-122617-0003.flac | echo | B | 5.66 | 44.76 | -21.98 | 0.00 | 0.43 |
| 1320-122617-0003.flac | changing-noise | B | 5.54 | 44.56 | -22.17 | 0.00 | 0.01 |
| 1320-122617-0012.flac | original | B | 6.75 | 80.00 | -23.25 | 0.00 | 0.02 |
| 1320-122617-0012.flac | low-noise | B | 6.75 | 43.48 | -23.25 | 0.00 | 0.02 |
| 1320-122617-0012.flac | noisy | F | 6.66 | 5.38 | -22.05 | 0.00 | 0.02 |
| 1320-122617-0012.flac | clipped | F | 6.75 | 61.73 | -5.01 | 13.78 | 0.03 |
| 1320-122617-0012.flac | clipped-plus-silence | F | 6.75 | 61.73 | -5.01 | 6.73 | 0.03 |
| 1320-122617-0012.flac | echo | B | 6.72 | 45.03 | -21.71 | 0.00 | 0.42 |
| 1320-122617-0012.flac | changing-noise | B | 6.62 | 44.70 | -22.04 | 0.00 | 0.02 |
| 5639-40744-0002.flac | original | C | 7.36 | 80.00 | -27.34 | 0.00 | 0.02 |
| 5639-40744-0002.flac | low-noise | C | 7.33 | 39.42 | -27.32 | 0.00 | 0.02 |
| 5639-40744-0002.flac | noisy | F | 6.91 | 1.50 | -24.72 | 0.00 | 0.01 |
| 5639-40744-0002.flac | clipped | F | 7.52 | 58.90 | -7.83 | 5.06 | 0.01 |
| 5639-40744-0002.flac | clipped-plus-silence | F | 7.52 | 58.90 | -7.83 | 2.65 | 0.01 |
| 5639-40744-0002.flac | echo | C | 7.74 | 40.61 | -26.13 | 0.00 | 0.48 |
| 5639-40744-0002.flac | changing-noise | C | 6.91 | 42.02 | -24.72 | 0.00 | 0.01 |
| 5639-40744-0033.flac | original | C | 7.49 | 80.00 | -28.92 | 0.00 | 0.01 |
| 5639-40744-0033.flac | low-noise | C | 7.46 | 37.83 | -28.90 | 0.00 | 0.01 |
| 5639-40744-0033.flac | noisy | F | 6.82 | 0.03 | -25.51 | 0.00 | 0.01 |
| 5639-40744-0033.flac | clipped | F | 7.78 | 57.84 | -8.89 | 3.30 | 0.01 |
| 5639-40744-0033.flac | clipped-plus-silence | F | 7.78 | 57.84 | -8.89 | 1.75 | 0.01 |
| 5639-40744-0033.flac | echo | C | 8.16 | 38.95 | -27.79 | 0.00 | 0.48 |
| 5639-40744-0033.flac | changing-noise | C | 6.75 | 41.24 | -25.50 | 0.00 | 0.00 |
| 260-123440-0018.flac | original | B | 2.94 | 80.00 | -21.81 | 0.00 | 0.04 |
| 260-123440-0018.flac | low-noise | B | 2.94 | 44.92 | -21.81 | 0.00 | 0.04 |
| 260-123440-0018.flac | noisy | F | 2.82 | 6.93 | -20.81 | 0.00 | 0.03 |
| 260-123440-0018.flac | clipped | F | 3.01 | 62.29 | -4.44 | 14.59 | 0.05 |
| 260-123440-0018.flac | clipped-plus-silence | F | 3.01 | 62.29 | -4.44 | 4.96 | 0.05 |
| 260-123440-0018.flac | echo | A | 3.01 | 46.48 | -20.26 | 0.00 | 0.52 |
| 260-123440-0018.flac | changing-noise | A | 2.82 | 45.93 | -20.81 | 0.00 | 0.03 |
| 260-123440-0007.flac | original | B | 2.85 | 80.00 | -21.60 | 0.00 | 0.06 |
| 260-123440-0007.flac | low-noise | B | 2.88 | 45.09 | -21.64 | 0.00 | 0.06 |
| 260-123440-0007.flac | noisy | F | 2.85 | 6.90 | -20.83 | 0.00 | 0.04 |
| 260-123440-0007.flac | clipped | F | 2.88 | 62.74 | -4.00 | 18.08 | 0.05 |
| 260-123440-0007.flac | clipped-plus-silence | F | 2.88 | 62.74 | -4.00 | 5.92 | 0.05 |
| 260-123440-0007.flac | echo | A | 2.98 | 46.64 | -20.10 | 0.00 | 0.52 |
| 260-123440-0007.flac | changing-noise | A | 2.82 | 45.87 | -20.87 | 0.00 | 0.05 |
| 7729-102255-0045.flac | original | C | 5.76 | 80.00 | -24.94 | 0.00 | 0.02 |
| 7729-102255-0045.flac | low-noise | C | 5.79 | 41.78 | -24.96 | 0.00 | 0.02 |
| 7729-102255-0045.flac | noisy | F | 5.54 | 3.80 | -23.23 | 0.00 | 0.01 |
| 7729-102255-0045.flac | clipped | F | 5.79 | 60.15 | -6.59 | 8.77 | 0.03 |
| 7729-102255-0045.flac | clipped-plus-silence | F | 5.79 | 60.15 | -6.59 | 4.07 | 0.03 |
| 7729-102255-0045.flac | echo | B | 5.66 | 43.41 | -23.32 | 0.00 | 0.50 |
| 7729-102255-0045.flac | changing-noise | B | 5.57 | 43.49 | -23.24 | 0.00 | 0.01 |
| 7729-102255-0012.flac | original | B | 3.62 | 80.00 | -23.10 | 0.00 | 0.02 |
| 7729-102255-0012.flac | low-noise | B | 3.62 | 43.63 | -23.10 | 0.00 | 0.02 |
| 7729-102255-0012.flac | noisy | F | 3.46 | 5.65 | -21.85 | 0.00 | 0.02 |
| 7729-102255-0012.flac | clipped | F | 3.62 | 60.95 | -5.79 | 11.19 | 0.02 |
| 7729-102255-0012.flac | clipped-plus-silence | F | 3.62 | 60.95 | -5.79 | 4.04 | 0.02 |
| 7729-102255-0012.flac | echo | B | 3.71 | 45.07 | -21.67 | 0.00 | 0.49 |
| 7729-102255-0012.flac | changing-noise | B | 3.46 | 44.89 | -21.85 | 0.00 | 0.02 |
| 2094-142345-0059.flac | original | B | 8.51 | 80.00 | -23.66 | 0.00 | 0.01 |
| 2094-142345-0059.flac | low-noise | B | 8.51 | 43.07 | -23.66 | 0.00 | 0.01 |
| 2094-142345-0059.flac | noisy | F | 8.38 | 4.94 | -22.39 | 0.00 | 0.01 |
| 2094-142345-0059.flac | clipped | F | 8.70 | 61.37 | -5.36 | 12.46 | 0.01 |
| 2094-142345-0059.flac | clipped-plus-silence | F | 8.70 | 61.37 | -5.36 | 6.85 | 0.01 |
| 2094-142345-0059.flac | echo | B | 8.90 | 44.43 | -22.30 | 0.00 | 0.48 |
| 2094-142345-0059.flac | changing-noise | B | 8.26 | 44.39 | -22.35 | 0.00 | 0.01 |
| 2094-142345-0045.flac | original | B | 2.34 | 80.00 | -23.94 | 0.00 | 0.03 |
| 2094-142345-0045.flac | low-noise | B | 2.11 | 43.22 | -23.52 | 0.00 | 0.03 |
| 2094-142345-0045.flac | noisy | F | 2.21 | 4.81 | -22.49 | 0.00 | 0.02 |
| 2094-142345-0045.flac | clipped | F | 2.53 | 60.66 | -6.08 | 7.91 | 0.05 |
| 2094-142345-0045.flac | clipped-plus-silence | F | 2.53 | 60.66 | -6.08 | 2.44 | 0.05 |
| 2094-142345-0045.flac | echo | B | 2.43 | 44.07 | -22.67 | 0.00 | 0.51 |
| 2094-142345-0045.flac | changing-noise | B | 2.18 | 44.29 | -22.44 | 0.00 | 0.02 |
| 3575-170457-0023.flac | original | C | 8.03 | 80.00 | -25.26 | 0.00 | 0.03 |
| 3575-170457-0023.flac | low-noise | C | 8.03 | 41.47 | -25.26 | 0.00 | 0.03 |
| 3575-170457-0023.flac | noisy | F | 8.00 | 3.43 | -23.49 | 0.00 | 0.01 |
| 3575-170457-0023.flac | clipped | F | 8.26 | 60.44 | -6.30 | 9.23 | 0.03 |
| 3575-170457-0023.flac | clipped-plus-silence | F | 8.26 | 60.44 | -6.30 | 4.88 | 0.03 |
| 3575-170457-0023.flac | echo | B | 8.16 | 43.13 | -23.61 | 0.00 | 0.43 |
| 3575-170457-0023.flac | changing-noise | B | 7.97 | 43.26 | -23.47 | 0.00 | 0.01 |
| 3575-170457-0020.flac | original | B | 7.97 | 80.00 | -23.17 | 0.00 | 0.03 |
| 3575-170457-0020.flac | low-noise | B | 7.97 | 43.57 | -23.17 | 0.00 | 0.03 |
| 3575-170457-0020.flac | noisy | F | 7.65 | 5.61 | -21.88 | 0.00 | 0.03 |
| 3575-170457-0020.flac | clipped | F | 7.81 | 61.77 | -4.97 | 13.97 | 0.04 |
| 3575-170457-0020.flac | clipped-plus-silence | F | 7.81 | 61.77 | -4.97 | 7.23 | 0.04 |
| 3575-170457-0020.flac | echo | B | 7.74 | 45.14 | -21.60 | 0.00 | 0.41 |
| 3575-170457-0020.flac | changing-noise | B | 7.68 | 44.84 | -21.89 | 0.00 | 0.03 |

## Reproduce

From the repository root, with dependencies and Playwright Chromium installed:

```sh
node apps/web/scripts/benchmark-human-speech.mjs
node apps/web/scripts/report-human-speech.mjs
```

The benchmark starts and closes its own loopback server and headless browser; no Next.js server or physical microphone is required. Variants are generated in memory and originals stay unchanged. The run writes [human-speech-results.json](human-speech-results.json); the second command regenerates this report. Timings are one run per input, include model startup, and are not representative device latency.

Next: listen to source clips, annotate speech boundaries, then implement clipping invariance and noise-stability evidence using these reproduced failures. Expand beyond English audiobooks and test actual microphones before making real-world accuracy claims.
