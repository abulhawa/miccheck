import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { accuracyWorker } from "./accuracy-worker.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const folder = path.join(root, "apps/web/e2e/fixtures/accuracy-expansion");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifestBytes = await readFile(path.join(folder, "manifest.json"));
const manifest = JSON.parse(manifestBytes);
for (const [name, expected] of Object.entries(
  manifest.annotationSnapshotSha256,
)) {
  if (hash(await readFile(path.join(folder, name))) !== expected)
    throw new Error("Annotation snapshot checksum mismatch: " + name);
}
const context = { use_case: "meetings", device_type: "unknown", mode: "basic" };
const capture = {
  format: "pcm",
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};
const bundle = await build({
  entryPoints: [path.join(root, "packages/audio-metrics/src/guided.ts")],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  alias: {
    "@miccheck/audio-core": path.join(root, "packages/audio-core/src/index.ts"),
  },
});
const { analyzeGuidedSamples } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

function decode(bytes, rate) {
  let pcm,
    valid = false;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const size = bytes.readUInt32LE(offset + 4),
      kind = bytes.toString("ascii", offset, offset + 4);
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
  if (!valid || !pcm) throw new Error("Invalid expansion WAV");
  return Float32Array.from(
    { length: pcm.length / 2 },
    (_, i) => pcm.readInt16LE(i * 2) / 32768,
  );
}
const rms = (samples) =>
  Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
