import { describe, expect, it } from "vitest";
import { buildVerdict } from "./buildVerdict";

describe("buildVerdict", () => {
  it("composes a full verdict from metrics", () => {
    const verdict = buildVerdict({
      clippingRatio: 0,
      rmsDb: -18,
      speechRmsDb: -18,
      snrDb: 40,
      humRatio: 0,
      echoScore: 0
    });

    expect(verdict.overall.grade).toBe("A");
    expect(verdict.primaryIssue).toBeNull();
    expect(verdict.copyKeys.fixKey).toBe("fix.keep_setup");
  });
});
