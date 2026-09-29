import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import type { AnalysisResult } from "../types";

// Actual source PCM -> production worker -> saved result -> visible result UI.
// This is recorded-fixture rendering coverage, not physical microphone capture.
for (const condition of ["original", "flat-crossing"] as const) {
  test(`@benchmark explains unselected clipping in a graded recorded result: ${condition}`, async ({
    page,
  }) => {
    const folder = path.resolve("e2e/fixtures/starss22");
    const ref = JSON.parse(
      readFileSync(path.join(folder, "reference.json"), "utf8"),
    ).clips.find((c: { room: string }) => c.room === "room6");
    const source = readFileSync(path.join(folder, ref.file));
    expect(createHash("sha256").update(source).digest("hex")).toBe(ref.sha256);
    let data: Buffer | undefined;
    for (let offset = 12; offset + 8 <= source.length; ) {
      const size = source.readUInt32LE(offset + 4);
      if (source.toString("ascii", offset, offset + 4) === "data")
        data = source.subarray(offset + 8, offset + 8 + size);
      offset += 8 + size + (size % 2);
    }
    if (!data) throw new Error("Missing fixture PCM");
    const rate = 24000;
    const count = rate * 11.5;
    const wave = Buffer.alloc(44 + count * 2);
    wave.write("RIFF", 0);
    wave.writeUInt32LE(36 + count * 2, 4);
    wave.write("WAVEfmt ", 8);
    wave.writeUInt32LE(16, 16);
    wave.writeUInt16LE(1, 20);
    wave.writeUInt16LE(1, 22);
    wave.writeUInt32LE(rate, 24);
    wave.writeUInt32LE(rate * 2, 28);
    wave.writeUInt16LE(2, 32);
    wave.writeUInt16LE(16, 34);
    wave.write("data", 36);
    wave.writeUInt32LE(count * 2, 40);
    for (let i = 0; i < count; i++) {
      let value = data.readInt16LE((i % (2 * rate)) * 2) / 32768;
      if (i >= 2 * rate && i < 7 * rate)
        value +=
          data.readInt16LE((ref.speechSourceSamples[0] + i - 2 * rate) * 2) /
          32768;
      if (
        condition === "flat-crossing" &&
        i >= Math.round(3.7 * rate) &&
        i < Math.round(3.72 * rate)
      )
        value = 0.99;
      wave.writeInt16LE(Math.round(value * 32768), 44 + i * 2);
    }
    const encoded = wave.toString("base64");
    await page.goto("/test");
    const result = await page.evaluate(async (encoded) => {
      const audio = new AudioContext({ sampleRate: 24000 });
      const decoded = await audio.decodeAudioData(
        Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)).buffer,
      );
      const samples = decoded.getChannelData(0).slice();
      await audio.close();
      return new Promise<AnalysisResult>((resolve, reject) => {
        const worker = new Worker("/audio-analysis.worker.js", {
          type: "module",
        });
        const timeout = setTimeout(() => {
          worker.terminate();
          reject(new Error("Worker timeout"));
        }, 30000);
        const finish = () => {
          clearTimeout(timeout);
          worker.terminate();
        };
        worker.onerror = () => {
          finish();
          reject(new Error("Worker failed"));
        };
        worker.onmessage = ({ data }) => {
          if (data.error) {
            finish();
            reject(new Error(data.error));
          } else if (data.result) {
            finish();
            resolve(data.result);
          }
        };
        worker.postMessage({
          samples,
          sampleRate: 24000,
          quietSeconds: 2,
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
    }, encoded);
    expect(result.specialState).toBeUndefined();
    expect(result.metrics.speechClippingRatio).toBe(0);
    expect(result.metrics.unselectedClippedDurationSeconds).toBe(
      condition === "original" ? 0 : 0.02,
    );
    expect(result.verdict.diagnosticCertainty).toBe(
      condition === "original" ? "medium" : "low",
    );
    await page.evaluate(
      ({ result, encoded }) => {
        sessionStorage.setItem(
          "miccheck.session.v2.latest",
          JSON.stringify({
            version: 2,
            id: "clipping-selection-result",
            createdAt: Date.now(),
            deviceId: null,
            analysis: result,
            audio: `data:audio/wav;base64,${encoded}`,
          }),
        );
      },
      { result, encoded },
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(
      page.getByText("Clipping in detected speech: 0.0%", { exact: true }),
    ).toBeVisible();
    const warning = page.getByText(/Speech clipping may be underestimated/);
    if (condition === "flat-crossing") await expect(warning).toBeVisible();
    else await expect(warning).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Play recording", exact: true }),
    ).toBeVisible();
  });
}
