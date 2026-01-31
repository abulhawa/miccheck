import { describe, expect, it, vi } from "vitest";
import { describeBrowserSupport } from "./browser";

describe("describeBrowserSupport", () => {
  it("returns fallback issues when window and navigator are unavailable", () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("navigator", undefined);

    try {
      const result = describeBrowserSupport();

      expect(result).toEqual({
        isSupported: false,
        issues: ["Not running in a browser environment."]
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
