import type {
  VerdictCategoryDescriptionKey,
  VerdictCategoryLabelKey,
  VerdictExplanationKey,
  VerdictFixKey,
  VerdictImpactKey,
  VerdictImpactSummaryKey,
  VerdictNoSpeechDescriptionKey,
  VerdictNoSpeechTitleKey,
  VerdictOverallLabelKey,
  VerdictOverallSummaryKey
} from "@miccheck/audio-metrics";

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
  | VerdictOverallSummaryKey;

const copyMap: Record<CopyKey, string> = {
  "category.level": "Level",
  "category.noise": "Noise",
  "category.echo": "Echo",
  "level.clipping_detected": "Clipping detected",
  "level.extremely_quiet": "Extremely quiet",
  "level.extremely_loud": "Extremely loud",
  "level.too_quiet": "Too quiet",
  "level.too_loud": "Too loud",
  "level.noticeably_off_target": "Noticeably off target",
  "level.slightly_off_target": "Slightly off target",
  "level.excellent": "Excellent level",
  "noise.very_clean": "Very clean",
  "noise.clean_background": "Clean background",
  "noise.some_background_noise": "Some background noise",
  "noise.noisy_background": "Noisy background",
  "noise.very_noisy": "Very noisy",
  "noise.electrical_hum": "Electrical hum detected",
  "echo.overwhelming": "Overwhelming echo",
  "echo.strong": "Strong echo",
  "echo.some_room_echo": "Some room echo",
  "echo.slight_reflections": "Slight reflections",
  "echo.minimal": "Minimal echo",
  "special.no_speech": "No speech detected.",
  "overall.label.excellent": "Excellent",
  "overall.label.good": "Good",
  "overall.label.fair": "Fair",
  "overall.label.needs_improvement": "Needs Improvement",
  "overall.label.unusable": "Unusable",
  "overall.summary.excellent": "Excellent clarity with minimal issues.",
  "overall.summary.strong": "Strong recording with minor improvements possible.",
  "overall.summary.fair": "Fair quality; targeted adjustments will help.",
  "overall.summary.noticeable": "Noticeable issues impacting clarity.",
  "overall.summary.severe": "Severe issues detected. Immediate fixes recommended.",
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
  "explanation.strong_echo": "Echo is noticeably affecting clarity.",
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
  "impact.echo": "echo",
  "impact.overall": "overall audio quality",
  "impact.no_major_issues": "No major issues detected across level, noise, or echo.",
  "impact.biggest_opportunity": "Strong overall — the biggest opportunity is {impact}.",
  "impact.mainly_affected": "Your grade is mainly affected by {impact}.",
  "no_speech.title": "No clear speech detected",
  "no_speech.description": "Please speak closer to the microphone or check if your mic is muted."
};

export const resolveCopy = (key: CopyKey, params?: Record<string, string>) => {
  let text = copyMap[key] ?? key;
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      text = text.replace(`{${paramKey}}`, paramValue);
    }
  }
  return text;
};
