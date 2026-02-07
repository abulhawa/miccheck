import { afterEach, describe, expect, it } from "vitest";
import { hasMicrophoneSupport, isIOSPlatform, unsupportedMessage } from "./browserUtils";

const restoreNavigator = (previousNavigator: Navigator | undefined) => {
  if (previousNavigator) {
    Object.defineProperty(globalThis, "navigator", {
      value: previousNavigator,
      configurable: true,
      writable: true
    });
    return;
  }
  delete (globalThis as { navigator?: Navigator }).navigator;
};

describe("browserUtils", () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    restoreNavigator(originalNavigator);
  });

  it("returns false for microphone support on the server", () => {
    delete (globalThis as { navigator?: Navigator }).navigator;
    expect(hasMicrophoneSupport()).toBe(false);
  });

  it("returns false for iOS detection on the server", () => {
    delete (globalThis as { navigator?: Navigator }).navigator;
    expect(isIOSPlatform()).toBe(false);
  });

  it("detects iPhone user agents", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15",
        platform: "iPhone",
        maxTouchPoints: 5
      },
      configurable: true,
      writable: true
    });

    expect(isIOSPlatform()).toBe(true);
  });

  it("detects iPadOS desktop-mode user agents", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        platform: "MacIntel",
        maxTouchPoints: 5
      },
      configurable: true,
      writable: true
    });

    expect(isIOSPlatform()).toBe(true);
  });

  it("returns a helpful unsupported message", () => {
    expect(unsupportedMessage()).toBe(
      "Your browser does not support microphone recording. Please use Chrome, Edge, Firefox, or Safari."
    );
  });
});
