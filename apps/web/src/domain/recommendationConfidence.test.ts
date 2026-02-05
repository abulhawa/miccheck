import { describe, expect, it } from "vitest";
import {
  HIGH_CONFIDENCE_LABEL,
  HIGH_CONFIDENCE_THRESHOLD,
  LOW_CONFIDENCE_LABEL,
  mapConfidenceToLabel,
  MODERATE_CONFIDENCE_LABEL,
  MODERATE_CONFIDENCE_THRESHOLD
} from "./recommendationConfidence";

describe("mapConfidenceToLabel", () => {
  it.each([
    { confidence: 0, expected: LOW_CONFIDENCE_LABEL },
    { confidence: MODERATE_CONFIDENCE_THRESHOLD - 0.01, expected: LOW_CONFIDENCE_LABEL },
    { confidence: MODERATE_CONFIDENCE_THRESHOLD, expected: MODERATE_CONFIDENCE_LABEL },
    {
      confidence: HIGH_CONFIDENCE_THRESHOLD - 0.01,
      expected: MODERATE_CONFIDENCE_LABEL
    },
    { confidence: HIGH_CONFIDENCE_THRESHOLD, expected: HIGH_CONFIDENCE_LABEL },
    { confidence: 1, expected: HIGH_CONFIDENCE_LABEL }
  ])("maps $confidence to $expected", ({ confidence, expected }) => {
    expect(mapConfidenceToLabel(confidence)).toBe(expected);
  });
});
