import { describe, expect, it } from "vitest";
import { adviceTemplates, selectAdviceTemplate } from "./adviceLibrary";

describe("adviceLibrary template selection", () => {
  it("selects podcast+bluetooth low-level template with projection and system/app checks", () => {
    const steps = selectAdviceTemplate({
      metric: "level",
      failureMode: "low",
      useCase: "podcast",
      deviceType: "bluetooth_headset"
    });

    const keys = steps.map((step) => step.key);
    expect(keys).toEqual(
      expect.arrayContaining(["speak_louder", "check_system_mic_level"])
    );
    expect(keys).not.toContain("move_mic_closer");
    expect(keys).not.toContain("adjust_input_gain");
  });

  it("selects podcast+usb low-level template with gain + distance", () => {
    const steps = selectAdviceTemplate({
      metric: "level",
      failureMode: "low",
      useCase: "podcast",
      deviceType: "usb_mic"
    });

    const keys = steps.map((step) => step.key);
    expect(keys).toEqual(expect.arrayContaining(["move_mic_closer", "adjust_input_gain"]));
  });

  it("selects built-in constant-hum template without cable/grounding advice", () => {
    const steps = selectAdviceTemplate({
      metric: "noise",
      failureMode: "constant_hum",
      useCase: "meetings",
      deviceType: "built_in_mic"
    });

    const keys = steps.map((step) => step.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "check_charger_interference",
        "check_power_interference",
        "check_usb_port_interference"
      ])
    );
    expect(keys).not.toContain("check_cables_grounding");
  });

  it("selects meetings strong-echo template with echo cancellation plus room changes", () => {
    const steps = selectAdviceTemplate({
      metric: "echo",
      failureMode: "strong_echo",
      useCase: "meetings",
      deviceType: "unknown"
    });

    const keys = steps.map((step) => step.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "move_mic_closer",
        "reposition_mic_away_from_speakers",
        "enable_echo_cancellation"
      ])
    );
  });

  it("prioritizes room treatment for podcast/music strong echo", () => {
    const podcast = selectAdviceTemplate({
      metric: "echo",
      failureMode: "strong_echo",
      useCase: "podcast",
      deviceType: "unknown"
    }).map((step) => step.key);
    const music = selectAdviceTemplate({
      metric: "echo",
      failureMode: "strong_echo",
      useCase: "music",
      deviceType: "unknown"
    }).map((step) => step.key);

    expect(podcast[0]).toBe("treat_room_echo");
    expect(music[0]).toBe("treat_room_echo");
  });

  it("returns clipping template that includes input reduction + softer speech", () => {
    const steps = selectAdviceTemplate({
      metric: "clipping",
      failureMode: "clipping",
      useCase: "podcast",
      deviceType: "usb_mic"
    });

    const keys = steps.map((step) => step.key);
    expect(keys).toEqual(expect.arrayContaining(["speak_softer", "adjust_input_gain"]));
  });

  it("has at least one fallback path for each metric × use-case", () => {
    const metrics = ["level", "noise", "echo", "clipping"] as const;
    const useCases = ["meetings", "streaming", "podcast", "music"] as const;

    for (const metric of metrics) {
      for (const useCase of useCases) {
        const failureMode =
          metric === "level"
            ? "low"
            : metric === "noise"
              ? "general_noise"
              : metric === "echo"
                ? "roomy"
                : "clipping";

        const steps = selectAdviceTemplate({
          metric,
          failureMode,
          useCase,
          deviceType: "unknown"
        });

        expect(steps.length).toBeGreaterThan(0);
      }
    }
  });

  it("contains a bounded deterministic template set", () => {
    expect(adviceTemplates.length).toBeGreaterThanOrEqual(30);
    expect(adviceTemplates.length).toBeLessThanOrEqual(55);
  });
});
