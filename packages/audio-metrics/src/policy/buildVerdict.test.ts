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

  it("honors context.use_case when scoring verdict dimensions", () => {
    const metrics = {
      clippingRatio: 0,
      rmsDb: -18,
      speechRmsDb: -18,
      snrDb: 30,
      humRatio: 0,
      echoScore: 0
    };

    const meetingsVerdict = buildVerdict(metrics, {
      mode: "pro",
      use_case: "meetings",
      device_type: "unknown"
    });
    const podcastVerdict = buildVerdict(metrics, {
      mode: "pro",
      use_case: "podcast",
      device_type: "unknown"
    });

    expect(meetingsVerdict.dimensions.noise.stars).toBe(4);
    expect(podcastVerdict.dimensions.noise.stars).toBe(3);
    expect(meetingsVerdict.overall.grade).toBe("B");
    expect(podcastVerdict.overall.grade).toBe("C");
  });
});
