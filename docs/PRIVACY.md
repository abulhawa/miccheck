# Privacy

MicCheck processes microphone audio locally. It does not upload audio or transcripts, and does not require an account.

## Recording and retention

A guided test first records three seconds of room sound, then up to twenty seconds of speech when the user chooses to start. The preparation pause is not recorded. The microphone stays connected between the two stages, as explained on screen; the user can cancel at any time. Raw PCM is analyzed when AudioWorklet is available and encoded as WAV for playback. An encoded MediaRecorder fallback has lower diagnostic certainty. Microphone tracks are stopped after voice capture, cancellation, or errors.

The latest take and an optional comparison baseline are saved as paired audio, measurements, timestamp, capture settings, and device identifier in this tab's `sessionStorage`. Starting another test replaces the latest take and preserves a baseline. Clear comparison removes the baseline. Storage normally ends when the tab closes, although browser session restoration may preserve it. Takes older than 24 hours are not restored from storage. Denied or full storage falls back to memory; that fallback does not survive page reload.

Test preferences can be stored locally. You can remove all saved MicCheck data through your browser's site-data controls. No cross-device sync is provided.

## Models and network traffic

Silero and optional YAMNet model assets are served by the same site and run on the visitor's device. Ordinary page, model, and asset requests reach the host, which may retain normal access logs. The app sends no microphone audio in those requests. Browser caching can reuse model downloads; availability after going offline is not guaranteed.

## Optional analytics

Vercel Analytics, Speed Insights, and custom usage events are disabled by default. A site operator can opt in at build time using `NEXT_PUBLIC_ANALYTICS_ENABLED=true`; enabling them requires reviewing that deployment's privacy disclosures and requirements. Analytics payloads do not contain recorded audio. The public privacy page describes this optional configuration.

Microphone permission can be revoked in browser settings at any time.
