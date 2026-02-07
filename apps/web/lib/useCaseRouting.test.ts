import { describe, expect, it } from "vitest";
import {
  buildUseCaseTestHref,
  resolveDiscoverySource,
  resolveUseCaseFromQueryParam
} from "./useCaseRouting";

describe("useCaseRouting", () => {
  it("builds a pro-test URL with use_case", () => {
    expect(buildUseCaseTestHref("meetings")).toBe("/pro?use_case=meetings");
    expect(buildUseCaseTestHref("podcast")).toBe("/pro?use_case=podcast");
    expect(buildUseCaseTestHref("streaming")).toBe("/pro?use_case=streaming");
  });

  it("builds a pro-test URL with discovery source", () => {
    expect(buildUseCaseTestHref("meetings", "mic-test-for-zoom")).toBe(
      "/pro?use_case=meetings&discovery_source=mic-test-for-zoom"
    );
  });

  it("resolves valid use_case values", () => {
    expect(resolveUseCaseFromQueryParam("meetings")).toBe("meetings");
    expect(resolveUseCaseFromQueryParam("podcast")).toBe("podcast");
    expect(resolveUseCaseFromQueryParam("streaming")).toBe("streaming");
  });

  it("rejects invalid use_case values", () => {
    expect(resolveUseCaseFromQueryParam("")).toBeNull();
    expect(resolveUseCaseFromQueryParam("invalid")).toBeNull();
    expect(resolveUseCaseFromQueryParam("zoom")).toBeNull();
    expect(resolveUseCaseFromQueryParam(null)).toBeNull();
  });

  it("resolves discovery source with utm priority", () => {
    expect(
      resolveDiscoverySource({
        utmSource: "google",
        utmCampaign: "spring_launch",
        landingRoute: "mic-test"
      })
    ).toBe("utm:google:spring_launch");
    expect(resolveDiscoverySource({ utmSource: "newsletter" })).toBe("utm_source:newsletter");
    expect(resolveDiscoverySource({ utmCampaign: "retargeting" })).toBe("utm_campaign:retargeting");
  });

  it("resolves discovery source from route fallback", () => {
    expect(resolveDiscoverySource({ landingRoute: "mic-test-for-zoom" })).toBe(
      "landing:mic-test-for-zoom"
    );
    expect(resolveDiscoverySource({ fallbackRoute: "test" })).toBe("route:test");
  });
});
