import { describe, expect, it } from "vitest";
import { buildAdviceSteps, normalizeAdviceOrder, type AdviceStep } from "./adviceSteps";
import { applyDeviceConstraintsWithReplacements } from "./deviceConstraints";

describe("advice hardening", () => {
  it("normalizes advice ladder ordering to behavioral → software → gear_optional", () => {
    const unordered: AdviceStep[] = [
      { key: "check_app_input_level", kind: "software" },
      { key: "move_mic_closer", kind: "behavioral" },
      { key: "consider_external_mic", kind: "gear_optional" },
      { key: "check_system_mic_level", kind: "software" }
    ];

    const ordered = normalizeAdviceOrder(unordered);
    expect(ordered.map((step) => step.kind)).toEqual([
      "behavioral",
      "software",
      "software",
      "gear_optional"
    ]);
  });

  it("keeps bluetooth meetings noise advice fallback-safe", () => {
    const steps = buildAdviceSteps("noise", {
      isQuiet: false,
      hasHum: false,
      useCase: "meetings",
      deviceType: "bluetooth"
    });

    const keys = steps.map((step) => step.key);
    expect(keys).not.toContain("move_mic_closer");
    expect(keys).not.toContain("adjust_input_gain");
    expect(
      keys.includes("keep_headset_mic_facing_mouth") || keys.includes("keep_head_angle_stable")
    ).toBe(true);
  });

  it("keeps bluetooth podcast roomy-echo advice free of distance instructions", () => {
    const steps = buildAdviceSteps("echo", {
      isQuiet: false,
      hasHum: false,
      echoScore: 0.45,
      useCase: "podcast",
      deviceType: "bluetooth"
    });

    const keys = steps.map((step) => step.key);
    expect(keys).not.toContain("move_mic_closer");
  });

  it("keeps unknown low-level advice free of gain-knob language", () => {
    const steps = buildAdviceSteps("level", {
      isQuiet: true,
      hasHum: false,
      useCase: "podcast",
      deviceType: "unknown"
    });

    const keys = steps.map((step) => step.key);
    expect(keys).not.toContain("adjust_input_gain");
    expect(keys).toEqual(expect.arrayContaining(["check_system_mic_level", "check_app_input_level"]));
  });

  it("replaces built-in cables/grounding advice with interference checks", () => {
    const constrained = applyDeviceConstraintsWithReplacements(
      [{ key: "check_cables_grounding" }],
      { device_type: "built_in", metric: "noise", failureMode: "constant_hum" }
    );

    expect(constrained.steps.map((step) => step.key)).toEqual(
      expect.arrayContaining(["check_charger_interference", "check_power_interference"])
    );
    expect(constrained.steps.map((step) => step.key)).not.toContain("check_cables_grounding");
    expect(constrained.constraintsApplied).toContain("replaced_check_cables_grounding_for_built_in");
  });
  it("keeps built-in constant-hum advice free of cable grounding steps", () => {
    const steps = buildAdviceSteps("noise", {
      isQuiet: false,
      hasHum: true,
      useCase: "meetings",
      deviceType: "built_in"
    });

    const keys = steps.map((step) => step.key);
    expect(keys).not.toContain("check_cables_grounding");
  });

});
