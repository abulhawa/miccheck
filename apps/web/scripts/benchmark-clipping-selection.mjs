import { accuracyWorker } from "./accuracy-worker.mjs";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const context = { use_case: "meetings", device_type: "unknown", mode: "basic" };
const capture = {
  format: "pcm",
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};
const baselineBytes = await readFile(
  path.join(
    root,
    "apps/web/e2e/fixtures/clipping-selection/guided-baseline.ts",
  ),
);
const baselineBundle = await build({
  entryPoints: [path.join(root, "packages/audio-metrics/src/guided.ts")],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  alias: {
    "@miccheck/audio-core": path.join(root, "packages/audio-core/src/index.ts"),
  },
  plugins: [
    {
      name: "frozen-guided-baseline",
      setup(b) {
        b.onLoad({ filter: /[\\/]guided\.ts$/ }, () => ({
          contents: baselineBytes.toString(),
          loader: "ts",
        }));
      },
    },
  ],
});
const { analyzeGuidedSamples: baselineAnalyze } = await import(
  `data:text/javascript;base64,${Buffer.from(baselineBundle.outputFiles[0].text).toString("base64")}`
);
function decode(bytes, rate) {
  let pcm,
    valid = false;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const kind = bytes.toString("ascii", offset, offset + 4),
      size = bytes.readUInt32LE(offset + 4);
    if (offset + 8 + size > bytes.length) throw new Error("Truncated WAV");
    if (kind === "fmt ")
      valid =
        bytes.readUInt16LE(offset + 8) === 1 &&
        bytes.readUInt16LE(offset + 10) === 1 &&
        bytes.readUInt32LE(offset + 12) === rate &&
        bytes.readUInt16LE(offset + 22) === 16;
    if (kind === "data") pcm = bytes.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  if (!valid || !pcm) throw new Error("Invalid mono reference WAV");
  return Float32Array.from(
    { length: pcm.length / 2 },
    (_, i) => pcm.readInt16LE(i * 2) / 32768,
  );
}
function speechSegments(metadata, startFrame, seconds) {
  const frames = new Set(
    metadata
      .toString()
      .trim()
      .split(/\r?\n/)
      .map((line) => line.split(",").map(Number))
      .filter(([, cls]) => cls === 0 || cls === 1)
      .map(([f]) => f - startFrame),
  );
  const result = [];
  for (let f = 0; f < Math.floor(seconds * 10); ) {
    if (!frames.has(f)) {
      f++;
      continue;
    }
    const start = f++;
    while (f < Math.floor(seconds * 10) && frames.has(f)) f++;
    result.push({ start: start / 10, end: f / 10 });
  }
  return result;
}
const star = path.join(root, "apps/web/e2e/fixtures/starss22");
const manifestBytes = await readFile(path.join(star, "manifest.json"));
const referenceBytes = await readFile(path.join(star, "reference.json"));
const manifest = JSON.parse(manifestBytes),
  reference = JSON.parse(referenceBytes);
if (reference.manifestSha256 !== sha(manifestBytes))
  throw new Error("Changed frozen reference");
