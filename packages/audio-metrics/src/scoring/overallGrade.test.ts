import { describe, expect, it } from "vitest";
import { buildCategoryScores } from "./categoryScores";
import { computeOverallGrade } from "./overallGrade";

const buildSummary = (rmsDb: number, snrDb: number) => {
  const categories = buildCategoryScores(
    { rms: 0, rmsDb },
    { clippingRatio: 0, peak: 0 },
    { noiseFloor: 0, snrDb, humRatio: 0 },
    { echoScore: 0 }
  );

  return computeOverallGrade(categories, {
    clippingRatio: 0,
    rmsDb,
    speechRmsDb: rmsDb,
    snrDb,
    humRatio: 0,
    echoScore: 0
  });
};

describe("computeOverallGrade", () => {
  it("grades professional input as an A", () => {
    const result = buildSummary(-18, 45);
    expect(result.grade).toBe("A");
  });

  it("grades a good call as a C", () => {
    const result = buildSummary(-23, 27);
    expect(result.grade).toBe("B");
  });

  it("grades needs-work input as a D", () => {
    const result = buildSummary(-30, 20);
    expect(result.grade).toBe("C");
  });

  it("grades poor input as an F", () => {
    const result = buildSummary(-35, 12);
    expect(result.grade).toBe("D");
  });

  it("grades very noisy input as an F", () => {
    const result = buildSummary(-18, 4);
    expect(result.grade).toBe("F");
  });
});
