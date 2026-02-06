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
    explanationKey: "overall.echo.impact_some",
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
        id: "usb-dynamic-mic",
        title: "USB dynamic mic",
        why: "Better rejection",
        category: "USB dynamic mic",
        relevance: "high",
        rationale: "Better rejection",
        affiliateUrl: "https://example.com/gear",
        linkStatus: "active"
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

  it("hides CTA when no active gear links exist", () => {
    const verdict = {
      ...baseVerdict,
      bestNextSteps: [
        {
          kind: "gear_optional",
          title: "Optional gear",
          gear: {
            id: "usb-dynamic-mic",
            title: "USB dynamic mic",
            why: "Better rejection",
            category: "USB dynamic mic",
            relevance: "high",
            rationale: "Better rejection",
            linkStatus: "missing"
          }
        }
      ]
    } satisfies WebVerdict;

    const html = renderToStaticMarkup(<BestNextSteps verdict={verdict} mode="pro" />);
    expect(html).not.toContain("View recommended gear");
  });

  it("shows CTA when active gear links exist", () => {
    const html = renderToStaticMarkup(<BestNextSteps verdict={baseVerdict} mode="pro" />);

    expect(html).toContain("View recommended gear");
  });

  it("adds noise-first gain advice when hum gate is active", () => {
    const verdict = {
      ...baseVerdict,
      primaryIssue: "noise",
      dimensions: {
        ...baseVerdict.dimensions,
        level: { stars: 3, labelKey: "category.level", descriptionKey: "level.acceptable_noise_first" }
      }
    } satisfies WebVerdict;

    const html = renderToStaticMarkup(<BestNextSteps verdict={verdict} mode="pro" />);

    expect(html).toContain("Fix the background hum first");
  });

  it("shows a warn note for echo when use case fit is warn", () => {
    const verdict = {
      ...baseVerdict,
      useCaseFit: "warn",
      primaryIssue: "echo"
    } satisfies WebVerdict;

    const html = renderToStaticMarkup(<BestNextSteps verdict={verdict} mode="pro" />);

    expect(html).toContain("echo may reduce clarity in larger rooms");
  });

  it("does not show a warn note when use case fit is pass or fail", () => {
    const passHtml = renderToStaticMarkup(
      <BestNextSteps verdict={{ ...baseVerdict, useCaseFit: "pass" }} mode="pro" />
    );
    const failHtml = renderToStaticMarkup(
      <BestNextSteps verdict={{ ...baseVerdict, useCaseFit: "fail" }} mode="pro" />
    );

    expect(passHtml).not.toContain("usecase.warn.");
    expect(failHtml).not.toContain("usecase.warn.");
    expect(passHtml).not.toContain("echo may reduce clarity in larger rooms");
    expect(failHtml).not.toContain("echo may reduce clarity in larger rooms");
  });

  it("shows only active gear links when expanded", async () => {
    const verdict = {
      ...baseVerdict,
      bestNextSteps: [
        {
          kind: "gear_optional",
          title: "Optional gear",
          gear: {
            id: "active-gear",
            title: "Active gear",
            why: "Active rationale",
            category: "USB dynamic mic",
            relevance: "high",
            rationale: "Active rationale",
            affiliateUrl: "https://example.com/active",
            linkStatus: "active"
          }
        },
        {
          kind: "gear_optional",
          title: "Optional gear",
          gear: {
            id: "disabled-gear",
            title: "Disabled gear",
            why: "Disabled rationale",
            category: "USB condenser mic",
            relevance: "high",
            rationale: "Disabled rationale",
            affiliateUrl: "https://example.com/disabled",
            linkStatus: "disabled"
          }
        }
      ]
    } satisfies WebVerdict;

    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(<BestNextSteps verdict={verdict} mode="pro" />);
    });

    const cta = container.querySelector("button");
    expect(cta?.textContent).toContain("View recommended gear");

    await act(async () => {
      cta?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Active gear");
    expect(container.textContent).not.toContain("Disabled gear");
    root.unmount();
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
