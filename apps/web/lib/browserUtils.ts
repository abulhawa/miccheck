/**
 * Safely determine if the environment can access the microphone.
 */
export const hasMicrophoneSupport = (): boolean => {
  if (typeof window === "undefined") return false;
  return Boolean(navigator?.mediaDevices?.getUserMedia);
};

/**
 * Basic user-facing string for unsupported browsers.
 */
export const unsupportedMessage = (): string =>
  "Your browser does not support microphone recording. Please use Chrome, Edge, Firefox, or Safari.";
