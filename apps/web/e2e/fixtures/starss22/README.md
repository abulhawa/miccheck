# STARSS22 real-room pilot

Four selected microphone-array recordings from Sony–TAu Realistic Spatial
Soundscapes 2022, version 1.0.0, [official release](https://zenodo.org/records/6387880).
Attribution: SONY and Tampere University; Archontis Politis, Yuki Mitsufuji,
Parthasaarathy Sudarsanam, Kazuki Shimada, Sharath Adavanne, Yuichiro Koyama,
Daniel Krause, Naoya Takahashi, Shusuke Takahashi, and Tuomas Virtanen.
The release's [license](UPSTREAM_LICENSE) and [documentation](UPSTREAM_README.md)
are preserved verbatim. Its supplied license grants redistribution with the
copyright/permission notice retained; no Freesound or inferred per-file license
has been substituted.

## Why these clips

The next noise-stability investigation needs actual recorded background events,
independently labeled speech, and rooms that were not used for prior Miccheck
development. These clips supply human-validated target-event annotations and
natural speech/noise overlap. The two sites and four rooms broaden acoustic
conditions. They use the same Eigenmike recording system family, so they do
not establish consumer microphone diversity or browser processing behavior.

Selection is frozen using upstream metadata before examining Miccheck outputs.
Within each upstream site/split, choose the longest annotated speech-free
domestic/water/music run in a crop of at most 60 s with at least 2 s of later
annotated speech and 2 s initially containing no annotated target event.
Tie by metadata path, crop onset, then event onset. No threshold fitting or
app-output selection was performed. The candidate classes were domestic sounds
(5), music (8), and water (10); no water clip won the selection rule.

| Clip | Miccheck split | Source interval (s) | Selected event in local clip (s) |
| --- | --- | --- | --- |
| fold3_room21_mix023 | Development, SONY room21 | 10.8–70.8 | Domestic 22.0–54.1 |
| fold3_room6_mix007 | Development, TAU room6 | 49.5–109.5 | Domestic 31.0–60.0 |
| fold4_room24_mix011 | Evaluation, SONY room24 | 13.2–63.3 | Domestic 29.4–50.1 |
| fold4_room10_mix003 | Evaluation, TAU room10 | 0.0–60.0 | Music 7.5–44.0 |

Domestic is an upstream umbrella class including fan, vacuum, and boiling
sounds. Do not assign a particular appliance to these clips without supporting
annotation/listening evidence. An event's full source run may extend beyond
the crop; local endpoints in the table are observation bounds, not necessarily
the event's complete onset and recovery. Keep evaluation rooms out of parameter
selection. Selection was frozen before inspecting Miccheck outputs. Both splits
have now been evaluated without intervening parameter changes; future tuning
needs an additional untouched evaluation set.

## Files and reproducibility

The WAVs are 24 kHz PCM16 mono: the first channel of the official MIC format,
cropped without amplification, mixing, looping, normalization, or resampling.
Total duration is 230.1 s and WAV size is 11,044,976 bytes (about 11 MB).
The original four-channel member and its hash are retained in a local ignored
cache, rather than duplicating them in the repository.

[manifest.json](manifest.json) records archive paths, source/crop hashes, exact
source sample bounds, metadata hashes, selection, rooms, and splits. CSV files
are unmodified source metadata, so their frame numbers are in **source time**.
Each frame is 100 ms. To convert to local time, subtract
`source_samples[0] / sample_rate` from `frame / 10`.

From the repository root:

```powershell
python apps/web/scripts/gather-starss22.py
python apps/web/scripts/verify-starss22.py
```

The gatherer verifies the official metadata archive MD5 and fetches selected
audio members with HTTP ranges, checking ZIP member CRCs. It refuses servers
that would return the full 2.1 GB audio archive. Completed sources are cached
under `apps/web/.test-assets/starss22`; repeat runs preserve source-hash checks.
The whole audio archive's upstream MD5 is recorded but **not verified**, because
only individual members are downloaded. Offline verification checks committed
audio/metadata hashes, PCM format, crop lengths, annotation-based selection,
and room separation. No Groq calls or paid services are needed.

## Interpretation and next experiment

The first 2 s are candidate calibration, based on absence of annotated target
events. The dataset explicitly contains unannotated interference and ambient
HVAC: empty CSV frames do not prove silence or constant background noise.
Speech-free event labels similarly mean no annotated speech/laughter; they
do not prove absence of all voices. Boundary accuracy is limited by the
100 ms annotation grid, which cannot settle 20–90 ms transient policy.

The [production-worker comparison](../../../../../docs/STARSS22_NOISE_BENCHMARK.md)
now reports all four native clips and twelve constructed recorded-component
cases. Those cases retain stationary grading and correctly retry exact +12/−12
dB changes. Native full-recording noise retry truth remains unknown; native
speech-selection disagreements are preserved for investigation. No estimator
parameter changed. A frozen [reference](reference.json) defines the source
components and expectations independently of worker outputs.

For the next native-labeling investigation, compare selected
speech with conservative interiors of the upstream speech/event intervals.
Check noise-only level changes against independently selected calibration
windows. Event presence alone does not establish a >6 dB change or a required
retry: music may already be present and stable during calibration. Freeze
independent retry labels with uncertainty before tuning. Only then evaluate
the reserved rooms and report missed changes, false retries, and resulting
grades/advice. Original signal/noise components are unavailable, so absolute
source SNR ground truth cannot be inferred from these recordings.

This corpus selection is supporting work, not a demonstrated app improvement
or completion of backlog point 2. It provides real physical room captures;
end-to-end browser capture and processing still require separate validation.
