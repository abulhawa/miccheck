# Human speech collection

These recordings support improvements to the mic checker. Select clips and controlled transformations to reproduce a specific measurement or guidance failure, evaluate a production fix, and retain regression coverage. Follow the [benchmark improvement workflow](../../../../../docs/BENCHMARK.md#improvement-workflow); collection size and passing cases alone are not improvement outcomes. Keep tuning and evaluation speakers separate when selecting thresholds, and add speech annotations where correctness depends on boundaries.

`e2e/fixture-acceptance.spec.ts` includes all twelve recordings in the normal Playwright suite. It runs the production worker and Silero with checksum verification and fails on unmet expectations. Run through `npm --workspace apps/web run test:e2e -- fixture-acceptance.spec.ts` after building, or run the self-contained worker acceptance runner without Next.js:

```powershell
$env:FIXTURE_ACCEPTANCE = '1'
node apps/web/scripts/benchmark-human-speech.mjs
Remove-Item Env:FIXTURE_ACCEPTANCE
```

Acceptance mode does not rewrite historical benchmark results. It asserts stationary-noise controls, sustained-change retry guidance, clipping invariance, detection of a 100 ms high-noise burst, and a >= 0.2 experimental echo-score increase for the injected 120 ms reflection at gain 0.65. That echo margin is a declared acceptance target for a strong simulated reflection, not a calibrated echo amount or permission to include echo in grades.

For SNR, seeded independent noise is added with a nominal whole-clip 20 dB ratio. The reference is computed directly from the separately retained signal and noise components over the worker-selected speech samples; estimated SNR must be within 2 dB and the mixture must not saturate. This checks estimator recovery for known injected components, not speech-boundary accuracy or original room SNR. The entire original waveform, including residual source noise, is explicitly the reference signal. The 2 dB tolerance is an engineering acceptance requirement, not an uncertainty claim. Source room SNR and true echo labels remain unknown.

Acceptance run September 28, 2026: SNR, reflection, stationary/sustained-noise controls, and clipping invariance passed for all twelve clips. Brief-noise detection failed for `5639-40744-0033`, `260-123440-0018`, `7729-102255-0045`, and `3575-170457-0020`. The acceptance runner exits nonzero for these failures. The controlled estimator suite also fails its eighteen short-burst acceptance cases. These failures establish work to improve the app, not reasons to weaken the expectations.

After implementing the short-window detector and protecting it from speech-boundary residue, all twelve recordings meet those expectations, including the four original misses. All eighteen controlled short-burst cases now pass as well. The acceptance suite also asserts that the original, stationary-noise, clipping, reflection, and known-mixture controls still receive grades, preventing improved burst detection from introducing unsupported retries. These recordings informed development; they are regression evidence, not held-out accuracy validation.

Twelve unmodified human audiobook recordings from six additional LibriSpeech test-clean speakers, retrieved September 28, 2026. These are recorded people, not synthesized voices. Each clip is 3–12 seconds long, in 16 kHz FLAC format. Total duration is about 81 seconds.

Source: [LibriSpeech / OpenSLR](https://www.openslr.org/12/).
License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
Attribution: LibriSpeech, Vassil Panayotov, Guoguo Chen, Daniel Povey, and Sanjeev Khudanpur; source audio from LibriVox public-domain audiobooks.

[manifest.json](manifest.json) records the archive URL, original archive paths, transcripts, durations, sample rates, and SHA-256 checksums. [SPEAKERS.TXT](SPEAKERS.TXT) preserves upstream speaker metadata. The six speakers are 1320, 5639, 260, 7729, 2094, and 3575; upstream metadata lists four male and two female speakers.

Regenerate from the repository root with `python apps/web/scripts/gather-human-speech.py`. The script streams the roughly 346 MB official archive but saves only these selected clips and metadata. It selects the first six archive speakers other than the existing speaker 6930 and the first two clips per speaker lasting 3–12 seconds.

Use these source recordings for controlled noise, clipping, and delayed-reflection simulations, keeping the originals unchanged. The existing demo synthesis and its noise/echo transformations have not been replaced. Run `node apps/web/scripts/benchmark-human-speech.mjs` and `node apps/web/scripts/report-human-speech.mjs` from the repository root to reproduce the [diagnostic report](../../../../../docs/HUMAN_SPEECH_BENCHMARK.md).

These English audiobook readings broaden speaker coverage but do not establish microphone, room, language, or conversational-speech diversity. Transcripts are upstream text, not manually annotated speech timestamps. Speech-boundary annotation, listening review, and benchmark integration remain pending. Do not treat background noise in the originals as a known zero-noise reference when constructing SNR mixtures.
