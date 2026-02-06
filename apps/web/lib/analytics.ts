import { track } from "@vercel/analytics/react";

export const ANALYTICS_EVENTS = {
  startRecording: "miccheck_start_recording",
  recordingCompleted: "miccheck_recording_completed",
  viewResults: "miccheck_view_results",
  testAgain: "miccheck_test_again",
  permissionDenied: "miccheck_permission_denied",
  recordingFailed: "miccheck_recording_failed",
  unsupportedBrowser: "miccheck_unsupported_browser",
  analysisCompleted: "analysis_completed",
  adviceEmitted: "advice_emitted",
  reRecordClicked: "re_record_clicked",
  affiliateClick: "affiliate_click"
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type AnalyticsDevice = "mobile" | "desktop";
export type AnalyticsBrowser = "safari" | "chrome" | "firefox" | "edge" | "other";
export type AnalyticsReason = "no_mediarecorder" | "not_secure_context" | "unknown";

export interface AnalyticsProps {
  device?: AnalyticsDevice;
  browser?: AnalyticsBrowser;
  reason?: AnalyticsReason;
  [key: string]: string | number | boolean | string[] | undefined;
}

const getDevice = (): AnalyticsDevice => {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return "desktop";
  }
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) return "mobile";
  return window.innerWidth <= 768 ? "mobile" : "desktop";
};

const getBrowser = (): AnalyticsBrowser => {
  if (typeof navigator === "undefined") {
    return "other";
  }
  const userAgent = navigator.userAgent;
  if (/Edg\//i.test(userAgent)) return "edge";
  if (/Firefox\//i.test(userAgent)) return "firefox";
  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return "safari";
  if (/Chrome\//i.test(userAgent)) return "chrome";
  return "other";
};

export const getAnalyticsContext = () => ({
  device: getDevice(),
  browser: getBrowser()
});

export const logEvent = (name: AnalyticsEventName, props: AnalyticsProps = {}) => {
  if (typeof window === "undefined") return;
  const context = getAnalyticsContext();
  track(name, { ...context, ...props });
};
