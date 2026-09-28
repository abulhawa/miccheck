# Human speech collection

These recordings support improvements to the mic checker. Select clips and controlled transformations to reproduce a specific measurement or guidance failure, evaluate a production fix, and retain regression coverage. Follow the [benchmark improvement workflow](../../../../../docs/BENCHMARK.md#improvement-workflow); collection size and passing cases alone are not improvement outcomes. Keep tuning and evaluation speakers separate when selecting thresholds, and add speech annotations where correctness depends on boundaries.

Twelve unmodified human audiobook recordings from six additional LibriSpeech test-clean speakers, retrieved September 28, 2026. These are recorded people, not synthesized voices. Each clip is 3–12 seconds long, in 16 kHz FLAC format. Total duration is about 81 seconds.

Source: [LibriSpeech / OpenSLR](https://www.openslr.org/12/).
License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
Attribution: LibriSpeech, Vassil Panayotov, Guoguo Chen, Daniel Povey, and Sanjeev Khudanpur; source audio from LibriVox public-domain audiobooks.

[manifest.json](manifest.json) records the archive URL, original archive paths, transcripts, durations, sample rates, and SHA-256 checksums. [SPEAKERS.TXT](SPEAKERS.TXT) preserves upstream speaker metadata. The six speakers are 1320, 5639, 260, 7729, 2094, and 3575; upstream metadata lists four male and two female speakers.

Regenerate from the repository root with `python apps/web/scripts/gather-human-speech.py`. The script streams the roughly 346 MB official archive but saves only these selected clips and metadata. It selects the first six archive speakers other than the existing speaker 6930 and the first two clips per speaker lasting 3–12 seconds.

Use these source recordings for controlled noise, clipping, and delayed-reflection simulations, keeping the originals unchanged. The existing demo synthesis and its noise/echo transformations have not been replaced. Run `node apps/web/scripts/benchmark-human-speech.mjs` and `node apps/web/scripts/report-human-speech.mjs` from the repository root to reproduce the [diagnostic report](../../../../../docs/HUMAN_SPEECH_BENCHMARK.md).

These English audiobook readings broaden speaker coverage but do not establish microphone, room, language, or conversational-speech diversity. Transcripts are upstream text, not manually annotated speech timestamps. Speech-boundary annotation, listening review, and benchmark integration remain pending. Do not treat background noise in the originals as a known zero-noise reference when constructing SNR mixtures.
