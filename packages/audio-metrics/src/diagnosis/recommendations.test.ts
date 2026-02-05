import { describe, expect, it } from "vitest";
import { buildRecommendationPolicy } from "./recommendations";

const levelBase = { rms: 0.1, rmsDb: -16 };
const clippingBase = { clippingRatio: 0, peak: 0.5 };
const noiseBase = { noiseFloor: 0.001, snrDb: 35, humRatio: 0, confidence: "high" as const };
const echoBase = { echoScore: 0.05, confidence: "high" as const };

describe("recommendation policy", () => {
  it("filters distance advice on bluetooth devices", () => {
    const policy = buildRecommendationPolicy(
      levelBase,
      clippingBase,
      { ...noiseBase, snrDb: 10 },
      echoBase,
      { mode: "single", use_case: "meetings", device_type: "bluetooth" }
    );

    expect(policy.adviceSteps.map((step) => step.key)).toEqual([
      "reduce_background_noise",
      "consider_external_mic"
    ]);
  });

  it("filters gain-knob advice for built-in devices", () => {
    const policy = buildRecommendationPolicy(
      { ...levelBase, rmsDb: -35 },
      clippingBase,
      noiseBase,
      echoBase,
      { mode: "single", use_case: "meetings", device_type: "built_in" }
    );

    expect(policy.adviceSteps.map((step) => step.key)).toEqual(["move_mic_closer"]);
  });

  it("applies gear inclusion matrix based on relevance", () => {
    const lowRelevance = buildRecommendationPolicy(
      levelBase,
      clippingBase,
      noiseBase,
      echoBase,
      { mode: "single", use_case: "meetings", device_type: "unknown" }
    );
    const mediumRelevance = buildRecommendationPolicy(
      levelBase,
      clippingBase,
      { ...noiseBase, snrDb: 10 },
      echoBase,
      { mode: "single", use_case: "meetings", device_type: "unknown" }
    );
    const highRelevance = buildRecommendationPolicy(
      levelBase,
      clippingBase,
      { ...noiseBase, snrDb: 35 },
      { ...echoBase, echoScore: 0.8 },
      { mode: "single", use_case: "meetings", device_type: "unknown" }
    );

    expect(lowRelevance.adviceSteps.some((step) => step.key === "consider_external_mic")).toBe(false);
    expect(
      mediumRelevance.adviceSteps.find((step) => step.key === "consider_external_mic")
    ).toMatchObject({ affiliateUrl: expect.any(String) });
    expect(
      highRelevance.adviceSteps.find((step) => step.key === "consider_external_mic")
    ).toMatchObject({ affiliateUrl: expect.any(String) });
  });
});
