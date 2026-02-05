import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BestNextSteps from "./BestNextSteps";
import type { WebVerdict } from "../types";

const baseVerdict: WebVerdict = {
  version: "1.0",
  overall: {
    grade: "C",
    labelKey: "overall.label.fair",
    summaryKey: "overall.summary.fair"
  },
  dimensions: {
    level: { stars: 3, labelKey: "category.level", descriptionKey: "level.slightly_off_target" },
    noise: { stars: 3, labelKey: "category.noise", descriptionKey: "noise.some_background_noise" },
    echo: { stars: 3, labelKey: "category.echo", descriptionKey: "echo.some_room_echo" }
  },
  primaryIssue: "echo",
  copyKeys: {
    explanationKey: "explanation.strong_echo",
    fixKey: "fix.add_soft_furnishings_move_closer",
    impactKey: "impact.echo",
    impactSummaryKey: "impact.mainly_affected"
  }
};

describe("BestNextSteps", () => {
  it("renders nothing when there are no next steps", () => {
    const html = renderToStaticMarkup(<BestNextSteps verdict={{ ...baseVerdict, bestNextSteps: [] }} />);
    expect(html).toBe("");
  });

  it("renders gear suggestion text without affiliate link when affiliateUrl is absent", () => {
    const html = renderToStaticMarkup(
      <BestNextSteps
        verdict={{
          ...baseVerdict,
          bestNextSteps: [
            { kind: "action", title: "Move closer" },
            {
              kind: "gear_optional",
              title: "Optional gear",
              gear: { category: "USB dynamic mic", relevance: "medium", rationale: "Better rejection" }
            }
          ]
        }}
      />
    );

    expect(html).toContain("Optional gear");
    expect(html).not.toContain("View recommended gear");
  });

  it("renders affiliate link when affiliateUrl is present", () => {
    const html = renderToStaticMarkup(
      <BestNextSteps
        verdict={{
          ...baseVerdict,
          bestNextSteps: [
            { kind: "action", title: "Move closer" },
            {
              kind: "gear_optional",
              title: "Optional gear",
              gear: {
                category: "USB dynamic mic",
                relevance: "high",
                rationale: "Better rejection",
                affiliateUrl: "https://example.com/gear"
              }
            }
          ]
        }}
      />
    );

    expect(html).toContain("View recommended gear");
    expect(html).toContain("https://example.com/gear");
  });
});
