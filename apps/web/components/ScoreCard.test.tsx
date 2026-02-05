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
    explanationKey: "explanation.strong_echo",
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
  it("shows numeric metric values and units in visible card content", () => {
    const html = renderToStaticMarkup(<ScoreCard verdict={verdict} metrics={metrics} />);

    expect(html).toContain("RMS: -22.3 dBFS");
    expect(html).toContain("SNR: 76.3 dB");
    expect(html).toContain("Echo: 0.31 score");
    expect(html).toContain("Clipping: 0.0%");
  });
});
