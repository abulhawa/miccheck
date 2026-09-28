import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const alias = {
  "@miccheck/audio-core": path.join(root, "packages/audio-core/src/index.ts"),
};
const bundle = await build({
  entryPoints: [path.join(root, "packages/audio-metrics/src/guided.ts")],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  alias,
});
const { analyzeGuidedSamples } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
const context = { use_case: "meetings", device_type: "unknown", mode: "basic" };
const capture = {
  format: "pcm",
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};
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
  if (!valid || !pcm) throw new Error("Invalid reference WAV");
  return Float32Array.from(
    { length: pcm.length / 2 },
    (_, i) => pcm.readInt16LE(i * 2) / 32768,
  );
}
const worker = process.argv.includes("--worker")
  ? await (await import("./accuracy-worker.mjs")).accuracyWorker(root)
  : null;
const workerRows = [];
async function compareWorker(
  samples,
  rate,
  intervals,
  label,
  referenceClipping,
  signal,
  noise,
) {
  if (!worker) return;
  const result = await worker.analyze(samples, rate, context, capture);
  const selected = result.ai.segments;
  let tp = 0,
    fp = 0,
    fn = 0,
    signalPower = 0,
    noisePower = 0,
    count = 0;
  for (let i = 0; i < samples.length; i++) {
    const truth = intervals.some(
      (s) => i >= Math.floor(s.start * rate) && i < Math.ceil(s.end * rate),
    );
    const detected = selected.some(
      (s) => i >= Math.floor(s.start * rate) && i < Math.ceil(s.end * rate),
    );
    if (truth && detected) tp++;
    if (truth && !detected) fn++;
    if (!truth && detected) fp++;
    if (detected && signal) {
      signalPower += signal[i] ** 2;
      noisePower += noise[i % noise.length] ** 2;
      count++;
    }
  }
  const selectedReferenceDb =
    count && signalPower > 0 && noisePower > 0
      ? 10 * Math.log10(signalPower / noisePower)
      : null;
  const actual = Object.fromEntries(
    ["speechClippingRatio", "clippedDurationSeconds", "clippingEventCount"].map(
      (k) => [k, result.metrics[k]],
    ),
  );
  const recordingClippingPass =
    !referenceClipping ||
    ["clippedDurationSeconds", "clippingEventCount"].every(
      (k) => Math.abs(actual[k] - referenceClipping[k]) < 1e-12,
    );
  workerRows.push({
    ...label,
    pcmSha256: hash(new Uint8Array(samples.buffer)),
    selectedIntervals: selected,
    referenceIntervals: intervals,
    referenceIntervalKind: signal
      ? "Whole padded clean component; not speech truth"
      : "Upstream human 100 ms speech bins; boundaries quantized",
    agreement: signal
      ? null
      : {
          truePositiveSeconds: tp / rate,
          falsePositiveSeconds: fp / rate,
          falseNegativeSeconds: fn / rate,
          precision: tp + fp ? tp / (tp + fp) : null,
          recall: tp + fn ? tp / (tp + fn) : null,
        },
    boundaryDistances: signal
      ? null
      : intervals.map((reference) => {
          const overlapping = selected.filter(
            (s) => s.start < reference.end && s.end > reference.start,
          );
          return {
            reference,
            overlappingSelections: overlapping.length,
            onsetErrorSeconds: overlapping.length
              ? Math.min(...overlapping.map((s) => s.start)) - reference.start
              : null,
            offsetErrorSeconds: overlapping.length
              ? Math.max(...overlapping.map((s) => s.end)) - reference.end
              : null,
          };
        }),
    referenceClipping: referenceClipping ?? null,
    actualClipping: actual,
    speechClippingError: referenceClipping
      ? actual.speechClippingRatio - referenceClipping.speechClippingRatio
      : null,
    selectedComponentSnrDb: selectedReferenceDb,
    actualSnrDb: result.metrics.snrDb,
    selectedComponentSnrErrorDb:
      selectedReferenceDb === null
        ? null
        : result.metrics.snrDb - selectedReferenceDb,
    selectedSnrPass:
      !signal ||
      (selectedReferenceDb !== null &&
        Math.abs(result.metrics.snrDb - selectedReferenceDb) <= 1 &&
        !result.specialState),
    state: result.specialState ?? "graded",
    retry: result.evidence.retryReason ?? null,
    grade: result.specialState ? null : result.verdict.overall.grade,
    recordingClippingPass,
  });
}
try {
  const provenance = [];
  async function verified(base, entry, sha = entry.sha256) {
    const bytes = await readFile(path.join(base, entry.file));
    if (hash(bytes) !== sha)
      throw new Error(`Checksum mismatch: ${entry.file}`);
    provenance.push({ file: entry.file, sha256: sha });
    return decode(bytes, entry.sample_rate);
  }
  const rms = (a) => Math.sqrt(a.reduce((sum, x) => sum + x * x, 0) / a.length);
  const rows = [];
  const sns = path.join(root, "apps/web/e2e/fixtures/reference-noise");
  const snsManifest = JSON.parse(
    await readFile(path.join(sns, "manifest.json")),
  );
  const rate = 16000;
  const noiseSource = (
    await verified(
      sns,
      snsManifest.clips.find((c) => c.file === "AirConditioner_1.wav"),
    )
  ).slice(0, 2 * rate);
  for (const entry of snsManifest.clips.filter((c) =>
    c.file.startsWith("clnsp"),
  )) {
    const source = await verified(sns, entry);
    for (const target of [0, 10, 20]) {
      const signal = new Float32Array(
        Math.ceil(source.length / noiseSource.length) * noiseSource.length,
      );
      signal.set(source);
      const gain = 0.04 / rms(signal);
      for (let i = 0; i < signal.length; i++) signal[i] *= gain;
      const noiseGain = 0.04 / (10 ** (target / 20) * rms(noiseSource));
      const noise = Float32Array.from(noiseSource, (x) => x * noiseGain);
      const samples = Float32Array.from(
        { length: signal.length + 4 * rate },
        (_, i) =>
          noise[i % noise.length] +
          (i >= 2 * rate && i < 2 * rate + signal.length
            ? signal[i - 2 * rate]
            : 0),
      );
      if (samples.some((x) => Math.abs(x) >= 0.98))
        throw new Error("Unintended threshold crossing");
      const referenceDb = 20 * Math.log10(rms(signal) / rms(noise));
      const result = analyzeGuidedSamples(samples, rate, context, {
        quietSeconds: 2,
        speechDetection: "silero",
        segments: [{ start: 2, end: 2 + signal.length / rate }],
        capture,
      });
      await compareWorker(
        samples,
        rate,
        [{ start: 2, end: 2 + signal.length / rate }],
        { family: "component-snr", file: entry.file, targetDb: target },
        null,
        Float32Array.from({ length: samples.length }, (_, i) =>
          i >= 2 * rate && i < 2 * rate + signal.length
            ? signal[i - 2 * rate]
            : 0,
        ),
        noise,
      );
      const errorDb = result.metrics.snrDb - referenceDb;
      rows.push({
        family: "component-snr",
        file: entry.file,
        targetDb: target,
        referenceDb,
        actualDb: result.metrics.snrDb,
        errorDb,
        intervalKind:
          "Whole upstream clean source with padding; not manually annotated speech",
        passed:
          Math.abs(errorDb) <= 1 &&
          result.evidence.noiseStability === "stable" &&
          !result.specialState,
      });
    }
  }
  const star = path.join(root, "apps/web/e2e/fixtures/starss22");
  const manifestBytes = await readFile(path.join(star, "manifest.json"));
  const manifest = JSON.parse(manifestBytes);
  const refBytes = await readFile(path.join(star, "reference.json"));
  const reference = JSON.parse(refBytes);
  if (reference.manifestSha256 !== hash(manifestBytes))
    throw new Error("Reference provenance mismatch");
  for (const clip of manifest.clips) {
    const source = await verified(star, clip);
    const ref = reference.clips.find((c) => c.file === clip.file);
    const metadata = await readFile(
      path.join(star, path.basename(clip.metadata_path)),
    );
    if (hash(metadata) !== clip.metadata_sha256 || clip.sha256 !== ref.sha256)
      throw new Error("Annotation checksum mismatch");
    const speechFrames = new Set(
      metadata
        .toString()
        .trim()
        .split(/\r?\n/)
        .map((line) => line.split(",").map(Number))
        .filter(([, cls]) => cls === 0 || cls === 1)
        .map(([frame]) => frame - clip.crop_frames[0]),
    );
    const rate = clip.sample_rate,
      [a, b] = ref.speechSourceSamples;
    const active = (frame) => speechFrames.has(frame - 20 + a / (rate / 10));
    const segments = [];
    for (let f = 20; f < 70; ) {
      if (!active(f)) {
        f++;
        continue;
      }
      const start = f++;
      while (f < 70 && active(f)) f++;
      segments.push({ start: start / 10, end: f / 10 });
    }
    const interior = segments.find((s) => s.end - s.start >= 0.5);
    if (!interior) throw new Error("No annotated speech interior for clipping");
    const speechCrossing = Math.round((interior.start + 0.2) * rate);
    const rowsForClip = [];
    for (const condition of [
      "stationary",
      "increase",
      "decrease",
      "speech-clipping",
      "speech-clipping-plus-pause",
      "calibration-clipping",
      "no-speech-clipping",
    ]) {
      const samples = new Float32Array(
        Math.round(rate * (condition.endsWith("plus-pause") ? 14.5 : 11.5)),
      );
      const noise = source.subarray(...ref.noiseSourceSamples);
      // Extend the same background during the pause: digital zeros would
      // introduce a real noise decrease and invalidate overall-grade invariance.
      for (let i = 0; i < samples.length; i++) {
        const t = i / rate;
        const gain =
          t >= 7.75 && t < 10.25
            ? condition === "increase"
              ? 10 ** 0.6
              : condition === "decrease"
                ? 10 ** -0.6
                : 1
            : 1;
        samples[i] =
          condition === "no-speech-clipping"
            ? 0
            : noise[i % noise.length] * gain +
              (i >= 2 * rate && i < 7 * rate ? source[a + i - 2 * rate] : 0);
      }
      const intervals = condition === "no-speech-clipping" ? [] : segments;
      if (condition.startsWith("speech-clipping"))
        samples.fill(
          0.99,
          speechCrossing,
          speechCrossing + Math.round(0.02 * rate),
        );
      if (
        condition === "calibration-clipping" ||
        condition === "no-speech-clipping"
      )
        samples.fill(-0.99, Math.round(0.5 * rate), Math.round(0.52 * rate));
      // Independent oracle: direct sample enumeration against frozen annotation bins.
      // These labels describe threshold crossings, not measured distortion.
      let speechCount = 0,
        clippedSpeech = 0,
        clippedRecording = 0,
        events = 0,
        previous = false;
      for (let i = 0; i < samples.length; i++) {
        const isSpeech = intervals.some(
          (s) => i >= Math.floor(s.start * rate) && i < Math.ceil(s.end * rate),
        );
        const clipped = Math.abs(samples[i]) >= 0.98;
        if (isSpeech) {
          speechCount++;
          if (clipped) clippedSpeech++;
        }
        if (clipped) {
          clippedRecording++;
          if (!previous) events++;
        }
        previous = clipped;
      }
      const expected = {
        speechClippingRatio: speechCount ? clippedSpeech / speechCount : 0,
        clippedDurationSeconds: clippedRecording / rate,
        clippingEventCount: events,
      };
      const result = analyzeGuidedSamples(samples, rate, context, {
        quietSeconds: 2,
        speechDetection: "silero",
        segments: intervals,
        capture,
      });
      await compareWorker(
        samples,
        rate,
        intervals,
        {
          family: "human-annotated-components",
          file: clip.file,
          split: clip.split,
          room: clip.room,
          condition,
        },
        expected,
      );
      const changed = condition === "increase" || condition === "decrease";
      const clippingPass = Object.entries(expected).every(
        ([key, value]) => Math.abs(result.metrics[key] - value) < 1e-12,
      );
      const stabilityPass = ["stationary", "increase", "decrease"].includes(
        condition,
      )
        ? result.evidence.noiseStability ===
            (changed ? "unstable" : "stable") &&
          result.evidence.retryReason ===
            (changed ? "noise_unstable" : undefined) &&
          (changed
            ? result.specialState === "INSUFFICIENT_EVIDENCE"
            : !result.specialState)
        : true;
      rowsForClip.push({
        family: "human-annotated-components",
        file: clip.file,
        split: clip.split,
        room: clip.room,
        condition,
        sampleRate: rate,
        pcmSha256: hash(new Uint8Array(samples.buffer)),
        annotatedSpeechIntervals: intervals,
        expectedClipping: expected,
        actualClipping: Object.fromEntries(
          Object.keys(expected).map((k) => [k, result.metrics[k]]),
        ),
        stability: result.evidence.noiseStability,
        retry: result.evidence.retryReason ?? null,
        state: result.specialState ?? "graded",
        grade: result.specialState ? null : result.verdict.overall.grade,
        recommendation: result.recommendation,
        passed:
          clippingPass &&
          stabilityPass &&
          (condition !== "no-speech-clipping" ||
            result.specialState === "NO_SPEECH"),
      });
    }
    const original = rowsForClip.find((r) => r.condition === "speech-clipping");
    const paused = rowsForClip.find(
      (r) => r.condition === "speech-clipping-plus-pause",
    );
    const invariant =
      JSON.stringify(original.actualClipping) ===
        JSON.stringify(paused.actualClipping) &&
      original.grade === paused.grade &&
      JSON.stringify(original.recommendation) ===
        JSON.stringify(paused.recommendation);
    paused.pauseInvariance = invariant;
    paused.passed &&= invariant;
    rows.push(...rowsForClip);
  }
  const summary = {
    cases: rows.length,
    failures: rows.filter((r) => !r.passed).length,
    snrMeanAbsoluteErrorDb:
      rows
        .filter((r) => r.family === "component-snr")
        .reduce((s, r) => s + Math.abs(r.errorDb), 0) / 6,
    snrMaxAbsoluteErrorDb: Math.max(
      ...rows
        .filter((r) => r.family === "component-snr")
        .map((r) => Math.abs(r.errorDb)),
    ),
    clippingFailures: rows.filter(
      (r) =>
        r.expectedClipping &&
        JSON.stringify(r.expectedClipping) !== JSON.stringify(r.actualClipping),
    ).length,
  };
  const report = {
    protocol: "annotated-accuracy-v1",
    estimatorBundleSha256: hash(bundle.outputFiles[0].text),
    starssReferenceSha256: hash(refBytes),
    provenance,
    limitations: [
      "Supplied upstream 100 ms speech/event annotations; not a real Silero detector run.",
      "MS-SNSD clean designation and whole-source interval are reference components, not human speech boundaries.",
      "Constructed mixtures and inserted threshold crossings are not native physical SNR or distortion ground truth.",
      "All sources previously inspected: regression split only; no new held-out tuning claim.",
      "Raw capture flags exercise estimator confidence only; no actual browser processing or microphone validation.",
    ],
    summary,
    rows,
  };
  if (worker) {
    const workerReport = {
      protocol: "worker-accuracy-v1",
      productionWorkerSha256: worker.sha256,
      modelManifestSha256: worker.modelManifestSha256,
      starssReferenceSha256: report.starssReferenceSha256,
      estimatorBundleSha256: report.estimatorBundleSha256,
      provenance,
      limitations: [
        ...report.limitations.slice(1),
        "Worker runs actual Silero. Full-bin speech agreement includes 100 ms annotation boundary uncertainty and all overlapping classes; not verified false alarms.",
        "Selected-component SNR uses independently retained signal and noise on worker-selected samples, distinct from whole-source target SNR.",
        "Accuracy disagreements are reported, not silently accepted as accuracy gates; recording-wide clipping remains an exact acceptance gate.",
      ],
      summary: {
        cases: workerRows.length,
        recordingClippingFailures: workerRows.filter(
          (r) => !r.recordingClippingPass,
        ).length,
        speechClippingDisagreements: workerRows.filter(
          (r) =>
            r.speechClippingError !== null &&
            Math.abs(r.speechClippingError) > 1e-12,
        ).length,
        selectedSnrFailures: workerRows.filter((r) => !r.selectedSnrPass)
          .length,
        selectedSnrOverOneDb: workerRows.filter(
          (r) =>
            r.selectedComponentSnrErrorDb !== null &&
            Math.abs(r.selectedComponentSnrErrorDb) > 1,
        ).length,
      },
      rows: workerRows,
    };
    if (!process.argv.includes("--check"))
      await writeFile(
        path.join(root, "docs/worker-accuracy-results.json"),
        JSON.stringify(workerReport, null, 2) + "\n",
      );
    console.log(JSON.stringify(workerReport.summary));
    if (
      workerReport.summary.recordingClippingFailures ||
      workerRows.some((r) => !r.selectedSnrPass)
    )
      process.exitCode = 1;
  }
  if (!process.argv.includes("--check") && !worker)
    await writeFile(
      path.join(root, "docs/annotated-accuracy-results.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
  console.log(JSON.stringify(summary));
  if (summary.failures) process.exitCode = 1;
} finally {
  await worker?.close();
}
