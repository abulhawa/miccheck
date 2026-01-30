# Browser Compatibility

MicCheck relies on MediaRecorder and the Web Audio API. The following browsers are supported:

| Browser | Desktop | Mobile |
| --- | --- | --- |
| Chrome | ✅ | ✅ |
| Edge | ✅ | ✅ |
| Firefox | ✅ | ✅ |
| Safari | ✅ (14+) | ✅ (14+) |

## Notes

- Some mobile browsers may require user interaction before audio playback.
- Safari may use `webkitAudioContext` under the hood.
- If you see a compatibility warning, update to the latest stable browser build.
