import { describe, expect, it } from "vitest";
import { computeOverallGrade } from "./overallGrade";

const buildSummary = (rmsDb: number, snrDb: number) => {
  return computeOverallGrade({
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

  it("picks noise with hum when SNR is otherwise strong", () => {
    const result = computeOverallGrade({
      clippingRatio: 0,
      rmsDb: -18,
      speechRmsDb: -18,
      snrDb: 40,
      humRatio: 0.2,
      echoScore: 0
    });

    expect(result.primaryIssueCategory).toBe("noise");
    expect(result.explanation.toLowerCase()).toContain("hum");
    expect(result.fix.toLowerCase()).toContain("cable");
    expect(result.fix.toLowerCase()).toContain("ground");
  });

  it("surfaces clipping as the primary level issue", () => {
    const result = computeOverallGrade({
      clippingRatio: 0.01,
      rmsDb: -18,
      speechRmsDb: -18,
      snrDb: 40,
      humRatio: 0,
      echoScore: 0
    });

    expect(result.primaryIssueCategory).toBe("level");
    expect(result.explanation.toLowerCase()).toContain("clipping");
    expect(result.fix.toLowerCase()).toContain("gain");
  });

  it("surfaces echo as the primary issue when reflections are strong", () => {
    const result = computeOverallGrade({
      clippingRatio: 0,
      rmsDb: -18,
      speechRmsDb: -18,
      snrDb: 40,
      humRatio: 0,
      echoScore: 0.6
    });

    expect(result.primaryIssueCategory).toBe("echo");
    expect(result.fix.toLowerCase()).toContain("closer");
  });

  it("avoids the balanced copy for low grades", () => {
    const result = computeOverallGrade({
      clippingRatio: 0,
      rmsDb: -30,
      speechRmsDb: -30,
      snrDb: 20,
      humRatio: 0,
      echoScore: 0
    });

    expect(result.grade).toBe("C");
    expect(result.explanation.toLowerCase()).not.toContain("balanced");
    expect(result.explanation.toLowerCase()).not.toContain("minimal");
  });
});
