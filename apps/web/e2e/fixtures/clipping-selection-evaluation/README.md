# Clipping-selection evaluation recordings

Three 22 s mono 24 kHz PCM16 crops (66 s, 3.17 MB) from two rooms unused in
Miccheck before this evaluation, collected September 29, 2026. They evaluate
whether post-calibration crossings outside selected speech are counted and
reported with appropriate uncertainty. They do not establish speech-boundary
accuracy, general device accuracy or physical clipping audibility.

Sources: SONY–TAu Realistic Spatial Soundscapes 2022, v1.0.0,
[official release](https://zenodo.org/records/6387880). Attribution: SONY and
Tampere University; authors and redistribution terms are preserved verbatim in
[UPSTREAM_README.md](UPSTREAM_README.md) and [UPSTREAM_LICENSE](UPSTREAM_LICENSE).
These TAU recordings use the Eigenmike array format, channel 0. Participant
identities, per-clip language, browser processing and consumer-device settings
are not inferred. The split is by room, not verified speaker identity.

| Room / role | Original recording | Source seconds | Speech interiors / candidate noise |
| --- | --- | --- | --- |
| room2 / speech | fold4_room2_mix002 | 221.5–243.5 | 19.8 / 0 s |
| room4 / speech | fold3_room4_mix006 | 126.0–148.0 | 17.5 / 1.5 s |
| room4 / noise | fold3_room4_mix005 | 29.0–51.0 | 0 / 19.0 s |

The unused metadata rooms are room2, room4, room7 and room9. Metadata-only
screening showed room4 was the only one with sufficient candidate-noise
coverage under the existing 22 s rule. Reserve room4's speech/noise pair plus
room2's speech crop (the lowest numbered other unused room). Room2 has no
qualifying noise crop; no empty or mislabeled noise control is invented.
Selection maximizes upstream guarded speech/noise coverage, with metadata path
and crop onset as deterministic tie breakers and no speech labels in initial
calibration. [selection.json](selection.json) is frozen before app outputs;
[candidate.json](candidate.json) records the production change and settings
before evaluation. [manifest.json](manifest.json) retains source/crop/annotation
hashes and sample bounds. These are now frozen regression fixtures; do not reuse
them as fresh held-out evidence for later tuning.

Speech labels are upstream human-validated target-event bins at 100 ms
resolution, with 200 ms boundary guards for clipped speech interior references.
Noise candidates require domestic/instrument/water labels with guards excluding
speech, music and laughs. Unlabeled frames are not verified silence.

```powershell
python apps/web/scripts/gather-starss22-vad.py --rooms room2 room4 --speech-only-rooms room2 --output-directory clipping-selection-evaluation
python apps/web/scripts/verify-starss22-vad.py --clipping-evaluation
node apps/web/scripts/benchmark-clipping-selection.mjs --evaluation
node apps/web/scripts/benchmark-clipping-selection.mjs --evaluation --check
```

Only gathering downloads. It checks the upstream metadata MD5, ZIP member CRC,
cached source hashes and ranged responses, refusing the full 2 GB audio archive.
The complete audio archive MD5 is not verified. Cached multichannel source WAVs
are ignored under `.test-assets/starss22`; the committed mono crops preserve
source PCM. Benchmarks create transformations in memory and run offline, without
Groq calls. See [results and decision](../../../../../docs/CLIPPING_SELECTION_BENCHMARK.md).
