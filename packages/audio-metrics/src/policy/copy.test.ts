import { describe, expect, it } from "vitest";
import { echoImpactKeyForStars } from "./copy";

describe("echoImpactKeyForStars", () => {
  it("maps acceptable echo to the softer impact key", () => {
    expect(echoImpactKeyForStars(3)).toBe("overall.echo.impact_some");
  });
});
