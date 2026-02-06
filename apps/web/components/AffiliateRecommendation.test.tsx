import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AffiliateRecommendation from "./AffiliateRecommendation";

describe("AffiliateRecommendation", () => {
  it("renders the card without a link when affiliates are disabled", () => {
    process.env.NEXT_PUBLIC_AFFILIATES_ENABLED = "false";

    const html = renderToStaticMarkup(<AffiliateRecommendation issueCategory="echo" />);

    expect(html).toContain("Acoustic Foam Panels");
    expect(html).toContain("No links available right now.");
    expect(html).not.toContain("https://amzn.to/4qTnyHf");
  });

  it("renders the affiliate link when affiliates are enabled", () => {
    process.env.NEXT_PUBLIC_AFFILIATES_ENABLED = "true";

    const html = renderToStaticMarkup(<AffiliateRecommendation issueCategory="noise" />);

    expect(html).toContain("FIFINE USB Microphone");
    expect(html).toContain("https://amzn.to/4rpWH5l");
  });
});
