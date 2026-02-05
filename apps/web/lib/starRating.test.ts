import { describe, expect, it } from "vitest";
import { toStarRating } from "./starRating";

describe("toStarRating", () => {
  it("5 stars never shows a negative label", () => {
    expect(toStarRating({ stars: 5, descriptionKey: "level.slightly_off_target" }).label).toBe("Excellent");
  });
});
