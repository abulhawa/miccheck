export interface BrowserSupport {
  isSupported: boolean;
  issues: string[];
}

/**
 * Check availability of required browser APIs.
 */
export const describeBrowserSupport = (): BrowserSupport => {
  const issues: string[] = [];
  const hasWindow = typeof window !== "undefined";
  const hasNavigator = typeof navigator !== "undefined";
  if (!hasWindow || !hasNavigator) {
    issues.push("Not running in a browser environment.");
    return {
      isSupported: false,
      issues
    };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    issues.push("getUserMedia is unavailable.");
  }
  if (typeof AudioContext === "undefined" && typeof (window as any).webkitAudioContext === "undefined") {
    issues.push("Web Audio API is unavailable.");
  }
  if (typeof MediaRecorder === "undefined") {
    issues.push("MediaRecorder is unavailable.");
  }

  return {
    isSupported: issues.length === 0,
    issues
  };
};
