# Annotated accuracy benchmark, first stage

September 28, 2026. Completes backlog item 3's first stage: annotated speech
and explicitly retained signal/noise mixtures covering clipping and noise
stability with reproducible expected measurements. It does not complete the
broader benchmark, validate native physical SNR, or introduce an estimator
optimization. Existing fixtures are reused rather than expanding the corpus.

## Target and independent references

This stage addresses a verification weakness: previous recording diagnostics
could pass without quantifying clipping error against human speech intervals
or exposing known-component SNR error in a persistent report. The implemented
change is a reproducible accuracy runner and an ordinary fixture-acceptance
gate. Expectations are computed before analysis from source metadata, retained
components and sample indices, never inferred from app outputs.

The runner verifies source and annotation hashes and uses two distinct evidence
families; their labels are not interchangeable:

- Four [STARSS22 rooms](../apps/web/e2e/fixtures/starss22/README.md) supply upstream
  human speech/event annotations on a 100 ms grid. Frozen five-second speech
  crops and first-two-second background components use the existing
  [reference](../apps/web/e2e/fixtures/starss22/reference.json). Noise changes
  are exact component gain changes, not guesses about native recordings.
- Two [MS-SNSD sources](../apps/web/e2e/fixtures/reference-noise/README.md) supply
  upstream clean-reference components and environmental noise for 0/10/20 dB
  mixtures. The reference interval covers the whole padded source, including
  pauses. These are not human speech-boundary annotations. Original dataset
  license notices and unresolved per-file source attribution remain preserved.

STARSS22 retains development/evaluation rooms, but all four have already been
inspected. This is a regression split, not a fresh held-out accuracy claim.
No tuning or parameter selection is performed. MS-SNSD speaker identities are
unknown; no speaker-independent split is invented.

## Measurements and desired behavior

Each room has seven conditions: stationary, +12 dB, -12 dB, a 20 ms threshold
crossing inside an annotated speech interior, the same speech plus a three-second
pause, a 20 ms crossing during calibration, and no speech with a calibration
crossing. Inserted samples have magnitude 0.99. Direct enumeration independently
computes speech crossing ratio, recording-wide duration and maximal consecutive
crossing-run count. This labels near-full-scale samples, not audible distortion.
The generator preserves natural source PCM outside inserted samples.

The pause extends the same recorded background without added speech. A digital
zero tail would create a true background decrease and legitimately change noise
retry/overall grading; it is not an overall-grade invariance control. An initial
zero-tail experiment demonstrated that distinction and was corrected on reference
semantics, without changing production code or weakening noise requirements.

Clipping values must agree within 1e-12; pause extension must preserve them,
overall grade and recommendation. Calibration-only crossings must remain visible
without adding speech clipping. No-speech input must retain `NO_SPEECH`. The
three noise-component cases require stationary grading or a withheld grade with
`noise_unstable` for either change direction. Known-component SNR must be within
1 dB, using the previously defined reference tolerance.

## Results

[Results](annotated-accuracy-results.json) preserve reference intervals, source
and estimator hashes, exact constructed PCM hashes, expected/actual clipping,
stability, retry, state, grade, recommendations and SNR error.

| Check | Cases | Result |
| --- | ---: | --- |
| Known-component SNR, 0/10/20 dB | 6 | Mean absolute error 0.035 dB; maximum 0.091 dB |
| Human-annotated component cases | 28 | All exact clipping and applicable guidance gates pass |
| Of those, stationary/+12/-12 dB | 12 | Zero missed changes or stationary failures |
| Of those, pause invariance pairs | 4 pairs | Clipping, grade and recommendation unchanged |
| Calibration-only / no-speech clipping | 8 | Recording crossings retained; zero speech clipping |

The noise cases also run through actual current Silero production workers in
Chromium, separately from the supplied-annotation estimator. All twelve frozen
component expectations pass. Native source speech disagreements remain unresolved;
these worker checks do not validate the new inserted-clipping conditions or
MS-SNSD SNR against model-selected speech. No new before/after estimator benefit
is claimed: this stage implements missing reference verification.

## Reproduction and limits

```powershell
node apps/web/scripts/benchmark-annotated-accuracy.mjs
node apps/web/scripts/benchmark-annotated-accuracy.mjs --check
$env:STARSS22_NO_REPORT = '1'
node apps/web/scripts/benchmark-starss22.mjs
node apps/web/scripts/benchmark-starss22.mjs --evaluation
Remove-Item Env:STARSS22_NO_REPORT
```

`--check` runs identical gates without rewriting results. The new normal
Playwright fixture-acceptance test calls it and fails if a gate fails; it does
not skip or mark failures expected. Everything runs offline with zero Groq
calls. Supplied intervals isolate estimator correctness; the `silero` flag in
that path enables grading but does not claim neural inference. Processing flags
are estimator inputs, not measurements of source capture settings.

Next stages must quantify model-selected clipping/SNR error, speech boundary
error and precision/recall with uncertain labels excluded; preserve known
failures rather than fitting to pseudo-labels. Broader languages, devices,
processing conditions and genuinely untouched evaluation sources remain open.
Physical capture through the app remains open by user instruction to use existing
recordings only. Echo remains experimental and outside grades/purchase advice.

Validation: all 34 estimator gates, the new Playwright acceptance test, twelve
production-worker noise cases, 113 web unit tests, 21 audio-core tests, fixture
provenance verification and web production build pass. Root `npm run test` and
`npm run build` were attempted but npm is unavailable in this runtime; direct
Node entrypoints ran the web/core checks. Standalone audio-metrics build/test
remain skipped under the repository's documented workspace-resolution limitation.
