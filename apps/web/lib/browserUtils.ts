/**
 * Safely determine if the environment can access the microphone.
 */
export const hasMicrophoneSupport = (): boolean => {
  if (typeof window === "undefined") return false;
  return Boolean(navigator?.mediaDevices?.getUserMedia);
};

/**
 * Detect iOS and iPadOS devices (including iPad desktop-mode user agents).
 */
export const isIOSPlatform = (): boolean => {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent ?? "";
  if (/iPad|iPhone|iPod/i.test(userAgent)) {
    return true;
  }

  const platform = navigator.platform ?? "";
  return /Mac/i.test(platform) && navigator.maxTouchPoints > 1;
};

/**
 * Basic user-facing string for unsupported browsers.
 */
export const unsupportedMessage = (): string =>
  "Your browser does not support microphone recording. Please use Chrome, Edge, Firefox, or Safari.";
