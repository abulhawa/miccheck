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
        getUserMedia: vi.fn(),
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

    expect(enumerateDevices).toHaveBeenCalledTimes(1);

    await act(async () => {
      onDeviceChangeHandler?.();
      await Promise.resolve();
    });

    expect(enumerateDevices).toHaveBeenCalledTimes(2);

    root.unmount();
  });

  it("ignores stale device refresh results that resolve out of order", async () => {
    const firstRefreshResult = [
      {
        deviceId: "old-device",
        kind: "audioinput",
        label: "Old Mic",
        groupId: "group"
      }
    ];
    const secondRefreshResult = [
      {
        deviceId: "new-device",
        kind: "audioinput",
        label: "New Mic",
        groupId: "group"
      }
    ];

    let resolveFirstRefresh: ((value: MediaDeviceInfo[]) => void) | undefined;
    const enumerateDevices = vi
      .fn()
      .mockResolvedValueOnce(secondRefreshResult)
      .mockImplementationOnce(
        () =>
          new Promise<MediaDeviceInfo[]>((resolve) => {
            resolveFirstRefresh = resolve;
          })
      )
      .mockResolvedValueOnce(secondRefreshResult);

    let onDeviceChangeHandler: (() => void) | undefined;

    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn(),
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

    onDeviceChange.mockClear();

    await act(async () => {
      onDeviceChangeHandler?.();
      await Promise.resolve();
    });

    await act(async () => {
      onDeviceChangeHandler?.();
      await Promise.resolve();
    });

    await act(async () => {
      resolveFirstRefresh?.(firstRefreshResult as MediaDeviceInfo[]);
      await Promise.resolve();
    });

    expect(onDeviceChange).toHaveBeenCalledTimes(1);
    expect(onDeviceChange).toHaveBeenLastCalledWith("new-device", {
      label: "New Mic",
      detectedType: "unknown"
    });

    root.unmount();
  });

  it("retries once on transient empty device list during devicechange", async () => {
    const enumerateDevices = vi
      .fn()
      .mockResolvedValueOnce([
        {
          deviceId: "default",
          kind: "audioinput",
          label: "Default Mic",
          groupId: "group"
        }
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
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
        getUserMedia: vi.fn(),
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

    onDeviceChange.mockClear();

    await act(async () => {
      onDeviceChangeHandler?.();
      await Promise.resolve();
    });

    expect(enumerateDevices).toHaveBeenCalledTimes(3);
    expect(onDeviceChange).toHaveBeenCalledWith("default", {
      label: "Default Mic",
      detectedType: "unknown"
    });

    root.unmount();
  });
});
