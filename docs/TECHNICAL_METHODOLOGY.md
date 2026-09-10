# Audio analysis methodology

The production flow uses `analyzeGuidedSamples` in `packages/audio-metrics/src/guided.ts`. The legacy energy detector remains for baseline tests and package compatibility; it does not decide speech in the web recording flow.

## Capture and speech detection

The guided capture contains two seconds of quiet and five seconds of speech. AudioWorklet provides raw mono PCM. The app requests echo cancellation, noise suppression, and automatic gain control to be disabled and records the actual track settings. If raw capture is unavailable, decoded MediaRecorder audio is a lower-certainty fallback.

A windowed-sinc low-pass resampler converts a copy to 16 kHz for Silero VAD v5 in a Web Worker. Inference uses 512-sample frames, 64 samples of context, and recurrent state. The speech threshold is 0.5; segments must last at least 160 ms, with short gaps merged. The original sample-rate PCM is used for measurements.

A grade requires at least one second of detected speech after calibration, at least one second of quiet calibration, and less than 150 ms of detected speech in that interval. Missing speech or contaminated calibration returns an explicit insufficient-evidence state. A model failure returns an error rather than substituting an invented grade.

## Measurements

- **Speech level:** RMS of samples in detected speech intervals after calibration, expressed in dBFS. It measures digital signal level, not physical sound pressure.
- **Noise floor:** RMS of the initial quiet interval. This assumes the room noise stays reasonably stationary during the following speech.
- **SNR:** subtract quiet power from speech-interval power, then compare the remaining estimated signal power with quiet power. `signalRms = sqrt(max(0, speechRms² - quietRms²))`; SNR is `20 log10(signalRms / quietRms)`, bounded to -20 through 80 dB with numerical floors. Unusable quiet evidence withholds a grade.
- **Clipping:** fraction of post-calibration samples with absolute amplitude at least 0.98. This is a near-full-scale heuristic, not proof of every kind of analog distortion.
- **Hum:** the dominant Hann-windowed sinusoid near 50 or 60 Hz (±2 Hz, 0.5 Hz steps), normalized by coherent window gain and quiet-interval power, bounded to [0, 1]. This estimates narrowband mains-like energy, not its physical cause.
- **Echo:** the legacy autocorrelation estimator is experimental. It can confuse periodic voice structure with reflections. It is excluded from grading and actionable recommendations.

## Grade and certainty

Existing context-dependent deterministic thresholds turn speech level, clipping, and SNR into category ratings; the weakest applicable rating controls the grade. Thresholds live in `packages/audio-metrics/src/config.ts` and scoring modules. Recommendations favor free adjustments. The grade is not learned, professionally calibrated, or a universal microphone-quality measure.

Certainty describes available evidence, not whether the grade is good. It is at most medium for raw PCM with all three processing settings explicitly false; encoded, processed, or unknown settings produce low certainty. Representative speaker/room/device evaluation remains outstanding.

## Optional background classification

YAMNet runs on the quiet interval only when that interval is usable. The UI exposes a small subset (typing/keyboard, air conditioning, music) only when its mean model score exceeds 0.35 and exceeds speech/silence scores. Otherwise it returns unknown. These are tentative labels, not calibrated probabilities or validated source attribution. Classification failure does not discard successful speech analysis.

See `apps/web/public/models` for pinned model artifacts, hashes, and license notices, and [BENCHMARK.md](BENCHMARK.md) for the reproducible synthetic smoke evaluation.