const sources = [];
const provenance = [];
async function verified(base, clip, rate, metadataHash) {
  const bytes = await readFile(path.join(base, clip.file));
  const metadata = await readFile(
    path.join(base, path.basename(clip.metadata_path)),
  );
  if (sha(bytes) !== clip.sha256 || sha(metadata) !== metadataHash)
    throw new Error("Source or label checksum mismatch");
  provenance.push({
    file: clip.file,
    sha256: sha(bytes),
    metadataSha256: sha(metadata),
  });
  return { source: decode(bytes, rate), metadata };
}
for (const clip of manifest.clips) {
  const rate = clip.sample_rate;
  const { source, metadata } = await verified(
    star,
    clip,
    rate,
    clip.metadata_sha256,
  );
  const ref = reference.clips.find((c) => c.file === clip.file);
  const [a] = ref.speechSourceSamples;
  const noise = source.subarray(...ref.noiseSourceSamples);
  const samples = Float32Array.from(
    { length: rate * 11.5 },
    (_, i) =>
      noise[i % noise.length] +
      (i >= 2 * rate && i < 7 * rate ? source[a + i - 2 * rate] : 0),
  );
  const intervals = speechSegments(
    metadata,
    clip.crop_frames[0] + a / (rate / 10) - 20,
    7,
  )
    .filter((s) => s.end > 2)
    .map((s) => ({ start: Math.max(2, s.start), end: s.end }));
  sources.push({
    file: clip.file,
    room: clip.room,
    split: clip.split,
    rate,
    samples,
    intervals,
    role: "speech",
    inputKind: "Frozen repeated-noise plus five-second source excerpt",
  });
}
if (!process.argv.includes("--pilot")) {
  const base = path.join(root, "apps/web/e2e/fixtures/starss22-vad");
  const bytes = await readFile(path.join(base, "manifest.json"));
  provenance.push({ file: "starss22-vad/manifest.json", sha256: sha(bytes) });
  for (const clip of JSON.parse(bytes).clips) {
    const { source, metadata } = await verified(
      base,
      clip,
      clip.sampleRate,
      clip.metadataSha256,
    );
    sources.push({
      file: clip.file,
      room: clip.room,
      split: "additional-regression",
      rate: clip.sampleRate,
      samples: source,
      intervals: speechSegments(metadata, clip.startFrame, 22),
      role: clip.role,
      inputKind: "Unmodified contiguous 22 second source crop",
    });
  }
}
let evaluationProtocol = null;
if (process.argv.includes("--evaluation")) {
  if (process.argv.includes("--pilot"))
    throw new Error("Choose pilot or evaluation");
  const base = path.join(
    root,
    "apps/web/e2e/fixtures/clipping-selection-evaluation",
  );
  const bytes = await readFile(path.join(base, "manifest.json"));
  const frozen = JSON.parse(bytes);
  const selectionBytes = await readFile(path.join(base, "selection.json"));
  evaluationProtocol = JSON.parse(
    await readFile(path.join(base, "candidate.json")),
  );
  if (
    JSON.stringify(frozen.protocol) !==
      JSON.stringify(JSON.parse(selectionBytes)) ||
    sha(selectionBytes) !== evaluationProtocol.selectionSha256 ||
    sha(baselineBytes) !== evaluationProtocol.baselineGuidedSha256 ||
    frozen.clips.length !== 3
  )
    throw new Error("Frozen evaluation protocol mismatch");
  provenance.push({
    file: "clipping-selection-evaluation/manifest.json",
    sha256: sha(bytes),
  });
  for (const clip of frozen.clips) {
    const { source, metadata } = await verified(
      base,
      clip,
      clip.sampleRate,
      clip.metadataSha256,
    );
    sources.push({
      file: clip.file,
      room: clip.room,
      split: "held-out-evaluation",
      rate: clip.sampleRate,
      samples: source,
      intervals: speechSegments(metadata, clip.startFrame, 22),
      role: clip.role,
      inputKind: "Unmodified contiguous 22 second source crop",
    });
  }
}
const mode = process.argv.includes("--evaluation")
  ? "evaluation"
  : process.argv.includes("--pilot")
    ? "pilot"
    : "all";
