# STARSS22 app-length speech investigation

September 28, 2026. Target: explain the room21/room10 speech misses and assess
whether an app-length input resolves them before changing VAD or noise guards.

This is the pre-change investigation. The subsequent
[confirmed-continuation decision](VAD_CONTINUATION_BENCHMARK.md) implements a
partial improvement and preserves the remaining target misses. Reproduction
below uses the frozen pre-change VAD to retain these original trace snapshots.

## Protocol

Use the four existing checksummed 24 kHz mono source crops and upstream human
100 ms event annotations. For every contiguous speech run, start two seconds
before its onset, clamped to [0, source duration minus 22 s]; deduplicate starts.
Each input is exactly 22 seconds (2 s calibration plus up to 20 s voice).
Selection uses annotations only, with no gain, normalization, mixing, looping,
or silence insertion. Source sample hashes and local intervals are saved.
Late speech forces the crop to start earlier, so not every run starts at 2 s.

Run the actual source-bundled production worker and local Silero model in
Chromium. A diagnostic-only build sends its already-computed 32 ms probabilities
to the harness; model inputs, recurrent state, threshold and segment decisions
are unchanged. Reports distinguish production and diagnostic bundle hashes and
verify that the full-recording baseline uses the same production worker and
reference. No external model calls or new uploads occur.

Score the same conservative interiors and candidate-noise bins as the native
benchmark: exclude 200 ms around speech transitions; noise candidates require
domestic/water activity and a 500 ms collar excluding speech/laughter/music/
instruments. Compare full-recording segments restricted to exactly the same
crop against a fresh worker on that crop. This is a context comparison, not a
before/after implementation improvement. Annotation boundaries outside the crop
remain available for the collars.

The 18 crops overlap and are not 18 independent captures. Nine have annotated
speech in their first 2 s; these are contaminated-calibration diagnostics, not
valid quiet-start acceptance cases. Absence of annotations does not prove a
quiet or stable calibration. Native noise-retry truth remains unknown.

## Target results

Times below are relative to the committed native clips, not the original archive.
Both target crops have no annotated speech in their calibration interval.

| Target crop | Interior speech | Full-context matched / missed | App-length matched / missed | App-length guidance |
| --- | ---: | ---: | ---: | --- |
| room21, 38–60 s | 1.7 s | 0 / 1.7 s | 0.3 / 1.4 s | speech_too_short; 0.512 s detected |
| room10, 38–60 s | 5.8 s | 1.2 / 4.6 s | 1.3 / 4.5 s | noise_unstable; 1.536 s detected |

Room21 improves from zero speech to a short detection after resetting context,
but the miss persists at app length. Its 55.8–57.1 s annotated run (17.8–19.1 s
in the crop) has interior-frame probabilities from about 0.030 to 0.427: none
cross 0.5. Its later 58.4–59.6 s run has interior probabilities from about 0.018
to 0.848, with only 10 of 25 sampled interior frames above threshold.
The 54.1–54.4 s run is too short to contribute conservative interiors.

Room10's three annotated runs are 46–49.5, 52.5–54 and 56–58 s. Their sampled
interior model frames cross 0.5 only 21/97, 10/34 and 7/50 times, respectively;
minimum probabilities are below 0.004 in each run. These frame diagnostics are
not the 100 ms agreement measure and should not be pooled with it. Model
probabilities are model outputs, not measured speech certainty. The findings
show low model scores contribute to misses; segment grouping can also matter.
They do not establish why the model gives low scores acoustically.

Room21 has zero speech disagreements in 16.3 s of candidate-noise bins.
Room10 has zero candidate-noise bins, so it supplies no supported false-speech
check. Its native full recording was stable/graded F; the shorter crop returns
noise retry. Different calibration and context can change advice. Neither
output is an established correct/incorrect native noise retry label. The
annotation-driven estimator is a diagnostic contrast, not native noise truth.

## Other rooms and decision

Eight room6 and eight room24 crops provide context controls. In room6, missed
interiors range from 1.1 to 2.1 s per crop; room24 ranges from 0.4 to 2.1 s.
All 18 crops have zero speech predictions intersecting candidate-noise bins.
Those bins overlap across crops and exclude unknown interference: this is not
proof of no false speech. Development crops were inspected before evaluation;
no production parameter or code change occurred between splits.

Retain production VAD and noise parameters. App-length input alone does not
resolve the target misses. Lowering a threshold based on these already inspected
rooms would not demonstrate safe generalization; room10 provides no labeled
noise controls. An energy fallback would require separate speech/noise evidence.
No app optimization is claimed or implemented in this investigation.

Next actionable improvement: compare a scoped VAD/postprocessing candidate on
development speech and music/domestic controls, then evaluate missed interiors,
false-speech candidates, calibration contamination and guidance on additional
untouched rooms before adopting it. Preserve these two crops as known failure
targets, not passing accuracy gates. For room10, obtain independently supported
nonspeech intervals before claiming false-alarm safety. Native noise retries need
separate labels with uncertainty; upstream event presence cannot supply them.
Human listening, consumer devices and the physical browser capture path remain
unverified. Backlog item 2 remains open.

## Reproduction and artifacts

```powershell
node apps/web/scripts/benchmark-starss22.mjs --app-length --baseline-vad
node apps/web/scripts/benchmark-starss22.mjs --app-length --evaluation --baseline-vad
```

[Development trace](starss22-app-length-development-results.json) and
[evaluation trace](starss22-app-length-evaluation-results.json) retain source
hashes, crop bounds, annotated segments, raw probabilities, worker evidence,
guidance and same-crop full-context agreement. The original benchmark mode and
its frozen component acceptance expectations remain in place.

Validation: all 111 web unit tests passed with coverage (two workers and a
30 s test timeout). An initial default run timed out on the existing
noise-phase subprocess test while browser/build jobs were running; the rerun
passed without changing test assertions. Offline source verification and JavaScript syntax check passed.
Both existing Playwright fixture acceptance tests passed, including human
recording checks and all twelve frozen STARSS22 component cases.
Production web build passed through direct Node entrypoints. Root `npm run test`
and `npm run build` could not run because npm is absent from this runtime.
Standalone audio-metrics build/test remain skipped under the documented
workspace-resolution limitation. No Groq calls were made.
