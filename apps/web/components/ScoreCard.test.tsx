import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ScoreCard from "./ScoreCard";
import type { MetricsSummary, WebVerdict } from "../types";
vi.mock("./ShareButton", () => ({
  default: () => null
}));

const verdict: WebVerdict = {
  version: "1.0",
  overall: {
    grade: "B",
    labelKey: "overall.label.good",
    summaryKey: "overall.summary.strong"
  },
  dimensions: {
    level: { stars: 4, labelKey: "category.level", descriptionKey: "level.slightly_off_target" },
    noise: { stars: 5, labelKey: "category.noise", descriptionKey: "noise.very_clean" },
    echo: { stars: 3, labelKey: "category.echo", descriptionKey: "echo.some_room_echo" }
  },
  primaryIssue: "echo",
  copyKeys: {
    explanationKey: "overall.echo.impact_some",
    fixKey: "fix.add_soft_furnishings_move_closer",
    impactKey: "impact.echo",
    impactSummaryKey: "impact.biggest_opportunity"
  }
};

const metrics: MetricsSummary = {
  clippingRatio: 0,
  rmsDb: -22.3,
  speechRmsDb: -21.9,
  snrDb: 76.3,
  humRatio: 0,
  echoScore: 0.31
};

describe("ScoreCard", () => {
  it("qualifies zero detected-speech clipping when crossings remain unclassified", () => {
    const html = renderToStaticMarkup(<ScoreCard verdict={verdict} metrics={{...metrics, speechClippingRatio:0, unselectedClippedDurationSeconds:0.02, clippedDurationSeconds:0.02}} />);
    expect(html).toContain('Clipping in detected speech: 0.0%');
    expect(html).toContain('0.020 seconds of near-full-scale samples occur outside detected speech after calibration');
    expect(html).toContain('Speech clipping may be underestimated');
  });
  it("keeps sub-millisecond crossings visible and supports older stored results", () => {
    const html = renderToStaticMarkup(<ScoreCard verdict={verdict} metrics={{...metrics, speechClippingRatio:0, unselectedClippedDurationSeconds:1/48000}} />);
    expect(html).toContain('Less than 0.001 seconds');
    expect(renderToStaticMarkup(<ScoreCard verdict={verdict} metrics={metrics} />)).not.toContain('Speech clipping may be underestimated');
  });
  it("distinguishes speech clipping from recording-wide near-full-scale duration", () => {
    const html = renderToStaticMarkup(<ScoreCard verdict={verdict} metrics={{...metrics, clippingRatio:0.03, speechClippingRatio:0.03, clippedDurationSeconds:0.125}} />);
    expect(html).toContain('Clipping in detected speech: 3.0%');
    expect(html).toContain('0.125 seconds');
    expect(html).toContain('possible clipping');
  });
  it("shows numeric metric values and units in visible card content", () => {
    const html = renderToStaticMarkup(<ScoreCard verdict={verdict} metrics={metrics} />);

    expect(html).toContain("RMS: -22.3 dBFS");
    expect(html).toContain("SNR: 76.3 dB");
    expect(html).toContain("Echo: 0.31 score");
    expect(html).toContain("Clipping: 0.0%");
  });

  it("removes duplicate Excellent subtitles and softens negligible clipping", () => {
    const excellentVerdict: WebVerdict = {
      ...verdict,
      overall: {
        grade: "A",
        labelKey: "overall.label.excellent",
        summaryKey: "overall.summary.excellent"
      },
      copyKeys: {
        ...verdict.copyKeys,
        explanationKey: "overall.label.excellent"
      }
    };
    const excellentMetrics: MetricsSummary = { ...metrics, clippingRatio: 0.002 };

    const html = renderToStaticMarkup(<ScoreCard verdict={excellentVerdict} metrics={excellentMetrics} />);

    expect(html).not.toContain("– Excellent");
    expect(html).toContain("Clipping: negligible (0.2%)");
  });

  it("keeps the explanation for non-Excellent grades", () => {
    const html = renderToStaticMarkup(<ScoreCard verdict={verdict} metrics={metrics} />);

    expect(html).toContain("– Some room echo is present.");
  });
});
