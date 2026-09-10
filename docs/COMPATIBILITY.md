# Browser verification

| Environment | Evidence |
| --- | --- |
| Chromium, Windows desktop | Automated production-browser suite: local models, fake microphone PCM, track cleanup, refresh recovery, comparison playback |
| Chromium, 390 × 844 viewport | Automated demo layout and keyboard-navigation checks; not a physical phone test |
| Chrome / Edge with physical microphones | Manual testing pending |
| Firefox desktop/mobile | Manual testing pending |
| Safari macOS/iOS | Manual testing pending |

Requires JavaScript, Web Audio, WebAssembly, Workers, and MediaRecorder. Raw capture additionally uses AudioWorklet. Recording requires HTTPS or localhost and microphone permission. Encoded fallback or browser processing lowers certainty. Browser/device processing may remain active even when requested off; unknown settings are shown conservatively.

These entries report completed evidence, not inferred support guarantees. Test a physical device before relying on the result for a public demonstration.
