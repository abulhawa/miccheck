# MicCheck technical and portfolio review

> Historical audit, followed by implementation on September 9–10, 2026. Findings 1–8 have been addressed in separate commits: normalized hum, neural guided evidence, PCM capture, lifecycle cancellation, paired demo/session data, deterministic locale, guarded storage, and working test/build/lint gates. Added free local Silero/YAMNet, comparison playback, runnable demos, UI accessibility improvements, and dependency updates. Root checks and Chromium flows are now executable; the original environment limitations below describe the initial audit only. See README, BENCHMARK.md, and COMPATIBILITY.md for current evidence and remaining physical-device evaluation.

Reviewed September 9, 2026. Scope: source, configuration, CI, documentation, and direct execution of selected audio functions. No application code was changed. This is not a completed browser, accessibility, dependency-security, or physical microphone audit.

## Assessment

The strongest direction is a privacy-first microphone setup coach: capture a guided sample, explain the evidence, suggest one change, and compare a second recording. The existing separation between audio utilities, metrics, and UI is useful. There are numerous focused tests and a documented local-audio privacy model. The immediate priority is measurement credibility and recording reliability; additional visual polish should follow those fixes.

## Findings, in priority order

### 1. High: hum detection uses the wrong frequency bin and normalization

Location: `packages/audio-metrics/src/metrics/noise.ts:31–69`.

The Goertzel bin uses `Math.round(0.5 + N * frequency / sampleRate)`. For a one-second 48 kHz recording, the requested 50 Hz bin becomes 51 Hz. The returned spectral power is also divided by N and compared with mean-square signal energy, causing a duration-dependent quantity rather than a bounded energy ratio.

Direct execution of the current functions on one-second, amplitude-0.1 sine waves produced:

| Input | Reported hum ratio | Speech ratio |
| --- | ---: | ---: |
| 50 Hz | approximately 1.39e-17 | 1.0 |
| 51 Hz | approximately 24,000 | 1.0 |
| 60 Hz | approximately 1.79e-17 | 1.0 |
| 61 Hz | approximately 24,000 | 1.0 |

Fix frequency selection and power normalization together. Use a documented frequency band/window strategy so slight frequency offsets do not evade detection. Test clean tones, nearby tones, speech mixed with hum, and multiple durations/sample rates; verify a physically meaningful ratio and stable behavior across durations.

### 2. High: loudness detection is being treated as speech recognition

Location: `packages/audio-core/src/vad.ts`; `packages/audio-metrics/src/metrics/noise.ts`; `packages/audio-metrics/src/index.ts`.

Every frame above -35 dBFS is classified as speech. The tone experiment above confirms a non-speech false positive. Conversely, quiet speech can be rejected. When there are no non-speech frames, the noise estimator treats low-amplitude individual samples as background noise, even though these include ordinary waveform zero crossings. Its result is not a reliable separation of speech and noise.

Add a guided quiet-room interval followed by speech. Preserve explicit capture phases, require enough usable data, and return “insufficient evidence” when necessary. An ML voice detector is a useful subsequent upgrade. Validate SNR estimates against controlled mixtures with known signal/noise levels.

### 3. High: capture and confidence do not justify the diagnostic claims

Locations: `apps/web/hooks/useAudioRecorder.ts:263`; `packages/audio-metrics/src/index.ts:29–43`; `packages/audio-metrics/src/metrics/echo.ts`.

Capture requests echo cancellation, then analyzes decoded compressed MediaRecorder audio. Browser processing and lossy encoding can change the signal used for clipping and room diagnostics. Track settings are displayed but are not incorporated into measurement validity.

Diagnostic certainty is derived from grade: good grade means higher confidence. That is not evidence of accuracy. A bad recording can be diagnosed confidently; an apparently clean processed recording may remain uncertain. Metric-level confidence is not carried through into this top-level certainty.

Use an explicitly described capture mode, inspect actual track settings, and capture PCM with an AudioWorklet for analysis while retaining encoded audio for playback. Derive confidence from evidence availability, speech/quiet duration, processing settings, and validated estimator limitations. Treat the autocorrelation echo score as experimental until validated against dry and reverberant speech; current code alone does not demonstrate calibrated room-echo accuracy.

### 4. High: asynchronous microphone acquisition can outlive the UI

Location: `apps/web/hooks/useAudioRecorder.ts:243–450`; `apps/web/components/TestExperiencePage.tsx`.

There is no requesting-permission state or operation token around `getUserMedia`. The start button stays available while permission is pending. Reset/unmount can run before the promise resolves, after which initialization can still attach a new stream. Concurrent starts can overwrite shared refs. This is a code-supported lifecycle risk, not a reproduced physical-microphone failure.

Add an acquisition state, prevent concurrent starts, and use a generation token to release stale streams immediately. Invalidate pending decoding/analysis on reset and unmount. Test delayed permission resolution, double click, reset during decode, device removal, and navigation.

The recorder also starts its meter loop during initialization and again on recording start; the page creates a second metering AudioContext through `useAudioMeter`. Consolidate the meter and ensure one animation loop and predictable resource cleanup.

### 5. Medium: demonstration scores can accompany the user's actual audio

Location: `apps/web/app/results/page.tsx:20–194`.

The page is explicitly labeled as sample results, which is good. However, it always renders a hard-coded B-grade example while loading the user's last recording for playback. The scores therefore do not describe the audio beside them. Real analysis exists only in the recording hook's React state and is lost on reload.

Give demo results their own matching fixture audio. Store actual analysis, capture metadata, and audio under the same session identifier if refresh recovery is intended. Do not combine unrelated scores and recordings.

### 6. Medium: locale selection can disagree between server and client

