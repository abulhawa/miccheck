import { describe, expect, it } from "vitest";
import type { MetricKey } from "../types";
import type { MetricStatus } from "./evaluateMetrics";
import { buildSecondaryNotes } from "./secondaryNotes";

type StatusMap = Record<MetricKey, MetricStatus>;

const status = (overall: "pass" | "warn" | "fail", issue: MetricKey = "overall"): StatusMap => {
  const base: StatusMap = {
    level: { result: "pass", severity: "low" },
    noise: { result: "pass", severity: "low" },
    echo: { result: "pass", severity: "low" },
    clipping: { result: "pass", severity: "low" },
    overall: { result: overall, severity: overall === "pass" ? "low" : overall === "warn" ? "medium" : "high" }
  };

  if (issue !== "overall") {
    base[issue] = {
      result: overall,
      severity: overall === "pass" ? "low" : overall === "warn" ? "medium" : "high"
    };
  }

  return base;
};

const context = { useCase: "meetings" as const, deviceType: "unknown" as const };

describe("buildSecondaryNotes", () => {
  it("keeps notes informational with positive-first ordering and max two notes", () => {
    const fitByUseCase = {
      streaming: status("pass"),
      podcast: status("warn", "noise"),
      music: status("fail", "level")
    };

    const notes = buildSecondaryNotes({
      metricStatuses: status("pass"),
      context,
      primaryUseCaseFit: "pass",
      evaluateUseCaseFit: (useCase) => fitByUseCase[useCase]
    });

    expect(notes.length).toBeLessThanOrEqual(2);
    expect(notes[0]).toMatch(/Also good for/i);
    expect(notes[1]).toMatch(/Not ideal for/i);
  });

  it("adds level-based caution for harder failing use-cases", () => {
    const notes = buildSecondaryNotes({
      metricStatuses: status("pass"),
      context,
      primaryUseCaseFit: "pass",
      evaluateUseCaseFit: (useCase) => {
        if (useCase === "podcast") return status("fail", "level");
        if (useCase === "streaming") return status("pass");
        return status("pass");
      }
    });

    expect(notes.some((note) => /level is a bit low\/high/i.test(note))).toBe(true);
  });

  it("does not contradict a failing primary fit", () => {
    const notes = buildSecondaryNotes({
      metricStatuses: status("fail", "noise"),
      context,
      primaryUseCaseFit: "fail",
      evaluateUseCaseFit: (useCase) => {
        if (useCase === "streaming") return status("warn", "noise");
        return status("fail", "noise");
      }
    });

    expect(notes.join(" ").toLowerCase()).not.toContain("perfect");
    expect(notes.join(" ").toLowerCase()).toContain("may still work");
  });

  it("never emits claims about primary use-case suitability", () => {
    const notes = buildSecondaryNotes({
      metricStatuses: status("pass"),
      context,
      primaryUseCaseFit: "pass",
      evaluateUseCaseFit: () => status("warn", "echo")
    });

    expect(notes.join(" ").toLowerCase()).not.toContain("meetings");
  });
});
