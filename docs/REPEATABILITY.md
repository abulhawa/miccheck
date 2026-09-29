# Within-setup repeatability protocol v1

Status: capture/export and descriptive evaluation support implemented; **physical
recordings pending**. No observed physical variability or meaningful-change
threshold is claimed. Echo remains deferred and excluded.

## Infrastructure review and decision

`useAudioRecorder.ts` already performs a three-second room check, retains the
microphone during preparation, joins calibration and speech PCM, analyzes with
the local production worker, and saves a paired WAV/result through
`recordingSession.ts`. `TestExperiencePage.tsx` supplies a fixed localized passage
and before/after playback. `comparableTakes` guards comparisons using device,
context, processing, speech engine and usable noise evidence. These guards do
not establish statistical significance. Its displayed clipping delta uses the
recording-wide ratio; this protocol instead records explicit speech-only clipping
and total crossing duration, avoiding pause dilution in interpretation.

The existing `accuracy-worker.mjs` verifies local models and provides production
worker evaluation to several benchmarks. Its new `--repeatability` mode consumes
saved production app results, preserving exact exports and audio hashes; it
does not create another capture path/server or annotation pipeline. Saved WAVs
are 16-bit playback representations of analyzed float PCM: do not claim exact
reanalyzed clipping equivalence. Existing fixture acceptance and capture/browser
replay remain regression checks, not physical repeatability evidence.

## Recordings needed

Collect **ten consecutive physical microphone takes in one session and setup**.
Ten is a pilot design choice, not a reliability gate. One practice take precedes
the session and is not analyzed. Include every planned take, including retry
outcomes; do not replace poor scores. If interrupted or conditions change, record
why and begin a separate setup group. Do not pool groups. No datasets or external
inference calls are required.

Hold constant: speaker, exact displayed passage and language, natural speaking
effort/pace, seated posture, marked microphone distance/angle and placement,
microphone/interface, gain, OS input/enhancement settings, browser/version,
sample rate, channel count, processing settings, room/background sources,
app commit/models, analysis context and optional sound classification (off).
Use processing off for this initial group and verify actual track settings;
unknown or enabled settings require a separate documented group, not an assumed
unprocessed result. Device IDs and browser settings cannot prove physical source
or unchanged room/gain; the operator must attest to these.

Repeat the entire existing room-check/voice procedure, including a fresh quiet
calibration each time. Prepare silently, read the displayed passage verbatim at
normal pace (aim 10–15 seconds without forcing speed), leave two seconds quiet
after speaking, then finish within the existing 20-second voice limit. Record
truncation, coughs, interruptions or deviations; retain them as outcomes. This
measures end-to-end within-session variability including normal vocal variation,
calibration and segmentation, not pure instrument noise or across-day variability.

After each take choose **Download take and measurements** before starting the
next. Retain all ten JSON downloads locally; each contains audio and device
metadata. Obtain speaker consent before sharing. Nothing is uploaded by export.
Demo, injected WAV, virtual-microphone and synthetic takes are tooling checks
only and must not be declared physical evidence.

## Reproduce evaluation

Create a local manifest alongside the exports (do not commit personal audio):

```json
{
  "protocol": "miccheck-repeatability-v1",
  "source": "physical-microphone",
  "appCommit": "actual git commit used for capture",
  "setup": {
    "speaker": "consented pseudonym",
    "microphone": "model and interface",
    "distanceCm": 20,
    "angle": "actual placement",
    "gain": "actual fixed setting",
    "room": "room/background sources",
    "browserOs": "versions",
    "processing": "OS enhancements and actual browser settings",
    "deviations": []
  },
  "files": ["take01.json", "take02.json", "take03.json", "take04.json", "take05.json", "take06.json", "take07.json", "take08.json", "take09.json", "take10.json"]
}
```

Distance above is an example to replace with the actual setup, not a recommended
measurement threshold. Run from the repository root:

```powershell
node apps/web/scripts/accuracy-worker.mjs --repeatability path/to/manifest.json path/to/report.json
```

The evaluator rejects duplicate IDs/audio and differences in passage, device,
reported capture details and context. Source type is explicitly operator-declared;
audio alone cannot establish physical provenance. Preserve commit, model manifest
from that checkout, take order, timestamps, hashes and setup notes with the report.

## Summary and next decision

Compare speech RMS (dBFS), SNR (dB), speech clipping (fraction; multiply by 100
for percentage points), total near-full-scale crossing duration (seconds), hum
ratio, and detected speech duration. Keep speech/no-speech, retry/special state,
noise stability, certainty and grades as categorical outcomes. Echo is excluded.
Unavailable metrics produce a null summary rather than fabricated zeros.

For each numeric metric report n, mean, median, sample standard deviation,
min/max/range, and every absolute unordered pair difference. Report all takes
and a separate usable-evidence subset (no special state, reliable stable noise,
PCM capture and all three browser processing settings explicitly off).
Show excluded IDs and outcomes; examine whether exclusions bias the subset.
Ten takes yield 45 dependent pairs, **not 45 independent samples**. Preserve
order to inspect drift and speech-duration/segmentation changes before pooling.
These are descriptive summaries, not confidence intervals or significance tests.

After collection, review actual spread, outliers and failure outcomes. A specific
repeatability failure may justify focused Section 2/3 evidence; merely having
open validation boxes does not. A later separate unchanged session and reserved
evaluation captures are needed before adopting comparison uncertainty or
minimum-duration/precision gates. Changed-setup comparisons must distinguish
intentional setup change from confounds. No threshold tuning, “no clear change”
rule or population generalization is authorized by an uncollected ten-take pilot.
