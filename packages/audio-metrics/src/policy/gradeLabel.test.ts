import { describe, expect, it } from "vitest";
import { getOverallLabelKeyForGrade, getOverallSummaryKeyForGrade } from "./gradeLabel";

describe("gradeLabel policy", () => {
  it("maps A- to approved canonical keys", () => {
    expect(getOverallLabelKeyForGrade("A-")).toBe("overall.label.good");
    expect(getOverallSummaryKeyForGrade("A-")).toBe("overall.summary.strong");
  });

  it("maps F to unusable/severe keys", () => {
    expect(getOverallLabelKeyForGrade("F")).toBe("overall.label.unusable");
    expect(getOverallSummaryKeyForGrade("F")).toBe("overall.summary.severe");
  });
});
