import { describe, expect, it } from "vitest";
import {
  GEAR_CATALOG,
  getGearCatalogItemById,
  getGearRecommendationsForIssue,
  getPrimaryGearRecommendation
} from "../gearCatalog";

describe("gearCatalog", () => {
  it("keeps gear ids unique", () => {
    const ids = GEAR_CATALOG.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("provides a primary recommendation for each issue", () => {
    expect(getPrimaryGearRecommendation("echo")?.id).toBe("acoustic-foam-panels");
    expect(getPrimaryGearRecommendation("noise")?.id).toBe("usb-dynamic-mic");
    expect(getPrimaryGearRecommendation("level")?.id).toBe("microphone-arm");
  });

  it("shows when one gear item supports multiple issues", () => {
    const dynamicMic = getGearCatalogItemById("usb-dynamic-mic");
    expect(dynamicMic?.supportsIssues).toEqual(["noise", "echo"]);
  });

  it("returns issue-grouped recommendations with primary first", () => {
    const echoGear = getGearRecommendationsForIssue("echo");
    expect(echoGear[0]?.id).toBe("acoustic-foam-panels");
    expect(echoGear.some((item) => item.id === "usb-dynamic-mic")).toBe(true);
  });
});
