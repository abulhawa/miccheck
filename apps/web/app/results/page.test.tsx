import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("../../components/ShareButton", () => ({
  default: () => null
}));

import ResultsPage from "./page";

describe("ResultsPage", () => {
  it("shows the sample tag on the demo page", () => {
    const html = renderToStaticMarkup(<ResultsPage />);
    expect(html).toContain("Example: common home-office setup");
  });
});
