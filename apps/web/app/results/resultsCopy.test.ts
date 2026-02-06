import { describe, expect, it } from "vitest";
import { t } from "../../lib/i18n";

const requiredKeys = [
  "recommendation.reduce_echo",
  "results.sample.title",
  "results.sample.subtitle",
  "results.no_speech.badge",
  "results.cta.test_again",
  "results.sample.playback_locked",
  "results.next_steps.title",
  "results.next_steps.use_case_fit_label",
  "results.next_steps.certainty_label",
  "results.use_case_fit.pass",
  "results.use_case_fit.warn",
  "results.use_case_fit.fail",
  "results.use_case_fit.unknown",
  "results.certainty.low",
  "results.certainty.medium",
  "results.certainty.high",
  "results.certainty.unknown"
];

describe("results copy", () => {
  it("defines required keys in English", () => {
    requiredKeys.forEach((key) => {
      expect(t(key, undefined, "en")).not.toBe(key);
    });
  });
});
