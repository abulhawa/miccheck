# Separate short decreases must not accumulate

September 29, 2026. Noise-stability follow-up for backlog item 2.

Two separate 250 ms, −9 dB noise dips could trigger `noise_unstable`, withhold
the grade and request another recording. Neither dip meets the existing 500 ms
consecutive-evidence requirement for a sustained decrease. The older 250 ms
window counter nevertheless accumulated both qualifying windows, bypassing
that duration guard. This is an implementation inconsistency under the existing
provisional policy, not a newly established perceptual retry threshold.

## Change and frozen protocol

Decreases now use only the existing consecutive disjoint-hop duration check.
The window counter and its hop corroboration count increases only. Signed
comparisons prevent lowered hops from corroborating an elevated window.
The displayed maximum change still includes decreases. Windows, acoustic
thresholds, floor, speech-boundary guards, grading and experimental echo policy
are retained.

The executable protocol is
[`benchmark-noise-separated-decrease.mjs`](../apps/web/scripts/benchmark-noise-separated-decrease.mjs).
Exact event intervals and expected labels were specified before the fix:
two 250 ms dips separated by 750 ms of unchanged noise are negative controls;
a 600 ms decrease and completed 100 ms increase are positives; stationary
noise is a negative control. Noise RMS is 0.02, with ±9 dB changes.

The estimator matrix uses 120/997 Hz carriers, three onset phases, and
16/22.05/44.1/48 kHz grids. Development uses 16 kHz; the other grids evaluate
parameter sensitivity, not held-out acoustic conditions. Supplied speech
occupies 2–4 s; noise events occur outside the guards.

Six existing licensed FLEURS recordings each supply four production-worker
conditions. Their retained recording component, including native background,
is normalized to RMS 0.04 after the two-second inserted calibration. Generated
noise is added throughout, with the events placed in an appended signal-free
tail. The exact tail reference avoids assigning native-background retry truth.
These sources have already been inspected and are regression evidence, not
untouched evaluation speakers or physical capture validation.

## Before and after

The [baseline](noise-separated-decrease-baseline.json) loads guided analysis
from commit `8fbca52ecb2606b718958a7ba5c49ddc444f549f`; other dependencies and
speech selection use the current source. The [current results](noise-separated-decrease-results.json)
use the production estimator and Silero/WASM worker. Paired PCM hashes match
for all 120 cases. Source, estimator, worker and local model hashes are recorded.

| Conditions | Cases | False retries before → after | Missed positives before → after |
| --- | ---: | ---: | ---: |
| Controlled development | 24 | 2 → 0 | 0 → 0 |
| Additional sample grids | 72 | 6 → 0 | 0 → 0 |
| Recorded-source worker regressions | 24 | 1 → 0 | 0 → 0 |

The recorded failure is the separated-dip condition on
`fleurs-de_de-10009182821551087671.wav`. All failures request noise retry before
the fix and retain grading afterward. No positive detection is lost in this
matrix. The 140-case sustained-decrease benchmark and 600-case tonal benchmark
also retain zero misses and zero control false alarms. The 324-case
low-frequency/tapered-decrease regression likewise retains zero misses and
zero false alarms.

## Reproduction and limits

From the repository root:

```powershell
$env:NOISE_SEPARATED_BASELINE_REF = '8fbca52ecb2606b718958a7ba5c49ddc444f549f'
node apps/web/scripts/benchmark-noise-separated-decrease.mjs
Remove-Item Env:NOISE_SEPARATED_BASELINE_REF
node apps/web/scripts/benchmark-noise-separated-decrease.mjs
node apps/web/scripts/benchmark-noise-separated-decrease.mjs --check
```

The baseline command deliberately exits 1 on the reproduced failures.
`--check` runs acceptance without writing reports; `--estimator-only` omits
worker conditions. Normal fixture acceptance includes the complete matrix and
fails on any mismatch. Runs stay offline; Groq/API calls: zero.

This resolves one unsupported accumulation path. It does not establish that
short decreases are perceptually harmless, validate representative duration
thresholds or settle tapered-event policy. Independent listening annotations,
new capture conditions, native retry truth and physical app capture remain open.
Keep backlog item 2 open.

Verification: 21 audio-core, 536 audio-metrics and 122 web unit tests pass with
coverage thresholds, as do both package TypeScript builds and the production
Next.js build. All eight normal fixture-acceptance tests pass, including the
new duration matrix and the existing room, clipping and SNR gates.
The PCM capture/restore/playback/comparison browser test passes
with Chromium's simulated microphone. Root `npm run test` and `npm run build`
were attempted but could not launch because `npm` is absent from this shell's
PATH. Their package commands ran directly through Node; workspace resolution
worked, so no package build/test was skipped.
