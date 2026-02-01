# Browser Compatibility

MicCheck relies on MediaRecorder and the Web Audio API. The following browsers are supported:

| Browser | Desktop | Mobile |
| --- | --- | --- |
| Chrome | ✅ Full | ✅ Full |
| Edge | ✅ Full | ✅ Full |
| Firefox | ⚠️ Partial | ⚠️ Partial |
| Safari (macOS) | ⚠️ Limited | N/A |
| Safari (iOS) | N/A | ⚠️ Degraded |

## Notes

- Some mobile browsers may require user interaction before audio playback.
- Safari may use `webkitAudioContext` under the hood, and system processing can affect results.
- If you see a compatibility warning, update to the latest stable browser build.
