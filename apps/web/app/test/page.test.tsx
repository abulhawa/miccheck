import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../../components/TestExperiencePage", () => ({
  default: ({ viewMode }: { viewMode: "basic" | "pro" }) => <div data-view-mode={viewMode} />
}));

import BasicTestPage from "./page";

describe("BasicTestPage", () => {
  it("renders the basic experience", () => {
    const html = renderToStaticMarkup(<BasicTestPage />);
    expect(html).toContain('data-view-mode="basic"');
  });
});
