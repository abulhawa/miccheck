import { resampleBandlimited } from "@miccheck/audio-core";
import { analyzeGuidedSamples } from "@miccheck/audio-metrics";
import type { CaptureEvidence, ContextInput } from "@miccheck/audio-metrics";
import { detectSpeech } from "./silero";
import { classifyBackground } from "./sounds";

self.onmessage = async ({
  data,
}: MessageEvent<{
  samples: Float32Array;
  sampleRate: number;
  context: ContextInput;
  capture: CaptureEvidence;
  classifyNoise: boolean;
}>) => {
  const started = performance.now();
  try {
    const assetBase = `${self.location.origin}/models`;
    self.postMessage({ status: "Loading local speech model…" });
    const resampled = resampleBandlimited(data.samples, data.sampleRate, 16000);
    const segments = await detectSpeech(resampled, assetBase);
    const result = analyzeGuidedSamples(
      data.samples,
      data.sampleRate,
      data.context,
      {
        segments,
        quietSeconds: 2,
        speechDetection: "silero",
        capture: data.capture,
      },
    );
    let background = null;
    let noiseStatus: "off" | "ready" | "unavailable" = "off";
    if (data.classifyNoise && result.evidence?.noiseReliable) {
      self.postMessage({ status: "Identifying background sounds locally…" });
      try {
        background = await classifyBackground(
          resampled.subarray(0, 32000),
          assetBase,
        );
        noiseStatus = "ready";
      } catch {
        noiseStatus = "unavailable";
      }
    }
    self.postMessage({
      result: {
        ...result,
        ai: {
          segments,
          background,
          noiseStatus,
          engine: "Silero VAD v5",
          elapsedMs: performance.now() - started,
        },
      },
    });
  } catch {
    self.postMessage({
      error:
        "The local speech model could not run. Check that model files are available, then retry.",
    });
  }
};
