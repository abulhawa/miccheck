import { describe, expect, it } from "vitest";
import { buildUseCaseTestHref, resolveUseCaseFromQueryParam } from "./useCaseRouting";

describe("useCaseRouting", () => {
  it("builds a pro-test URL with use_case", () => {
    expect(buildUseCaseTestHref("meetings")).toBe("/pro?use_case=meetings");
    expect(buildUseCaseTestHref("podcast")).toBe("/pro?use_case=podcast");
    expect(buildUseCaseTestHref("streaming")).toBe("/pro?use_case=streaming");
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
});
