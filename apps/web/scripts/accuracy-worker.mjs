import { chromium } from "@playwright/test";
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

// Actual worker and local models; no instrumentation or external inference.
export async function accuracyWorker(root, { plugins = [] } = {}) {
  const web = path.join(root, "apps/web");
  const manifestBytes = await readFile(
    path.join(web, "public/models/manifest.json"),
  );
  for (const entry of JSON.parse(manifestBytes).files) {
    const bytes = await readFile(path.join(web, "public/models", entry.path));
    if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256)
      throw new Error("Model checksum mismatch: " + entry.path);
  }
  const bundle = await build({
    entryPoints: [path.join(web, "lib/ai/audioAnalysis.worker.ts")],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
    plugins,
    alias: {
      "@miccheck/audio-core": path.join(
        root,
        "packages/audio-core/src/index.ts",
      ),
      "@miccheck/audio-metrics": path.join(
        root,
        "packages/audio-metrics/src/index.ts",
      ),
    },
  });
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/")
        return res.end("<!doctype html><title>Accuracy benchmark</title>");
      if (url.pathname === "/worker.js") {
        res.setHeader("Content-Type", "text/javascript");
        return res.end(bundle.outputFiles[0].text);
      }
      const file = path.resolve(web, "public", "." + url.pathname);
      if (!file.startsWith(path.join(web, "public") + path.sep))
        return res.writeHead(403).end();
      res.setHeader(
        "Content-Type",
        file.endsWith(".wasm")
          ? "application/wasm"
          : file.endsWith(".mjs")
            ? "text/javascript"
            : "application/octet-stream",
      );
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    return {
      modelManifestSha256: createHash("sha256")
        .update(manifestBytes)
        .digest("hex"),
      sha256: createHash("sha256")
        .update(bundle.outputFiles[0].text)
        .digest("hex"),
      async analyze(samples, rate, context, capture) {
        return page.evaluate(
          ({ pcm, rate, context, capture }) =>
            new Promise((resolve, reject) => {
              const worker = new Worker("/worker.js", { type: "module" });
              const finish = () => {
                clearTimeout(timer);
                worker.terminate();
              };
              const timer = setTimeout(() => {
                finish();
                reject(new Error("Accuracy worker timeout"));
              }, 60000);
              worker.onerror = () => {
                finish();
                reject(new Error("Accuracy worker error"));
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
                samples: Float32Array.from(pcm),
                sampleRate: rate,
                context,
                capture,
                quietSeconds: 2,
                classifyNoise: false,
              });
            }),
          { pcm: Array.from(samples), rate, context, capture },
        );
      },
      async close() {
        await browser.close();
        await new Promise((resolve) => server.close(resolve));
      },
    };
  } catch (error) {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
    throw error;
  }
}
