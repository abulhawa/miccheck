import { describe, expect, it, vi } from "vitest";
import { describeBrowserSupport } from "./browser";

describe("describeBrowserSupport", () => {
  it("returns fallback issues when window and navigator are unavailable", () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("navigator", undefined);

    try {
      const result = describeBrowserSupport();

      expect(result).toEqual({
        isSupported: false,
        issues: ["Not running in a browser environment."]
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("flags getUserMedia when navigator.mediaDevices.getUserMedia is unavailable", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { mediaDevices: {} });
    vi.stubGlobal("AudioContext", function AudioContext() {});
    vi.stubGlobal("MediaRecorder", function MediaRecorder() {});

    try {
      const result = describeBrowserSupport();

      expect(result).toEqual({
        isSupported: false,
        issues: ["getUserMedia is unavailable."]
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("flags Web Audio API when both AudioContext and webkitAudioContext are unavailable", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("MediaRecorder", function MediaRecorder() {});

    try {
      const result = describeBrowserSupport();

      expect(result).toEqual({
        isSupported: false,
        issues: ["Web Audio API is unavailable."]
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("flags MediaRecorder when MediaRecorder is unavailable", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });
    vi.stubGlobal("AudioContext", function AudioContext() {});
    vi.stubGlobal("MediaRecorder", undefined);

    try {
      const result = describeBrowserSupport();

      expect(result).toEqual({
        isSupported: false,
        issues: ["MediaRecorder is unavailable."]
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("flags getUserMedia and Web Audio API in order when both are unavailable", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { mediaDevices: {} });
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("MediaRecorder", function MediaRecorder() {});

    try {
      const result = describeBrowserSupport();

      expect(result).toEqual({
        isSupported: false,
        issues: ["getUserMedia is unavailable.", "Web Audio API is unavailable."]
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("flags getUserMedia and MediaRecorder in order when both are unavailable", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { mediaDevices: {} });
    vi.stubGlobal("AudioContext", function AudioContext() {});
    vi.stubGlobal("MediaRecorder", undefined);

    try {
      const result = describeBrowserSupport();

      expect(result).toEqual({
        isSupported: false,
        issues: ["getUserMedia is unavailable.", "MediaRecorder is unavailable."]
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("flags Web Audio API and MediaRecorder in order when both are unavailable", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("MediaRecorder", undefined);

    try {
      const result = describeBrowserSupport();

      expect(result).toEqual({
        isSupported: false,
        issues: ["Web Audio API is unavailable.", "MediaRecorder is unavailable."]
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("flags all missing browser APIs in stable order", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { mediaDevices: {} });
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("MediaRecorder", undefined);

    try {
      const result = describeBrowserSupport();

      expect(result).toEqual({
        isSupported: false,
        issues: [
          "getUserMedia is unavailable.",
          "Web Audio API is unavailable.",
          "MediaRecorder is unavailable."
        ]
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
