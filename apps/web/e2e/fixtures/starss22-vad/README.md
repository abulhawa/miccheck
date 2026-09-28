# STARSS22 speech-continuation evaluation

Six unmodified 22 s, 24 kHz PCM16 mono crops from three rooms unused in the
original Miccheck STARSS22 pilot. These were reserved before model outputs;
they are now reusable regression evidence, not a fresh tuning/evaluation set.

Source: SONY–TAu Realistic Spatial Soundscapes 2022, v1.0.0,
[official release](https://zenodo.org/records/6387880). Authors and license are
preserved in [UPSTREAM_README.md](UPSTREAM_README.md) and
[UPSTREAM_LICENSE](UPSTREAM_LICENSE). The same attribution and redistribution
terms as the [original pilot](../starss22/README.md) apply. No consumer-device or
browser-processing-off claim is made.

| Room | Role | Original source | Source seconds | Speech interiors / candidate noise |
| --- | --- | --- | --- | --- |
| room22, SONY | speech | fold3_room22_mix004 | 11.5–33.5 | 19.2 / 0 s |
| room22, SONY | noise | fold3_room22_mix008 | 21.1–43.1 | 0 / 22 s |
| room23, SONY | speech | fold4_room23_mix007 | 66.7–88.7 | 19.1 / 0 s |
| room23, SONY | noise | fold4_room23_mix010 | 7.8–29.8 | 0 / 22 s |
| room8, TAU | speech | fold4_room8_mix001 | 167.0–189.0 | 19.8 / 0 s |
| room8, TAU | instruments | fold4_room8_mix003 | 120.0–142.0 | 0 / 22 s |

[selection.json](selection.json) freezes annotation-only maximization of
speech interiors and candidate-noise coverage per room, with no annotated
speech in the first 2 s. [manifest.json](manifest.json) records exact source
sample bounds, source/crop/metadata hashes and archive members. First source
channel only; no gain, resampling, normalization, mixing or inserted silence.
Metadata CSVs are verbatim upstream files in source time (100 ms frames).

Speech interiors exclude 200 ms at transitions. Candidate noise requires
domestic/water/instrument labels throughout a 500 ms collar, excluding
speech/laughter/music. Instrument labels support candidate controls; music
playback with possible vocals remains uncertain. Empty metadata never proves
nonspeech. Upstream interference annotations are incomplete. Absolute source
SNR, native noise retry truth and exact word boundaries are unknown.

[candidate.json](candidate.json) freezes the continuation rule and segmentation
function/model hashes before evaluation. [silero-baseline.ts](silero-baseline.ts)
preserves the previous segmentation implementation for reproducible real-worker
before/after runs; it is not imported by the app.

```powershell
python apps/web/scripts/gather-starss22-vad.py
python apps/web/scripts/verify-starss22-vad.py
node apps/web/scripts/benchmark-vad-continuation.mjs
node apps/web/scripts/benchmark-vad-continuation.mjs --evaluation
node apps/web/scripts/benchmark-vad-continuation.mjs --regression
```

Only gathering downloads. It checks the metadata archive MD5, ZIP member CRC,
cached source hashes and range responses, refusing the full 2 GB audio archive.
The full upstream audio archive MD5 is not verified. Original multichannel WAVs
are cached in ignored `.test-assets/starss22`; committed mono WAVs total 6.34 MB.
All verification and benchmark commands are offline with installed local
assets. `VAD_NO_REPORT=1` retains report snapshots during fixture acceptance.

See [decision and limitations](../../../../../docs/VAD_CONTINUATION_BENCHMARK.md).
