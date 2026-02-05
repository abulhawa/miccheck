import { describe, expect, it } from "vitest";
import { evaluateMetrics } from "./evaluateMetrics";

describe("evaluateMetrics", () => {
  it("normalizes raw metrics to pass/warn/fail statuses", () => {
    const status = evaluateMetrics({
      rmsDb: -18,
      snrDb: 35,
      echoScore: 0.1,
      clippingRatio: 0,
      humRatio: 0
    });

    expect(status.level.result).toBe("pass");
    expect(status.noise.result).toBe("pass");
    expect(status.echo.result).toBe("pass");
    expect(status.overall.result).toBe("pass");
  });

  it("surfaces failing conditions with high severity", () => {
    const status = evaluateMetrics({
      rmsDb: -20,
      snrDb: 8,
      echoScore: 0.8,
      clippingRatio: 0.03,
      humRatio: 0.2
    });

    expect(status.noise.result).toBe("fail");
    expect(status.echo.result).toBe("fail");
    expect(status.clipping.result).toBe("fail");
    expect(status.overall.severity).toBe("high");
  });

  it("uses use-case-specific thresholds for category status", () => {
    const metrics = {
      rmsDb: -18,
      snrDb: 30,
      echoScore: 0.1,
      clippingRatio: 0,
      humRatio: 0
    };

    const meetingsStatus = evaluateMetrics(metrics, "meetings");
    const podcastStatus = evaluateMetrics(metrics, "podcast");

    expect(meetingsStatus.noise.result).toBe("pass");
    expect(podcastStatus.noise.result).toBe("warn");
  });

});
