// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeviceSelector from "./DeviceSelector";

describe("DeviceSelector", () => {
  const originalMediaDevices = navigator.mediaDevices;

  afterEach(() => {
    if (originalMediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", {
        value: originalMediaDevices,
        configurable: true
      });
    } else {
      delete (navigator as { mediaDevices?: MediaDevices }).mediaDevices;
    }

    window.localStorage.clear();
  });

  it("does not request microphone permission again on devicechange", async () => {
    const stopTrack = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: stopTrack }]
    });
    const enumerateDevices = vi.fn().mockResolvedValue([
      {
        deviceId: "default",
        kind: "audioinput",
        label: "Default Mic",
        groupId: "group"
      }
    ]);

    let onDeviceChangeHandler: (() => void) | undefined;

    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia,
        enumerateDevices,
        addEventListener: (_type: string, cb: () => void) => {
          onDeviceChangeHandler = cb;
        },
        removeEventListener: vi.fn()
      },
      configurable: true
    });

    const onDeviceChange = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(<DeviceSelector onDeviceChange={onDeviceChange} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(enumerateDevices).toHaveBeenCalledTimes(1);

    await act(async () => {
      onDeviceChangeHandler?.();
      await Promise.resolve();
    });

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(enumerateDevices).toHaveBeenCalledTimes(2);

    root.unmount();
  });
});