Location: `apps/web/lib/i18n/index.ts:11–25`.

The server defaults to English, while the browser can immediately choose German from localStorage or navigator language. Components calling `t()` during initial render can therefore hydrate with different text. Server-rendered sections can also remain in English while client sections use German. This requires browser reproduction but follows directly from the two locale-selection paths.

Resolve a shared initial locale, for example through a locale route or server-readable cookie, and provide it consistently to components. Add a German-locale hydration check.

### 7. Medium: browser storage failures can break otherwise local functionality

Locations: `apps/web/lib/audioStorage.ts`; `apps/web/lib/analysisContextStorage.ts`; `apps/web/components/TestExperiencePage.tsx`.

Several storage reads/writes/removals lack error handling. In particular, an exception from `sessionStorage.setItem` inside the FileReader callback does not reject the surrounding promise, despite the caller attaching `.catch`. Recording reset also calls unguarded storage removal before starting capture.

Use guarded storage operations with an in-memory fallback and validate saved values. Test denied storage, quota exhaustion, and reset while an older save is pending. Keep saved analysis and audio consistent.

### 8. Medium: test configuration and clean-checkout workflow need repair

Locations: each workspace `package.json`; `turbo.json`; `.github/workflows/ci.yml`.

Vitest options are placed under a package.json `vitest` key rather than a supported Vitest/Vite configuration file. Move options into `vitest.config.ts`, with coverage under `test.coverage`, and verify that thresholds actually fail the command. When moving the web include patterns, include `components` and `hooks`, which are absent from the currently intended patterns. This does not establish that those tests are currently skipped: default discovery may find them while ignoring the package.json configuration.

Turbo's test task has no dependency-build prerequisite, while internal packages resolve to `dist/index.js`. The CI builds first, but the documented `npm install && npm run dev` and standalone tests have no equivalent setup guarantee. Provide a reproducible initial build/watch workflow or consistent workspace source resolution. Add lint to CI; the audio-package lint scripts currently only print a message.

The README CI badge points at `miccheck/miccheck`, while this checkout's origin is `abulhawa/miccheck`. Correct it. Update methodology to reflect the actual fallback behavior and estimator limitations.

## Portfolio product plan

1. **Establish trust:** fix hum detection, capture lifecycle, locale/storage handling, test configuration, and demo/audio pairing. Publish what each metric can and cannot establish.
2. **Make the experience demonstrable:** one primary test flow with advanced details collapsed; guided quiet/speech phases; clear permission and progress states; demo fixtures usable without microphone access. Include clean, noisy, clipped, and reverberant examples with matching audio and explanations.
3. **Add before/after comparison:** preserve two takes, show changes in validated metrics, allow immediate A/B playback, and explain when different capture settings make comparison unreliable. This makes “try moving closer” a complete, testable user journey.
4. **Polish the presentation:** emphasize one result and one action, reduce repeated grade/summary/impact copy, use consistent spacing and typography, and verify mobile layout, keyboard operation, visible focus, and screen-reader status announcements. Prioritize free setup advice over gear links for the portfolio version.
5. **Publish engineering evidence:** architecture diagram, short demo video, real screenshots, clean setup instructions, limitations, and a benchmark report. Show measured outcomes and tradeoffs, not unvalidated accuracy claims.

These visual recommendations are based on component structure; live rendered layouts have not been inspected in this review.

## AI/ML that adds value

**First choice: local neural speech detection.** Evaluate Silero VAD through ONNX Runtime Web to improve speech segmentation. Silero supports 8/16 kHz and has an MIT license. Run analysis off the main thread, lazy-load and pin the model, preserve model state as required, and retain a clearly labeled fallback. Use proper anti-alias filtering when downsampling; the existing linear resampler should not automatically become the ML preprocessing pipeline.

**Second choice: background sound classification.** Evaluate a YAMNet-based model for useful noise categories, initially on the quiet interval. YAMNet predicts 521 AudioSet classes. Limit the UI to a small validated subset and allow an unknown result. “Likely typing in the background” can support a specific action, but model scores should not be presented as calibrated probabilities without evaluation.

**Optional later: a language-model explanation layer.** If users need more personalized explanations, feed validated metrics and permitted recommendations into it. Keep scoring deterministic; constrain outputs so it cannot invent acoustic measurements. A remote feature would need explicit user choice and accurate privacy copy. It adds less initial value than better segmentation and comparison.

Evaluate the current energy detector and ML candidate on the same labeled recordings: quiet speech, noise-only, fans, typing, music, different devices, and processed audio. Split evaluation by speaker/room/device, rather than adjacent frames of the same clip. Report false speech detections, missed speech, noise-estimation error, download size, memory, and desktop/mobile latency. Demonstrating an honest baseline-versus-model comparison is a strong portfolio contribution.

Sources checked:

- [Silero VAD official repository](https://github.com/snakers4/silero-vad)
- [ONNX Runtime Web documentation](https://onnxruntime.ai/docs/tutorials/web/)
- [TensorFlow YAMNet tutorial](https://www.tensorflow.org/hub/tutorials/yamnet)
- [Vitest configuration documentation](https://vitest.dev/config/)

## Verification limits

The checkout had no node_modules. `npm ci --no-audit --no-fund` could not start because npm is unavailable in this shell. A bundled Node executable was available and used for the sine-wave probes above, executing the current source after stripping TypeScript and joining its local dependencies in memory.

`npm run test`, `npm run build`, lint, and live browser verification were not run. The repository additionally documents an audio-metrics workspace-resolution limitation; its standalone build/test were not attempted, as instructed. No build success or full test pass is claimed. Only this review document was added.
