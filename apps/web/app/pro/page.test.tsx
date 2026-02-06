import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../../components/TestExperiencePage", () => ({
  default: ({ viewMode }: { viewMode: "basic" | "pro" }) => <div data-view-mode={viewMode} />
}));

import ProTestPage from "./page";

describe("ProTestPage", () => {
  it("renders the pro experience", () => {
    const html = renderToStaticMarkup(<ProTestPage />);
    expect(html).toContain('data-view-mode="pro"');
    expect(html).not.toContain("Example: common home-office setup");
  });
});