const worker = await accuracyWorker(root);
const rows = [];
try {
  for (const source of sources.filter((s) =>
    mode === "evaluation"
      ? s.split === "held-out-evaluation"
      : mode !== "pilot" || s.split === "development",
  )) {
    const { rate, intervals } = source;
    const interior = intervals.find((s) => s.end - s.start >= 0.5);
    const conditions =
      source.role === "speech"
        ? [
            "original",
            "flat-crossing",
            "hard-clipped-speech",
            "tail-crossing",
            "calibration-crossing",
          ]
        : ["original", "hard-clipped-noise"];
    for (const condition of conditions) {
      let samples = source.samples.slice();
      let appendedBackgroundSeconds = 0;
      if (
        condition === "tail-crossing" &&
        source.inputKind.startsWith("Unmodified")
      ) {
        const extended = new Float32Array(
          samples.length + Math.round(0.5 * rate),
        );
        extended.set(samples);
        extended.set(
          samples.subarray(0, Math.round(0.5 * rate)),
          samples.length,
        );
        samples = extended;
        appendedBackgroundSeconds = 0.5;
      }
      let gain = null,
        transformIntervals = [];
      if (condition === "flat-crossing") {
        if (!interior) throw new Error("Missing reference speech interior");
        const start = Math.round((interior.start + 0.2) * rate);
        samples.fill(0.99, start, start + Math.round(0.02 * rate));
        transformIntervals = [
          {
            start: start / rate,
            end: (start + Math.round(0.02 * rate)) / rate,
          },
        ];
      }
      if (
        condition === "hard-clipped-speech" ||
        condition === "hard-clipped-noise"
      ) {
        // Select transformation spans from upstream labels before model inference.
        // Guard speech boundaries by 200 ms; native acoustics inside remain intact.
        transformIntervals =
          condition === "hard-clipped-speech"
            ? intervals
                .filter((s) => s.end - s.start >= 0.5)
                .map((s) => ({ start: s.start + 0.2, end: s.end - 0.2 }))
            : [{ start: 3, end: 5 }];
        let peak = 0;
        for (const s of transformIntervals)
          for (
            let i = Math.ceil(s.start * rate);
            i < Math.floor(s.end * rate);
            i++
          )
            peak = Math.max(peak, Math.abs(samples[i]));
        if (!peak) throw new Error("Cannot hard-clip zero source");
        gain = 4 / peak;
        for (const s of transformIntervals)
          for (
            let i = Math.ceil(s.start * rate);
            i < Math.floor(s.end * rate);
            i++
          )
            samples[i] = Math.max(-0.99, Math.min(0.99, samples[i] * gain));
      }
      if (
        condition === "tail-crossing" ||
        condition === "calibration-crossing"
      ) {
        const start =
          condition === "tail-crossing"
            ? samples.length - Math.round(0.25 * rate)
            : Math.round(0.5 * rate);
        samples.fill(-0.99, start, start + Math.round(0.02 * rate));
        transformIntervals = [
          {
            start: start / rate,
            end: (start + Math.round(0.02 * rate)) / rate,
          },
        ];
      }
      const result = await worker.analyze(samples, rate, context, capture);
      const baseline = baselineAnalyze(samples, rate, context, {
        quietSeconds: 2,
        speechDetection: "silero",
        segments: result.ai.segments,
        capture,
      });
      let total = 0,
        calibration = 0,
        selected = 0,
        unselected = 0,
        annotatedInterior = 0,
        missedInterior = 0;
      for (let i = 0; i < samples.length; i++) {
        if (Math.abs(samples[i]) < 0.98) continue;
        total++;
        if (i < 2 * rate) {
          calibration++;
          continue;
        }
        const detected = result.ai.segments.some(
          (s) => i >= Math.floor(s.start * rate) && i < Math.ceil(s.end * rate),
        );
        if (detected) selected++;
        else unselected++;
        if (
          intervals.some(
            (s) =>
              i >= Math.ceil((s.start + 0.2) * rate) &&
              i < Math.floor((s.end - 0.2) * rate),
          )
        ) {
          annotatedInterior++;
          if (!detected) missedInterior++;
        }
      }
      const summary = (r) => ({
        state: r.specialState ?? "graded",
        grade: r.specialState ? null : r.verdict.overall.grade,
        certainty: r.verdict.diagnosticCertainty,
        speechClippingRatio: r.metrics.speechClippingRatio,
        unselectedClippedDurationSeconds:
          r.metrics.unselectedClippedDurationSeconds ?? null,
        recommendation: r.recommendation,
      });
      const expectedDuration = unselected / rate;
      const gates = {
        exactRecordingClipping:
          Math.abs(result.metrics.clippedDurationSeconds - total / rate) <
          1e-12,
        exactUnselectedClipping:
          Math.abs(
            (result.metrics.unselectedClippedDurationSeconds ?? NaN) -
              expectedDuration,
          ) < 1e-12,
        certaintyLimited:
          !unselected || result.verdict.diagnosticCertainty === "low",
        certaintyPreservedForControls:
          !!unselected ||
          baseline.verdict.diagnosticCertainty ===
            result.verdict.diagnosticCertainty,
        preservedGradeAndAdvice:
          baseline.specialState === result.specialState &&
          baseline.verdict.overall.grade === result.verdict.overall.grade &&
          JSON.stringify(baseline.recommendation) ===
            JSON.stringify(result.recommendation),
      };
      rows.push({
        file: source.file,
        room: source.room,
        split: source.split,
        role: source.role,
        inputKind: source.inputKind,
        condition,
        rate,
        pcmSha256: sha(new Uint8Array(samples.buffer)),
        appendedBackgroundSeconds,
        gain,
        transformIntervals,
        annotatedSpeechIntervals: intervals,
        selectedIntervals: result.ai.segments,
        exactCounts: { total, calibration, selected, unselected },
        annotatedInteriorCrossings: annotatedInterior,
        missedAnnotatedInteriorCrossings: missedInterior,
        baseline: summary(baseline),
        current: summary(result),
        gates,
      });
      console.log(
        `${source.room}/${condition}: interior misses=${missedInterior}/${annotatedInterior}, unselected=${unselected}, certainty=${baseline.verdict.diagnosticCertainty}->${result.verdict.diagnosticCertainty}`,
      );
    }
  }
  const summary = {
    cases: rows.length,
    failures: rows.filter((r) => Object.values(r.gates).some((v) => !v)).length,
    unsupportedMediumBefore: rows.filter(
      (r) => r.exactCounts.unselected && r.baseline.certainty === "medium",
    ).length,
    unsupportedMediumAfter: rows.filter(
      (r) => r.exactCounts.unselected && r.current.certainty === "medium",
    ).length,
    hardClippedSpeechWithMissedInteriors: rows.filter(
      (r) =>
        r.condition === "hard-clipped-speech" &&
        r.missedAnnotatedInteriorCrossings,
    ).length,
  };
  const report = {
    protocol: "clipping-selection-v1",
    mode,
    evaluationProtocol,
    baselineGuidedSha256: sha(baselineBytes),
    productionWorkerSha256: worker.sha256,
    modelManifestSha256: worker.modelManifestSha256,
    referenceSha256: sha(referenceBytes),
    provenance,
    summary,
    rows,
    limitations: [
      "Frozen previous estimator evaluated on unchanged actual worker-selected intervals; no baseline VAD substitution.",
      "Upstream speech bins are human event labels at 100 ms resolution; guarded interiors reduce but do not remove annotation uncertainty.",
      "Digital hard clipping transforms recorded speech; not physical capture or a validated audibility threshold.",
      mode === "evaluation"
        ? "Rooms reserved by annotations before model outputs; same microphone-array format. Participant identities unknown; not a speaker-independent split."
        : "Previously inspected sources; additional rooms are regression condition transfer, not untouched evaluation.",
      "Noise controls are upstream non-speech candidates, not exhaustive truth. Gain is derived from reference spans, never app outputs.",
    ],
  };
  if (!process.argv.includes("--check"))
    await writeFile(
      path.join(root, `docs/clipping-selection-${mode}-results.json`),
      JSON.stringify(report, null, 2) + "\n",
    );
  console.log(JSON.stringify(summary));
  if (summary.failures) process.exitCode = 1;
} finally {
  await worker.close();
}
