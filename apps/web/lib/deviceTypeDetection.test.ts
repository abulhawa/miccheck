import { describe, expect, it } from "vitest";
import { detectDeviceTypeFromLabel } from "./deviceTypeDetection";

describe("detectDeviceTypeFromLabel", () => {
  it("detects bluetooth labels", () => {
    expect(detectDeviceTypeFromLabel("AirPods Pro Microphone")).toBe("bluetooth");
  });

  it("detects built-in labels", () => {
    expect(detectDeviceTypeFromLabel("MacBook Built-in Microphone Array")).toBe("built_in");
  });

  it("detects usb mics", () => {
    expect(detectDeviceTypeFromLabel("USB Audio Device - Shure MV7")).toBe("usb_mic");
  });
});
