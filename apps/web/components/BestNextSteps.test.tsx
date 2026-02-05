// @vitest-environment jsdom
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BestNextSteps from "./BestNextSteps";
import type { WebVerdict } from "../types";

const logEventMock = vi.fn();

vi.mock("../lib/analytics", () => ({
  ANALYTICS_EVENTS: {
    adviceEmitted: "advice_emitted"
  },
  logEvent: (...args: unknown[]) => logEventMock(...args)
}));

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
  },
  diagnosticCertainty: "medium",
  secondaryNotes: ["Try moving away from reflective surfaces."],
  bestNextSteps: [
    { kind: "action", title: "Move closer" },
    { kind: "action", title: "Reduce background fan noise" },
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
};

afterEach(() => {
  logEventMock.mockReset();
});

describe("BestNextSteps", () => {
  it("renders basic constraints", () => {
    const html = renderToStaticMarkup(
      <BestNextSteps
        verdict={baseVerdict}
        includeGear={false}
        includeSecondaryNotes={false}
        maxActionSteps={1}
        showDiagnosticCertainty={false}
      />
    );

    expect(html).toContain("Move closer");
    expect(html).not.toContain("Reduce background fan noise");
    expect(html).not.toContain("Diagnostic certainty");
    expect(html).not.toContain("Optional gear");
    expect(html).not.toContain("Try moving away from reflective surfaces.");
  });

  it("renders pro details", () => {
    const html = renderToStaticMarkup(<BestNextSteps verdict={baseVerdict} mode="pro" />);

    expect(html).toContain("Reduce background fan noise");
    expect(html).toContain("Diagnostic certainty: medium");
    expect(html).toContain("Optional gear");
    expect(html).toContain("Try moving away from reflective surfaces.");
  });

  it("fires advice event once for repeated render with same verdict", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(<BestNextSteps verdict={baseVerdict} mode="pro" />);
    });

    await act(async () => {
      root.render(<BestNextSteps verdict={baseVerdict} mode="pro" />);
    });

    expect(logEventMock).toHaveBeenCalledTimes(1);
    root.unmount();
  });
});
