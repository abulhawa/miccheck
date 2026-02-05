import type { AdviceTemplateStep } from "./adviceSteps";

export type AdviceMetric = "level" | "noise" | "echo" | "clipping";
export type AdviceFailureMode =
  | "low"
  | "high"
  | "general_noise"
  | "constant_hum"
  | "roomy"
  | "strong_echo"
  | "clipping";
export type AdviceUseCase = "meetings" | "streaming" | "podcast" | "music";
export type AdviceDeviceType = "bluetooth_headset" | "built_in_mic" | "usb_mic" | "unknown";

export interface AdviceTemplateEntry {
  metric: AdviceMetric;
  failureMode: AdviceFailureMode;
  useCase?: AdviceUseCase;
  deviceType?: AdviceDeviceType;
  steps: AdviceTemplateStep[];
}

const t = (entry: AdviceTemplateEntry): AdviceTemplateEntry => entry;

export const adviceTemplates: AdviceTemplateEntry[] = [
  // Level: low
  t({ metric: "level", failureMode: "low", useCase: "podcast", deviceType: "bluetooth_headset", steps: [{ key: "speak_louder" }, { key: "keep_headset_mic_facing_mouth" }, { key: "check_system_mic_level" }] }),
  t({ metric: "level", failureMode: "low", useCase: "podcast", deviceType: "usb_mic", steps: [{ key: "move_mic_closer" }, { key: "adjust_input_gain" }, { key: "check_app_input_level" }] }),
  t({ metric: "level", failureMode: "low", useCase: "meetings", deviceType: "bluetooth_headset", steps: [{ key: "speak_louder" }, { key: "keep_head_angle_stable" }, { key: "check_app_input_level" }] }),
  t({ metric: "level", failureMode: "low", useCase: "streaming", deviceType: "usb_mic", steps: [{ key: "move_mic_closer" }, { key: "adjust_input_gain" }, { key: "check_system_mic_level" }] }),
  t({ metric: "level", failureMode: "low", useCase: "music", deviceType: "usb_mic", steps: [{ key: "move_mic_closer" }, { key: "adjust_input_gain" }] }),
  t({ metric: "level", failureMode: "low", useCase: "podcast", steps: [{ key: "speak_louder" }, { key: "check_system_mic_level" }, { key: "check_app_input_level" }] }),
  t({ metric: "level", failureMode: "low", deviceType: "built_in_mic", steps: [{ key: "speak_louder" }, { key: "check_system_mic_level" }, { key: "disable_audio_enhancements" }] }),
  t({ metric: "level", failureMode: "low", steps: [{ key: "move_mic_closer" }, { key: "check_system_mic_level" }] }),

  // Level: high
  t({ metric: "level", failureMode: "high", useCase: "podcast", deviceType: "bluetooth_headset", steps: [{ key: "speak_softer" }, { key: "check_app_input_level" }, { key: "disable_auto_volume" }] }),
  t({ metric: "level", failureMode: "high", useCase: "streaming", deviceType: "bluetooth_headset", steps: [{ key: "speak_softer" }, { key: "check_system_mic_level" }, { key: "disable_auto_volume" }] }),
  t({ metric: "level", failureMode: "high", useCase: "podcast", steps: [{ key: "increase_distance_from_mic" }, { key: "check_app_input_level" }, { key: "disable_auto_volume" }] }),
  t({ metric: "level", failureMode: "high", useCase: "streaming", steps: [{ key: "increase_distance_from_mic" }, { key: "check_system_mic_level" }] }),
  t({ metric: "level", failureMode: "high", deviceType: "bluetooth_headset", steps: [{ key: "speak_softer" }, { key: "check_system_mic_level" }, { key: "check_app_input_level" }] }),
  t({ metric: "level", failureMode: "high", deviceType: "usb_mic", steps: [{ key: "increase_distance_from_mic" }, { key: "adjust_input_gain" }] }),
  t({ metric: "level", failureMode: "high", deviceType: "built_in_mic", steps: [{ key: "speak_softer" }, { key: "check_system_mic_level" }, { key: "disable_auto_volume" }] }),
  t({ metric: "level", failureMode: "high", steps: [{ key: "speak_softer" }, { key: "increase_distance_from_mic" }, { key: "check_app_input_level" }] }),

  // Noise: general
  t({ metric: "noise", failureMode: "general_noise", useCase: "meetings", deviceType: "bluetooth_headset", steps: [{ key: "reduce_background_noise" }, { key: "keep_head_angle_stable" }, { key: "disable_audio_enhancements" }] }),
  t({ metric: "noise", failureMode: "general_noise", useCase: "streaming", deviceType: "bluetooth_headset", steps: [{ key: "reduce_background_noise" }, { key: "keep_headset_mic_facing_mouth" }, { key: "check_app_input_level" }] }),
  t({ metric: "noise", failureMode: "general_noise", useCase: "podcast", deviceType: "bluetooth_headset", steps: [{ key: "reduce_background_noise" }, { key: "keep_headset_mic_facing_mouth" }, { key: "check_system_mic_level" }] }),
  t({ metric: "noise", failureMode: "general_noise", useCase: "music", deviceType: "bluetooth_headset", steps: [{ key: "reduce_background_noise" }, { key: "keep_head_angle_stable" }] }),
  t({ metric: "noise", failureMode: "general_noise", useCase: "meetings", steps: [{ key: "reduce_background_noise" }, { key: "move_mic_closer" }, { key: "disable_audio_enhancements" }] }),
  t({ metric: "noise", failureMode: "general_noise", useCase: "streaming", steps: [{ key: "reduce_background_noise" }, { key: "move_mic_closer" }, { key: "check_app_input_level" }] }),
  t({ metric: "noise", failureMode: "general_noise", useCase: "podcast", steps: [{ key: "reduce_background_noise" }, { key: "move_mic_closer" }, { key: "check_system_mic_level" }] }),
  t({ metric: "noise", failureMode: "general_noise", useCase: "music", steps: [{ key: "reduce_background_noise" }, { key: "move_mic_closer" }] }),
  t({ metric: "noise", failureMode: "general_noise", deviceType: "bluetooth_headset", steps: [{ key: "reduce_background_noise" }, { key: "keep_headset_mic_facing_mouth" }] }),
  t({ metric: "noise", failureMode: "general_noise", steps: [{ key: "reduce_background_noise" }, { key: "move_mic_closer" }] }),

  // Noise: constant hum
  t({ metric: "noise", failureMode: "constant_hum", deviceType: "built_in_mic", steps: [{ key: "check_charger_interference" }, { key: "check_power_interference" }, { key: "check_usb_port_interference" }] }),
  t({ metric: "noise", failureMode: "constant_hum", deviceType: "usb_mic", steps: [{ key: "check_usb_port_interference" }, { key: "check_cables_grounding" }, { key: "check_power_interference" }] }),
  t({ metric: "noise", failureMode: "constant_hum", useCase: "podcast", steps: [{ key: "check_charger_interference" }, { key: "check_usb_port_interference" }, { key: "check_system_mic_level" }] }),
  t({ metric: "noise", failureMode: "constant_hum", useCase: "music", steps: [{ key: "check_power_interference" }, { key: "check_usb_port_interference" }] }),
  t({ metric: "noise", failureMode: "constant_hum", steps: [{ key: "check_charger_interference" }, { key: "check_power_interference" }] }),

  // Echo: roomy
  t({ metric: "echo", failureMode: "roomy", useCase: "meetings", deviceType: "bluetooth_headset", steps: [{ key: "keep_head_angle_stable" }, { key: "enable_echo_cancellation" }] }),
  t({ metric: "echo", failureMode: "roomy", useCase: "podcast", deviceType: "bluetooth_headset", steps: [{ key: "treat_room_echo" }, { key: "keep_headset_mic_facing_mouth" }] }),
  t({ metric: "echo", failureMode: "roomy", useCase: "meetings", steps: [{ key: "move_mic_closer" }, { key: "enable_echo_cancellation" }] }),
  t({ metric: "echo", failureMode: "roomy", useCase: "podcast", steps: [{ key: "treat_room_echo" }, { key: "move_mic_closer" }] }),
  t({ metric: "echo", failureMode: "roomy", useCase: "music", steps: [{ key: "treat_room_echo" }, { key: "reposition_mic_away_from_speakers" }] }),
  t({ metric: "echo", failureMode: "roomy", deviceType: "bluetooth_headset", steps: [{ key: "keep_headset_mic_facing_mouth" }, { key: "enable_echo_cancellation" }] }),
  t({ metric: "echo", failureMode: "roomy", steps: [{ key: "treat_room_echo" }, { key: "move_mic_closer" }] }),

  // Echo: strong
  t({ metric: "echo", failureMode: "strong_echo", useCase: "meetings", deviceType: "bluetooth_headset", steps: [{ key: "keep_headset_mic_facing_mouth" }, { key: "reposition_mic_away_from_speakers" }, { key: "enable_echo_cancellation" }] }),
  t({ metric: "echo", failureMode: "strong_echo", useCase: "podcast", deviceType: "bluetooth_headset", steps: [{ key: "treat_room_echo" }, { key: "keep_head_angle_stable" }, { key: "reposition_mic_away_from_speakers" }] }),
  t({ metric: "echo", failureMode: "strong_echo", useCase: "music", deviceType: "bluetooth_headset", steps: [{ key: "treat_room_echo" }, { key: "reposition_mic_away_from_speakers" }, { key: "keep_headset_mic_facing_mouth" }] }),
  t({ metric: "echo", failureMode: "strong_echo", useCase: "meetings", steps: [{ key: "move_mic_closer" }, { key: "reposition_mic_away_from_speakers" }, { key: "enable_echo_cancellation" }] }),
  t({ metric: "echo", failureMode: "strong_echo", useCase: "podcast", steps: [{ key: "treat_room_echo" }, { key: "move_mic_closer" }, { key: "reposition_mic_away_from_speakers" }] }),
  t({ metric: "echo", failureMode: "strong_echo", useCase: "music", steps: [{ key: "treat_room_echo" }, { key: "reposition_mic_away_from_speakers" }, { key: "move_mic_closer" }] }),
  t({ metric: "echo", failureMode: "strong_echo", deviceType: "bluetooth_headset", steps: [{ key: "keep_headset_mic_facing_mouth" }, { key: "enable_echo_cancellation" }] }),
  t({ metric: "echo", failureMode: "strong_echo", steps: [{ key: "treat_room_echo" }, { key: "move_mic_closer" }, { key: "enable_echo_cancellation" }] }),

  // Clipping
  t({ metric: "clipping", failureMode: "clipping", useCase: "podcast", deviceType: "usb_mic", steps: [{ key: "speak_softer" }, { key: "adjust_input_gain" }, { key: "increase_distance_from_mic" }] }),
  t({ metric: "clipping", failureMode: "clipping", useCase: "meetings", steps: [{ key: "speak_softer" }, { key: "check_system_mic_level" }, { key: "check_app_input_level" }] }),
  t({ metric: "clipping", failureMode: "clipping", deviceType: "built_in_mic", steps: [{ key: "speak_softer" }, { key: "check_system_mic_level" }, { key: "disable_auto_volume" }] }),
  t({ metric: "clipping", failureMode: "clipping", steps: [{ key: "speak_softer" }, { key: "check_system_mic_level" }, { key: "check_app_input_level" }] })
];

interface AdviceTemplateSelectionInput {
  metric: AdviceMetric;
  failureMode: AdviceFailureMode;
  useCase: AdviceUseCase;
  deviceType: AdviceDeviceType;
}

const matches = (
  template: AdviceTemplateEntry,
  input: AdviceTemplateSelectionInput,
  mode: "exact" | "useCase" | "device" | "global"
): boolean => {
  if (template.metric !== input.metric || template.failureMode !== input.failureMode) return false;
  if (mode === "exact") return template.useCase === input.useCase && template.deviceType === input.deviceType;
  if (mode === "useCase") return template.useCase === input.useCase && !template.deviceType;
  if (mode === "device") return template.deviceType === input.deviceType && !template.useCase;
  return !template.useCase && !template.deviceType;
};

export const selectAdviceTemplate = (input: AdviceTemplateSelectionInput): AdviceTemplateStep[] => {
  const priority: Array<"exact" | "useCase" | "device" | "global"> = ["exact", "useCase", "device", "global"];

  for (const mode of priority) {
    const found = adviceTemplates.find((template) => matches(template, input, mode));
    if (found) {
      return found.steps;
    }
  }

  return [];
};
