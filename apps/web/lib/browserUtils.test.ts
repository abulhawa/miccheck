import { describe, expect, it } from "vitest";
import { hasMicrophoneSupport, unsupportedMessage } from "./browserUtils";

describe("browserUtils", () => {
  it("returns false for microphone support on the server", () => {
    expect(hasMicrophoneSupport()).toBe(false);
  });

  it("returns a helpful unsupported message", () => {
    expect(unsupportedMessage()).toBe(
      "Your browser does not support microphone recording. Please use Chrome, Edge, Firefox, or Safari."
    );
  });
});
