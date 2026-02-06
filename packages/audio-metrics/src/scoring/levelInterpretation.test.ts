import { describe, expect, it } from "vitest";
import { interpretLevel } from "./levelInterpretation";

describe("interpretLevel", () => {
  it("marks borderline level as acceptable when hum is present", () => {
    const result = interpretLevel({
      rmsDb: -20,
      clippingRatio: 0,
      humRatio: 0.12,
      useCase: "meetings"
    });

    expect(result.levelStatus).toBe("acceptable");
    expect(result.levelAdviceEnabled).toBe(false);
    expect(result.levelCopyKey).toBe("level.acceptable_noise_first");
  });

  it("treats truly low level as low even when hum is present", () => {
    const result = interpretLevel({
      rmsDb: -35,
      clippingRatio: 0,
      humRatio: 0.12,
      useCase: "meetings"
    });

    expect(result.levelStatus).toBe("low");
    expect(result.levelAdviceEnabled).toBe(true);
    expect(result.levelCopyKey).toBe("level.low");
  });

  it("keeps existing mapping when hum is absent", () => {
    const result = interpretLevel({
      rmsDb: -23,
      clippingRatio: 0,
      humRatio: 0,
      useCase: "meetings"
    });

    expect(result.levelAdviceEnabled).toBe(true);
    expect(result.levelCopyKey).toBe("level.slightly_off_target");
  });
});
