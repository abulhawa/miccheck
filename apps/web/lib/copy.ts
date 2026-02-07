import type {
  VerdictCategoryDescriptionKey,
  VerdictCategoryLabelKey,
  VerdictCopyKeys,
  VerdictExplanationKey,
  VerdictFixKey,
  VerdictImpactKey,
  VerdictImpactSummaryKey,
  VerdictNoSpeechDescriptionKey,
  VerdictNoSpeechTitleKey,
  VerdictOverallLabelKey,
  VerdictOverallSummaryKey,
  RecommendationCopyKey
} from "@miccheck/audio-metrics";
import { t } from "./i18n";

export type AppCopyKey =
  | "error.silent_recording"
  | "ui.overall_grade"
  | "ui.metric.clipping"
  | "ui.metric.rms"
  | "ui.metric.snr";

export type CopyKey =
  | VerdictCategoryDescriptionKey
  | VerdictCategoryLabelKey
  | VerdictExplanationKey
  | VerdictFixKey
  | VerdictImpactKey
  | VerdictImpactSummaryKey
  | VerdictNoSpeechDescriptionKey
  | VerdictNoSpeechTitleKey
  | VerdictOverallLabelKey
  | VerdictOverallSummaryKey
  | RecommendationCopyKey
  | AppCopyKey;

const copyMap: Partial<Record<CopyKey, string>> = {
  "level.clipping_detected": "Clipping detected",
  "level.extremely_quiet": "Extremely quiet",
  "level.extremely_loud": "Extremely loud",
  "level.too_quiet": "Too quiet",
  "level.too_loud": "Too loud",
  "noise.clean_background": "Clean background",
  "noise.some_background_noise": "Some background noise",
  "noise.noisy_background": "Noisy background",
  "noise.very_noisy": "Very noisy",
  "noise.electrical_hum": "Electrical hum detected",
  "echo.overwhelming": "Overwhelming echo",
  "echo.strong": "Strong echo",
  "echo.slight_reflections": "Slight reflections",
  "echo.minimal": "Minimal echo",
  "special.no_speech": "No speech detected.",
  "overall.label.excellent": "Excellent",
  "overall.label.fair": "Fair",
  "overall.label.needs_improvement": "Needs Improvement",
  "overall.label.unusable": "Unusable",
  "overall.summary.excellent": "Excellent clarity with minimal issues.",
  "overall.summary.no_speech": "No clear speech detected.",
  "explanation.clipping_distortion": "Clipping is distorting the audio signal.",
  "explanation.extremely_quiet": "The recording is extremely quiet and hard to understand.",
  "explanation.extremely_loud": "The recording is extremely loud and likely distorting.",
  "explanation.too_quiet": "The recording is too quiet to be clear.",
  "explanation.too_loud": "The recording is too loud and may distort.",
  "explanation.noticeably_off_target": "Levels are noticeably off the ideal range.",
  "explanation.some_background_noise": "Background noise is noticeable in the recording.",
  "explanation.noisy_background": "Background noise is competing with the voice.",
  "explanation.very_noisy": "Background noise is overpowering the voice.",
  "explanation.electrical_hum": "Electrical hum is present in the background.",
  "explanation.overwhelming_echo": "Severe echo is obscuring speech clarity.",
  "explanation.some_room_echo": "Room reflections are softening speech detail.",
  "explanation.no_speech": "No clear speech detected.",
  "fix.lower_gain_move_back": "Lower the input gain or move farther from the microphone.",
  "fix.increase_gain_move_closer": "Increase input gain or move closer to the microphone.",
  "fix.lower_gain_move_back_slight": "Lower the input gain or move back from the microphone.",
  "fix.nudge_gain": "Nudge your input gain toward the target level.",
  "fix.reduce_noise_quieter_space": "Reduce ambient noise or move to a quieter space.",
  "fix.reduce_noise_directional_mic": "Reduce ambient noise or use a closer, directional microphone.",
  "fix.silence_room_close_mic": "Silence the room or use a close mic to improve SNR.",
  "fix.check_cables_grounding": "Check cables, grounding, or nearby interference sources.",
  "fix.add_acoustic_treatment_move_closer": "Add acoustic treatment or move much closer to the microphone.",
  "fix.add_soft_furnishings_move_closer": "Add soft furnishings or move closer to the microphone to reduce reflections.",
  "fix.light_acoustic_treatment_close_mic": "Add light acoustic treatment or close the mic distance.",
  "fix.keep_setup": "Keep your current setup for consistent results.",
  "fix.targeted_adjustments": "Make targeted adjustments to improve clarity.",
  "fix.no_speech": "Please speak closer to the microphone or check if your mic is muted.",
  "impact.level": "recording level",
  "impact.noise": "background noise",
  "impact.overall": "overall audio quality",
  "impact.no_major_issues": "No major issues detected across level, noise, or echo.",
  "impact.mainly_affected": "Your grade is mainly affected by {impact}.",
  "recommendation.reduce_clipping":
    "Reduce input gain or move slightly farther from the mic to prevent clipping.",
  "recommendation.reduce_noise":
    "Lower background noise by turning off fans or switching to a quieter room.",
  "recommendation.raise_volume": "Increase mic gain or move closer to the microphone.",
  "recommendation.keep_consistent":
    "Your microphone sounds solid. Keep consistent distance and speak clearly.",
  "recommendation.no_speech": "Please speak closer to the microphone or check if your mic is muted.",
  "error.silent_recording": "Recording is silent. Please speak closer to the microphone.",
  "ui.metric.rms": "RMS",
  "ui.metric.snr": "SNR"
};

const copyMapAllowListPrefixes = [
  "category.",
  "level.",
  "noise.",
  "echo.",
  "special.",
  "overall.",
  "explanation.",
  "fix.",
  "impact.",
  "no_speech.",
  "recommendation."
] as const;

const isAllowListedCopyKey = (key: CopyKey) =>
  key === "ui.overall_grade" ||
  key.startsWith("ui.metric.") ||
  key.startsWith("error.") ||
  copyMapAllowListPrefixes.some((prefix) => key.startsWith(prefix));

export const resolveCopy = (key: CopyKey, params?: Record<string, string>) => {
  const translated = t(key, params);
  if (translated !== key) {
    return translated;
  }

  if (process.env.NODE_ENV === "development") {
    console.warn("[copy] missing key", key);
  }

  if (!isAllowListedCopyKey(key)) {
    return key;
  }

  let text = copyMap[key] ?? key;
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      text = text.replace(`{${paramKey}}`, paramValue);
    }
  }
  return text;
};

export const resolveNoSpeechCopy = (verdictCopyKeys: VerdictCopyKeys) => ({
  title: resolveCopy(verdictCopyKeys.noSpeechTitleKey ?? "no_speech.title"),
  description: resolveCopy(verdictCopyKeys.noSpeechDescriptionKey ?? "no_speech.description")
});