function oracle(samples, rate, segments) {
  const mask = new Uint8Array(samples.length);
  for (const s of segments)
    mask.fill(
      1,
      Math.max(2 * rate, Math.floor(s.start * rate)),
      Math.min(samples.length, Math.ceil(s.end * rate)),
    );
  let recording = 0,
    selected = 0,
    selectedClips = 0,
    unselected = 0,
    events = 0,
    previous = false;
  for (let i = 0; i < samples.length; i++) {
    const crossing = Math.abs(samples[i]) >= 0.98;
    if (crossing) {
      recording++;
      if (!previous) events++;
    }
    if (mask[i]) {
      selected++;
      if (crossing) selectedClips++;
    } else if (i >= 2 * rate && crossing) unselected++;
    previous = crossing;
  }
  return {
    clippedDurationSeconds: recording / rate,
    clippingEventCount: events,
    speechClippingRatio: selected ? selectedClips / selected : 0,
    unselectedClippedDurationSeconds: unselected / rate,
  };
}
function agreement(samples, rate, truth, selected) {
  if (!truth) return null;
  const labels = new Uint8Array(samples.length),
    actual = new Uint8Array(samples.length);
  for (const s of truth)
    labels.fill(1, Math.floor(s[0] * rate), Math.ceil(s[1] * rate));
  for (const s of selected)
    actual.fill(1, Math.floor(s.start * rate), Math.ceil(s.end * rate));
  let tp = 0,
    fp = 0,
    fn = 0;
  for (let i = 2 * rate; i < samples.length; i++) {
    if (labels[i] && actual[i]) tp++;
    if (!labels[i] && actual[i]) fp++;
    if (labels[i] && !actual[i]) fn++;
  }
  return {
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null,
    falsePositiveSeconds: fp / rate,
    falseNegativeSeconds: fn / rate,
    boundaryErrors: truth.map(([start, end]) => {
      const overlaps = selected.filter((s) => s.start < end && s.end > start);
      return {
        start,
        end,
        onsetError: overlaps.length
          ? Math.min(...overlaps.map((s) => s.start)) - start
          : null,
        offsetError: overlaps.length
          ? Math.max(...overlaps.map((s) => s.end)) - end
          : null,
      };
    }),
  };
}
const worker = await accuracyWorker(root);
const rows = [];
async function run(clip, samples, condition, components) {
  const rate = clip.sampleRate;
  const result = await worker.analyze(samples, rate, context, capture);
  const segments = result.ai.segments;
  const exact = oracle(samples, rate, segments);
  const annotationClipping = clip.speechIntervals
    ? oracle(
        samples,
        rate,
        clip.speechIntervals.map(([start, end]) => ({ start, end })),
      )
    : null;
  const clippingPass = Object.entries(exact).every(
    ([k, v]) => Math.abs(result.metrics[k] - v) < 1e-12,
  );
  const confidencePass =
    !exact.unselectedClippedDurationSeconds ||
    result.specialState ||
    result.verdict.diagnosticCertainty === "low";
  const noSpeechPass =
    clip.corpus !== "Generated" || result.specialState === "NO_SPEECH";
  let referenceSnr = null,
    estimatorSnr = null,
    estimatorStability = null;
  if (components) {
    let signalPower = 0,
      noisePower = 0,
      selectedSamples = 0;
    for (const segment of segments)
      for (
        let i = Math.max(2 * rate, Math.floor(segment.start * rate));
        i < Math.min(samples.length, Math.ceil(segment.end * rate));
        i++
      ) {
        signalPower += components.signal[i] ** 2;
        noisePower += components.noise[i] ** 2;
        selectedSamples++;
      }
    if (selectedSamples && signalPower > 0 && noisePower > 0)
      referenceSnr = 10 * Math.log10(signalPower / noisePower);
    const estimator = analyzeGuidedSamples(samples, rate, context, {
      quietSeconds: 2,
      speechDetection: "silero",
      segments: [{ start: 2, end: components.sourceEnd }],
      capture,
    });
    estimatorSnr = estimator.metrics.snrDb;
    estimatorStability = estimator.evidence.noiseStability;
  }
  const selectedSnrError =
    referenceSnr === null ? null : result.metrics.snrDb - referenceSnr;
  const estimatorSnrError = components
    ? estimatorSnr - components.targetDb
    : null;
  // Only stationary fan/white cases have a stationary SNR acceptance gate.
  // Speech-selection failures and changed-noise cases remain reported failures,
  // never coerced into a passing SNR claim.
  const snrPass =
    !components ||
    components.change ||
    (referenceSnr !== null &&
      Math.abs(selectedSnrError) <= 1 &&
      Math.abs(estimatorSnrError) <= 1);
  const estimatorStabilityPass =
    !components ||
    estimatorStability === (components.change ? "unstable" : "stable");
  const workerStabilityAgreement = !components
    ? null
    : result.evidence.noiseStability ===
      (components.change ? "unstable" : "stable");
  // Constant injected noise does not prove the retained recording has constant
  // native background. A worker disagreement is actionable, but its false-alarm
  // truth is unknown without independent source speech/noise decomposition.
  // Introduced +12/-12 dB tail changes have known signal-free reference regions.
  const stabilityPass =
    estimatorStabilityPass && (!components?.change || workerStabilityAgreement);
  rows.push({
    file: clip.file,
    split: clip.split,
    corpus: clip.corpus,
    language: clip.language,
    device: clip.device,
    condition,
    sampleRate: rate,
    pcmSha256: hash(new Uint8Array(samples.buffer)),
    segments,
    agreement: agreement(samples, rate, clip.speechIntervals, segments),
    annotationKind: clip.annotationKind,
    referenceClipping: exact,
    // Ratio oracle verifies arithmetic against selected samples, not selection accuracy.
    clippingPass,
    confidencePass: !!confidencePass,
    noSpeechPass,
    annotationClipping,
    annotationSpeechClippingError: annotationClipping
      ? result.metrics.speechClippingRatio -
        annotationClipping.speechClippingRatio
      : null,
    referenceSnrDb: referenceSnr,
    actualSnrDb: result.metrics.snrDb,
    selectedSnrErrorDb: selectedSnrError,
    estimatorSnrErrorDb: estimatorSnrError,
    snrPass,
    estimatorStability,
    estimatorStabilityPass,
    workerStabilityAgreement,
    stationaryWorkerTruth:
      components && !components.change
        ? "Unknown native source background; constant injected component only"
        : null,
    stability: result.evidence.noiseStability,
    stabilityPass,
    retry: result.evidence.retryReason ?? null,
    state: result.specialState ?? "graded",
    certainty: result.verdict.diagnosticCertainty,
    grade: result.specialState ? null : result.verdict.overall.grade,
    passed:
      clippingPass &&
      confidencePass &&
      noSpeechPass &&
      snrPass &&
      stabilityPass,
  });
}
try {
  const development = new Set(
    manifest.clips
      .filter((c) => c.split === "development")
      .flatMap((c) => c.participantIds),
  );
  if (
    manifest.clips
      .filter((c) => c.split === "evaluation")
      .some((c) => c.participantIds.some((id) => development.has(id)))
  )
    throw new Error("Speaker split overlap");
  for (const clip of process.argv.includes("--controls-only")
    ? []
    : manifest.clips) {
    const bytes = await readFile(path.join(folder, clip.file));
    if (hash(bytes) !== clip.sha256)
      throw new Error("Source checksum mismatch");
    const source = decode(bytes, clip.sampleRate),
      rate = clip.sampleRate;
    for (const condition of ["native", "quiet-minus12db", "hard-clipped"]) {
      const samples = source.slice();
      if (condition === "quiet-minus12db")
        for (let i = 0; i < samples.length; i++) samples[i] *= 10 ** (-12 / 20);
      if (condition === "hard-clipped") {
        const peak = samples
          .subarray(2 * rate)
          .reduce((m, x) => Math.max(m, Math.abs(x)), 0);
        for (let i = 2 * rate; i < samples.length; i++)
          samples[i] = Math.max(-0.99, Math.min(0.99, (samples[i] * 4) / peak));
      }
      await run(clip, samples, condition);
    }
    if (process.argv.includes("--native-only") || clip.corpus !== "FLEURS")
      continue;
    // Retained full recording component (including native source background),
    // NOT a claim of acoustically clean speech. No original timing truth added.
    const sourceEnd = source.length / rate;
    const signal = new Float32Array(source.length + 4 * rate);
    const scale = 0.04 / rms(source.subarray(2 * rate));
    for (let i = 2 * rate; i < source.length; i++)
      signal[i] = source[i] * scale;
    for (const shape of ["white", "fan-tone"])
      for (const targetDb of [0, 10, 20]) {
        const period = new Float32Array(rate);
        let seed = 0x12345678;
        for (let i = 0; i < period.length; i++) {
          seed ^= seed << 13;
          seed ^= seed >>> 17;
          seed ^= seed << 5;
          period[i] =
            shape === "white"
              ? ((seed >>> 0) / 2 ** 32) * 2 - 1
              : Math.sin((2 * Math.PI * 120 * i) / rate) +
                0.3 * Math.sin((2 * Math.PI * 240 * i) / rate);
        }
        const gain = 0.04 / 10 ** (targetDb / 20) / rms(period);
        const noise = Float32Array.from(
          signal,
          (_, i) => period[i % rate] * gain,
        );
        const samples = Float32Array.from(signal, (x, i) => x + noise[i]);
        await run(clip, samples, `${shape}-${targetDb}db`, {
          signal,
          noise,
          targetDb,
          sourceEnd,
        });
        if (shape === "white" && targetDb === 10)
          for (const change of ["increase", "decrease"]) {
            const modifiedNoise = noise.slice();
            const begin = source.length + Math.round(0.75 * rate),
              end = begin + Math.round(1.25 * rate);
            for (let i = begin; i < end; i++)
              modifiedNoise[i] *= 10 ** (change === "increase" ? 0.6 : -0.6);
            const changed = Float32Array.from(
              signal,
              (x, i) => x + modifiedNoise[i],
            );
            await run(clip, changed, `white-10db-${change}`, {
              signal,
              noise: modifiedNoise,
              targetDb,
              sourceEnd,
              change,
            });
          }
      }
  }
  if (
    !process.argv.includes("--native-only") &&
    !process.argv.includes("--recorded-only")
  )
    for (const shape of [
      "white",
      "fan-tone",
      "typing-clicks",
      "instrumental-tones",
    ]) {
      const rate = 16000,
        samples = new Float32Array(22 * rate);
      let seed = 0x76543210;
      for (let i = 0; i < samples.length; i++) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        const random = ((seed >>> 0) / 2 ** 32) * 2 - 1;
        const t = i / rate;
        const clickAge = t % 0.125;
        samples[i] =
          shape === "white"
            ? 0.005 * random
            : shape === "fan-tone"
              ? 0.005 *
                (Math.sin(2 * Math.PI * 120 * t) +
                  0.3 * Math.sin(2 * Math.PI * 240 * t))
              : shape === "typing-clicks"
                ? 0.001 * random +
                  (clickAge < 0.01
                    ? 0.03 * random * Math.exp(-clickAge * 400)
                    : 0)
                : 0.005 *
                  (Math.sin(2 * Math.PI * 220 * t) +
                    Math.sin(2 * Math.PI * 329.63 * t) +
                    Math.sin(2 * Math.PI * 440 * t));
      }
      await run(
        {
          file: `generated-${shape}`,
          split: "controlled",
          corpus: "Generated",
          language: null,
          device: null,
          sampleRate: rate,
          speechIntervals: [],
          annotationKind:
            "Exact no-speech by construction; idealized sound, not a real fan, keyboard or music recording.",
        },
        samples,
        "no-speech-control",
      );
    }
} finally {
  await worker.close();
}
const summary = {
  cases: rows.length,
  failures: rows.filter((r) => !r.passed).length,
  clippingFailures: rows.filter((r) => !r.clippingPass).length,
  snrFailures: rows.filter((r) => !r.snrPass).length,
  stabilityFailures: rows.filter((r) => !r.stabilityPass).length,
  confidenceFailures: rows.filter((r) => !r.confidencePass).length,
  noSpeechFailures: rows.filter((r) => !r.noSpeechPass).length,
  stationaryWorkerDisagreements: rows
    .filter((r) => r.stationaryWorkerTruth && !r.workerStabilityAgreement)
    .map((r) => ({ file: r.file, condition: r.condition })),
  nativeNoSpeech: rows
    .filter((r) => r.condition === "native" && r.retry === "no_speech")
    .map((r) => r.file),
};
if (!process.argv.includes("--check"))
  await writeFile(
    path.join(
      root,
      process.argv.includes("--controls-only")
        ? "docs/accuracy-expansion-controls-results.json"
        : "docs/accuracy-expansion-results.json",
    ),
    JSON.stringify(
      {
        sourceManifestSha256: hash(manifestBytes),
        workerSha256: worker.sha256,
        modelManifestSha256: worker.modelManifestSha256,
        limits:
          "AMI forced-alignment agreement is diagnostic, not independently verified boundary truth. FLEURS has no timing labels. Retained-component SNR includes source background. Native retry truth unknown. Known changes are generated, not physical. No thresholds tuned on evaluation outputs.",
        summary,
        rows,
      },
      null,
      2,
    ) + "\n",
  );
console.log(JSON.stringify(summary));
if (summary.failures) process.exitCode = 1;
