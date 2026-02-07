import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MicTestLandingPage, { metadata as micTestMetadata } from "./mic-test/page";
import MicTestForZoomLandingPage, {
  metadata as zoomMetadata
} from "./mic-test-for-zoom/page";
import MicTestForPodcastLandingPage, {
  metadata as podcastMetadata
} from "./mic-test-for-podcast/page";
import MicTestForStreamingLandingPage, {
  metadata as streamingMetadata
} from "./mic-test-for-streaming/page";
import MicTestForMusicRecordingLandingPage, {
  metadata as musicRecordingMetadata
} from "./mic-test-for-music-recording/page";

describe("SEO landing pages", () => {
  it("renders mic-test with meetings preselected", () => {
    const html = renderToStaticMarkup(<MicTestLandingPage />);
    expect(html).toContain("Test your mic");
    expect(html).toContain('href="/pro?use_case=meetings"');
    expect(micTestMetadata.title).toBe("Mic Test");
  });

  it("renders mic-test-for-zoom with meetings preselected", () => {
    const html = renderToStaticMarkup(<MicTestForZoomLandingPage />);
    expect(html).toContain("Test your mic");
    expect(html).toContain('href="/pro?use_case=meetings"');
    expect(zoomMetadata.title).toBe("Mic Test For Zoom");
  });

  it("renders mic-test-for-podcast with podcast preselected", () => {
    const html = renderToStaticMarkup(<MicTestForPodcastLandingPage />);
    expect(html).toContain("Test your mic");
    expect(html).toContain('href="/pro?use_case=podcast"');
    expect(podcastMetadata.title).toBe("Mic Test For Podcast");
  });

  it("renders mic-test-for-streaming with streaming preselected", () => {
    const html = renderToStaticMarkup(<MicTestForStreamingLandingPage />);
    expect(html).toContain("Test your mic");
    expect(html).toContain('href="/pro?use_case=streaming"');
    expect(streamingMetadata.title).toBe("Mic Test For Streaming");
  });

  it("renders mic-test-for-music-recording with podcast preselected", () => {
    const html = renderToStaticMarkup(<MicTestForMusicRecordingLandingPage />);
    expect(html).toContain("Test your mic");
    expect(html).toContain('href="/pro?use_case=podcast"');
    expect(musicRecordingMetadata.title).toBe("Mic Test For Music Recording");
  });
});
