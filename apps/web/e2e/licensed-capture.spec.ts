import { test, expect, chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { alignCapture as alignment } from "./helpers/captureAlignment";

const folder = path.resolve("e2e/fixtures/accuracy-expansion");
const manifest = JSON.parse(
  readFileSync(path.join(folder, "manifest.json"), "utf8"),
);
const settingsKeys = [
  "echoCancellation",
  "noiseSuppression",
  "autoGainControl",
] as const;
type Settings = Record<(typeof settingsKeys)[number], boolean>;

function decode(bytes: Buffer) {
  let rate = 0,
    pcm: Buffer | undefined;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const size = bytes.readUInt32LE(offset + 4),
      kind = bytes.toString("ascii", offset, offset + 4);
    if (kind === "fmt ") {
      if (
        bytes.readUInt16LE(offset + 8) !== 1 ||
        bytes.readUInt16LE(offset + 10) !== 1 ||
        bytes.readUInt16LE(offset + 22) !== 16
      )
        throw new Error("Expected mono PCM16");
      rate = bytes.readUInt32LE(offset + 12);
    }
    if (kind === "data") pcm = bytes.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  if (!pcm || !rate) throw new Error("Missing WAV data");
  return {
    rate,
    samples: Float32Array.from(
      { length: pcm.length / 2 },
      (_, i) => pcm!.readInt16LE(i * 2) / 32768,
    ),
  };
}

// Align captured speech to the looping file independently of wall-clock timers.
// A paired raw/processed comparison verifies actual waveform behavior as well
// as browser settings. This is virtual-device evidence, not acoustic validation.
function prepareReplay(file: string) {
  const original = readFileSync(path.join(folder, file));
  const rate = decode(original).rate;
  const quiet = original.subarray(44, 44 + 2 * rate * 2);
  const bytes = Buffer.concat([
    original.subarray(0, 44),
    quiet,
    quiet,
    original.subarray(44),
  ]);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.writeUInt32LE(bytes.length - 44, 40);
  const directory = path.resolve(".test-assets/accuracy-expansion");
  mkdirSync(directory, { recursive: true });
  const filePath = path.join(directory, file);
  writeFileSync(filePath, bytes);
  return { bytes, filePath };
}

async function launch(file: string) {
  return chromium.launch({
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=${path.isAbsolute(file) ? file : path.join(folder, file)}`,
    ],
  });
}

for (const agent of ["A", "B"])
  for (const device of ["headset", "distant-array"]) {
    test(`licensed participant ${agent} ${device} recording traverses real browser capture with processing off and on`, async () => {
      test.setTimeout(150000);
      const clip = manifest.clips.find(
        (c: { file: string }) =>
          c.file === `ami-IS1001a-${agent}-${device}.wav`,
      );
      const sourceBytes = readFileSync(path.join(folder, clip.file));
      expect(createHash("sha256").update(sourceBytes).digest("hex")).toBe(
        clip.sha256,
      );
      // Extend native room background for the three-second app phase and startup;
      // the worker-only benchmark's two-second crop calibration is shorter.
      const { bytes: replayBytes, filePath: replayFile } = prepareReplay(
        clip.file,
      );
      const source = decode(replayBytes);
      const rows = [];
      for (const enabled of [false, true]) {
        const browser = await launch(replayFile);
        try {
          const context = await browser.newContext({
            permissions: ["microphone"],
          });
          const page = await context.newPage();
          const errors: string[] = [];
          page.on("pageerror", (e) => errors.push(e.message));
          await page.addInitScript(
            ({ enabled }) => {
              const original = navigator.mediaDevices.getUserMedia.bind(
                navigator.mediaDevices,
              );
              navigator.mediaDevices.getUserMedia = async (constraints) => {
                // Change real requested constraints; never fabricate getSettings(),
                // PCM, track state, model output, room sample, or saved result.
                const stream = await original({
                  ...constraints,
                  audio: {
                    ...(typeof constraints?.audio === "object"
                      ? constraints.audio
                      : {}),
                    echoCancellation: enabled,
                    noiseSuppression: enabled,
                    autoGainControl: enabled,
                  },
                });
                Object.assign(window, {
                  __captureTrack: stream.getAudioTracks()[0],
                  __actualSettings: stream.getAudioTracks()[0].getSettings(),
                });
                return stream;
              };
            },
            { enabled },
          );
          await page.goto("http://127.0.0.1:3100/test");
          await page
            .getByRole("button", { name: "Measure my room", exact: true })
            .click();
          const start = page.getByRole("button", {
            name: "Start voice recording",
            exact: true,
          });
          await expect(start).toBeEnabled({ timeout: 30000 });
          await start.click();
          // The room prefix delays participant A's strongest speech until about
          // 15 s of replay time. Capture the full passage, not only its quiet onset.
          await page.waitForTimeout(18000);
          await page
            .getByRole("button", { name: "Finish recording", exact: true })
            .click();
          await expect
            .poll(
              () =>
                page.evaluate(() =>
                  sessionStorage.getItem("miccheck.session.v2.latest"),
                ),
              { timeout: 40000 },
            )
            .not.toBeNull();
          const saved = await page.evaluate(() =>
            JSON.parse(sessionStorage.getItem("miccheck.session.v2.latest")!),
          );
          const bytes = Buffer.from(saved.audio.split(",")[1], "base64");
          writeFileSync(
            path.resolve(
              `.test-assets/accuracy-expansion/captured-${agent}-${device}-${enabled}.wav`,
            ),
            bytes,
          );
          writeFileSync(
            path.resolve(
              `.test-assets/accuracy-expansion/captured-${agent}-${device}-${enabled}.json`,
            ),
            JSON.stringify(saved.analysis),
          );
          const actual = await page.evaluate(
            () =>
              (window as unknown as { __actualSettings: Settings })
                .__actualSettings,
          );
          for (const key of settingsKeys) {
            expect(actual[key], `Chromium must really apply ${key}`).toBe(
              enabled,
            );
            expect(saved.analysis.evidence.capture[key]).toBe(actual[key]);
          }
          expect(saved.analysis.evidence.capture.format).toBe("pcm");
          expect(saved.analysis.evidence.quietSeconds).toBeGreaterThanOrEqual(
            2,
          );
          expect(saved.analysis.evidence.quietSeconds).toBeLessThanOrEqual(3);
          expect(saved.analysis.evidence.speechSeconds).toBeGreaterThan(0);
          if (agent === "B" && device === "distant-array" && !enabled) {
            // Exercise the graded result flow as well as captured retry results;
            // this is a behavior gate, not a claim that its grade is ground truth.
            expect(saved.analysis.specialState).toBeUndefined();
            await expect(
              page.getByRole("heading", {
                name: "What this result is based on",
              }),
            ).toBeVisible();
          }
          if (enabled) {
            expect(saved.analysis.verdict.diagnosticCertainty).toBe("low");
            await expect(
              page.getByText(
                "Your browser may be processing the signal. Compare recordings made with the same settings.",
              ),
            ).toBeVisible();
          }
          const captured = decode(bytes);
          expect(captured.samples.length / captured.rate).toBeGreaterThan(11);
          const aligned = alignment(
            captured,
            source,
            saved.analysis.evidence.quietSeconds,
          );
          if (!enabled) expect(aligned.correlation).toBeGreaterThan(0.85);
          await expect
            .poll(() =>
              page.evaluate(
                () =>
                  (window as unknown as { __captureTrack: MediaStreamTrack })
                    .__captureTrack.readyState,
              ),
            )
            .toBe("ended");
          await page.reload();
          await expect(
            page.getByRole("button", { name: "Play recording", exact: true }),
          ).toBeVisible();
          await page
            .getByRole("button", { name: "Play recording", exact: true })
            .click();
          await expect(
            page.getByRole("button", { name: "Pause playback", exact: true }),
          ).toBeVisible();
          expect(errors).toEqual([]);
          rows.push({
            file: clip.file,
            sourceSha256: clip.sha256,
            replaySha256: createHash("sha256")
              .update(replayBytes)
              .digest("hex"),
            replayProtocol:
              "Prepend two repeats of the native first 2 s room sample (4 s added); retain original speech PCM",
            browserVersion: browser.version(),
            enabled,
            actualSettings: actual,
            captureSha256: createHash("sha256").update(bytes).digest("hex"),
            capturedRate: captured.rate,
            capturedSeconds: captured.samples.length / captured.rate,
            alignment: aligned,
            analysis: saved.analysis,
          });
        } finally {
          await browser.close();
        }
      }
      // Processing must change the observed waveform, not merely a metadata flag.
      expect(
        Math.abs(
          (rows[1].alignment.gain ?? 0) - (rows[0].alignment.gain ?? 0),
        ) +
          Math.abs(
            (rows[1].alignment.correlation ?? 0) -
              (rows[0].alignment.correlation ?? 0),
          ),
      ).toBeGreaterThan(0.02);
      if (process.env.CAPTURE_REPORT === "1")
        writeFileSync(
          path.resolve(
            `../../docs/browser-capture-${agent}-${device}-results.json`,
          ),
          JSON.stringify(
            {
              limits:
                "Chromium virtual microphone replay. Live timer scheduling and resampling vary. Alignment is diagnostic; it does not calibrate DSP gain. Physical ADC, acoustic path, operating-system processing, Safari and Firefox remain unvalidated. AEC on is a processing setting, not an echo-accuracy test.",
              rows,
            },
            null,
            2,
          ) + "\n",
        );
    });
  }

test("ignored processing changes do not fabricate enabled capture settings", async () => {
  test.setTimeout(60000);
  const browser = await launch(
    prepareReplay("ami-IS1001a-A-headset.wav").filePath,
  );
  try {
    const context = await browser.newContext({ permissions: ["microphone"] });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      );
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const stream = await original(constraints);
        Object.assign(window, { __captureTrack: stream.getAudioTracks()[0] });
        return stream;
      };
    });
    await page.goto("http://127.0.0.1:3100/test");
    await page
      .getByRole("button", { name: "Measure my room", exact: true })
      .click();
    const start = page.getByRole("button", {
      name: "Start voice recording",
      exact: true,
    });
    await expect(start).toBeEnabled({ timeout: 30000 });
    const actual = await page.evaluate(async () => {
      const track = (window as unknown as { __captureTrack: MediaStreamTrack })
        .__captureTrack;
      await track.applyConstraints({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      return track.getSettings();
    });
    // Current Chromium cannot reconfigure processing on this existing source.
    // Observe that limitation instead of faking an enabled getSettings value.
    expect(actual.noiseSuppression).toBe(false);
    await start.click();
    await page.waitForTimeout(9000);
    await page
      .getByRole("button", { name: "Finish recording", exact: true })
      .click();
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            sessionStorage.getItem("miccheck.session.v2.latest"),
          ),
        { timeout: 30000 },
      )
      .not.toBeNull();
    const capture = await page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem("miccheck.session.v2.latest")!)
          .analysis.evidence.capture,
    );
    for (const key of settingsKeys) expect(capture[key]).toBe(actual[key]);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __captureTrack: MediaStreamTrack })
              .__captureTrack.readyState,
        ),
      )
      .toBe("ended");
  } finally {
    await browser.close();
  }
});
