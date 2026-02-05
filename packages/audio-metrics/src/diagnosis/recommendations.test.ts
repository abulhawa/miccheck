import { describe, expect, it } from "vitest";
import { buildRecommendationPolicy } from "./recommendations";

const levelBase = { rms: 0.1, rmsDb: -16 };
const clippingBase = { clippingRatio: 0, peak: 0.5 };
const noiseBase = { noiseFloor: 0.001, snrDb: 35, humRatio: 0, confidence: "high" as const };
const echoBase = { echoScore: 0.05, confidence: "high" as const };

describe("recommendation policy", () => {
  it("filters distance and gain advice on bluetooth devices", () => {
    const policy = buildRecommendationPolicy(
      { ...levelBase, rmsDb: -35 },
      clippingBase,
      noiseBase,
      echoBase,
      { mode: "single", use_case: "meetings", device_type: "bluetooth" }
    );

    const keys = policy.adviceSteps.map((step) => step.key);
    expect(keys).not.toContain("move_mic_closer");
    expect(keys).not.toContain("adjust_input_gain");
  });

  it("uses charger/interference checks for built-in mic hum", () => {
    const policy = buildRecommendationPolicy(
      levelBase,
      clippingBase,
      { ...noiseBase, snrDb: 22, humRatio: 0.2 },
      echoBase,
      { mode: "single", use_case: "meetings", device_type: "built_in" }
    );

    const keys = policy.adviceSteps.map((step) => step.key);
    expect(keys).not.toContain("check_cables_grounding");
    expect(keys).toEqual(
      expect.arrayContaining([
        "check_charger_interference",
        "check_power_interference",
        "check_usb_port_interference"
      ])
    );
  });

  it("caps certainty for unknown devices and yields low-certainty check style", () => {
    const policy = buildRecommendationPolicy(
      { ...levelBase, rmsDb: -40 },
      clippingBase,
      { ...noiseBase, snrDb: 5 },
      { ...echoBase, echoScore: 0.9 },
      { mode: "single", use_case: "meetings", device_type: "unknown" }
    );

    expect(policy.confidence).toBeLessThanOrEqual(0.6);
    expect(policy.adviceSteps.length).toBeGreaterThanOrEqual(2);
    expect(policy.adviceSteps.some((step) => step.key === "check_system_mic_level")).toBe(true);
  });

  it("shows gear only for meetings fail + high severity and always last", () => {
    const passPolicy = buildRecommendationPolicy(
      levelBase,
      clippingBase,
      noiseBase,
      echoBase,
      { mode: "single", use_case: "meetings", device_type: "usb_mic" }
    );
    expect(passPolicy.adviceSteps.some((step) => step.key === "consider_external_mic")).toBe(false);

    const failPolicy = buildRecommendationPolicy(
      levelBase,
      clippingBase,
      { ...noiseBase, snrDb: 5 },
      echoBase,
      { mode: "single", use_case: "meetings", device_type: "usb_mic" }
    );

    const gearIdx = failPolicy.adviceSteps.findIndex((step) => step.key === "consider_external_mic");
    expect(gearIdx).toBeGreaterThanOrEqual(0);
    expect(gearIdx).toBe(failPolicy.adviceSteps.length - 1);
  });

  it("uses hypothesis-style quick checks when certainty is low", () => {
    const policy = buildRecommendationPolicy(
      { ...levelBase, rmsDb: -40 },
      clippingBase,
      { ...noiseBase, snrDb: 5 },
      { ...echoBase, echoScore: 0.9 },
      { mode: "single", use_case: "meetings", device_type: "unknown" }
    );

    expect(policy.adviceSteps.length).toBeGreaterThanOrEqual(2);
    expect(policy.adviceSteps.length).toBeLessThanOrEqual(3);
  });

  it("keeps clipping guidance action-only when gear relevance is low", () => {
    const policy = buildRecommendationPolicy(
      { ...levelBase, rmsDb: -10 },
      { ...clippingBase, clippingRatio: 0.08 },
      noiseBase,
      echoBase,
      { mode: "single", use_case: "podcast", device_type: "usb_mic" }
    );

    const keys = policy.adviceSteps.map((step) => step.key);
    expect(keys).toEqual(expect.arrayContaining(["speak_softer", "adjust_input_gain"]));
    expect(keys).not.toContain("consider_external_mic");
  });
});
