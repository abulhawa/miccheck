# Local models

These model assets are served by MicCheck itself. Inference runs on the user's
device; no hosted inference API, account, key, or paid subscription is used.

- Silero VAD v5 ONNX: pinned from @ricky0123/vad-web 0.0.30. MIT license in silero/LICENSE.
- Google YAMNet TF.js version 1: Apache-2.0, license in yamnet/LICENSE; official AudioSet labels in yamnet/classes.csv.
- Exact artifact hashes and original URLs are in manifest.json. The build verifies every hash.
- ONNX Runtime Web 1.24.3 runtime files are copied from the pinned npm dependency at build time.

The speech model is about 2.3 MB plus a 12.4 MB WASM runtime. YAMNet adds about
16 MB of weights when the optional background-sound feature is selected. Normal
hosting and bandwidth still apply. Browser caching can avoid repeated downloads;
the app does not promise offline availability after caches are cleared.

Sound classifications are experimental, not calibrated probabilities. The small
displayed label set is not a claim of validation on real microphones.
