# Recorded human speech fixtures

These two unmodified FLAC recordings come from the LibriSpeech test-clean corpus,
speaker 6930, chapter 75918. They are human audiobook readings, not synthesized speech.

Source: https://www.openslr.org/12/
Archive: https://www.openslr.org/resources/12/test-clean.tar.gz
Archive paths: `LibriSpeech/test-clean/6930/75918/<filename>`
Retrieved September 10, 2026.

Attribution: LibriSpeech, Vassil Panayotov, Guoguo Chen, Daniel Povey, and Sanjeev
Khudanpur; source audio from LibriVox public-domain audiobooks.
License: Creative Commons Attribution 4.0 International (CC BY 4.0),
https://creativecommons.org/licenses/by/4.0/

SHA-256:

- `6930-75918-0000.flac`: `9ce35224156f071ab58eb7feb8a5ceae600f6f9f353da2a6cbf797b6b1ac8a23`
- `6930-75918-0007.flac`: `059969de8f6b780e1a4982805e977c3e73e40d3759c8fa8cb0cb8fabd9eb5b27`

`real-speech.spec.ts` runs the production speech model and grading worker on each
recording, with two seconds of silence prepended, at reduced amplitude, and with
speech during calibration. The source files remain unchanged; transformations
happen in memory. Run after building: `npm --workspace apps/web run test:e2e -- real-speech.spec.ts`.

This is regression coverage for one speaker, not an accuracy benchmark across
accents, rooms, languages, physical microphones, or browser capture hardware.
