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
  it("shows runnable synthetic examples without reading a private recording", () => {
    const html = renderToStaticMarkup(<ResultsPage />);
    expect(html).toContain("Interactive demo");
    expect(html).toContain("No microphone permission needed");
    expect(html).toContain("Too much gain");
  });
});
