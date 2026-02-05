import { describe, expect, it } from "vitest";
import { analysisDisplayThresholds } from "./analysisDisplay";

describe("analysisDisplayThresholds", () => {
  it("matches scoring thresholds from audio metrics", () => {
    expect(analysisDisplayThresholds).toMatchInlineSnapshot(`
      {
        "levelAcceptableMaxDbfs": -12,
        "levelAcceptableMinDbfs": -24,
        "levelTargetDbfs": -18,
        "snrCleanLoudnessRatio": 18,
        "snrCleanThresholdDb": 25,
      }
    `);
  });
});
