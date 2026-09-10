import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { writeFileSync } from "node:fs";
import path from "node:path";

test("reports a reproducible synthetic energy versus neural VAD benchmark", async ({
  page,
  browser,
}) => {
  const bundle = await build({
    entryPoints: [path.resolve("../../packages/audio-core/src/vad.ts")],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "baseline",
  });
  await page.goto("/results");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const rows = await page.evaluate(async () => {
    const ctx = new AudioContext({ sampleRate: 16000 });
    const voice = await ctx.decodeAudioData(
      await (await fetch("/demo/speech.wav")).arrayBuffer(),
    );
    const speech = Array.from(voice.getChannelData(0));
    await ctx.close();
    const report = [];
    for (const name of [
      "silence",
      "50 Hz hum",
      "white noise",
      "synthetic speech",
      "quiet synthetic speech",
    ]) {
      const samples = new Float32Array(16000 * 7);
      let seed = 12345;
      for (let i = 0; i < samples.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        samples[i] =
          name === "50 Hz hum"
            ? 0.1 * Math.sin((2 * Math.PI * 50 * i) / 16000)
            : name === "white noise"
              ? ((seed / 4294967296) * 2 - 1) * 0.1
              : name.includes("speech") && i >= 32000
                ? (speech[i - 32000] ?? 0) *
                  (name.startsWith("quiet") ? 0.1 : 1)
                : 0;
      }
      const energy =
        (
          window as unknown as {
            baseline: {
              detectVoiceActivity: (
                samples: Float32Array,
                rate: number,
              ) => { speechRatio: number };
            };
          }
        ).baseline.detectVoiceActivity(samples, 16000).speechRatio * 7;
      const start = performance.now();
      const result = await new Promise<{
        ai: { segments: { start: number; end: number }[] };
        specialState?: string;
      }>((resolve, reject) => {
        const worker = new Worker("/audio-analysis.worker.js", {
          type: "module",
        });
        const timer = setTimeout(() => {
          worker.terminate();
          reject(new Error("Benchmark timed out"));
        }, 30000);
        worker.onmessage = ({ data }) => {
          if (data.result || data.error) {
            clearTimeout(timer);
            worker.terminate();
            if (data.error) reject(new Error(data.error));
            else resolve(data.result);
          }
        };
        worker.onerror = () => {
          clearTimeout(timer);
          worker.terminate();
          reject(new Error("Worker failed"));
        };
        worker.postMessage({
          samples,
          sampleRate: 16000,
          context: {
            use_case: "meetings",
            device_type: "unknown",
            mode: "basic",
          },
          capture: {
            format: "pcm",
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          classifyNoise: false,
        });
      });
      report.push({
        name,
        energySpeechSeconds: Number(energy.toFixed(3)),
        neuralSpeechSeconds: Number(
          result.ai.segments
            .reduce((sum, s) => sum + s.end - s.start, 0)
            .toFixed(3),
        ),
        wallMs: Math.round(performance.now() - start),
        state: result.specialState ?? "graded",
      });
    }
    return report;
  });
  expect(rows[0].neuralSpeechSeconds).toBe(0);
  expect(rows[3].neuralSpeechSeconds).toBeGreaterThan(1);
  if (process.env.UPDATE_BENCHMARK)
    writeFileSync(
      path.resolve("../../docs/benchmark-results.json"),
      JSON.stringify(
        {
          date: new Date().toISOString(),
          browser: browser.version(),
          platform: process.platform,
          description:
            "Synthetic smoke benchmark; one run per input, not an accuracy evaluation or representative device timing.",
          rows,
        },
        null,
        2,
      ) + "\n",
    );
  console.log(JSON.stringify(rows));
});
