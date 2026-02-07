import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ResultsNotice from "./ResultsNotice";

describe("ResultsNotice", () => {
  it("shows notice for NO_SPEECH special state", () => {
    const html = renderToStaticMarkup(
      <ResultsNotice diagnosticCertainty="high" specialState="NO_SPEECH" />
    );
    expect(html).toContain("No speech was detected");
  });

  it("shows notice for low diagnostic certainty", () => {
    const html = renderToStaticMarkup(<ResultsNotice diagnosticCertainty="low" />);
    expect(html).toContain("Results may be less reliable");
  });

  it("hides notice for medium/high certainty without special state", () => {
    const mediumHtml = renderToStaticMarkup(<ResultsNotice diagnosticCertainty="medium" />);
    const highHtml = renderToStaticMarkup(<ResultsNotice diagnosticCertainty="high" />);

    expect(mediumHtml).toBe("");
    expect(highHtml).toBe("");
  });
});
