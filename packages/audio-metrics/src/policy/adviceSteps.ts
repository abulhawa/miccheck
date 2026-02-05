import type { CategoryId, ContextInput } from "../types";

export type AdviceStepKey =
  | "adjust_input_gain"
  | "move_mic_closer"
  | "increase_distance_from_mic"
  | "reduce_background_noise"
  | "treat_room_echo"
  | "check_system_mic_level"
  | "check_app_input_level"
  | "disable_audio_enhancements"
  | "disable_auto_volume"
  | "speak_louder"
  | "keep_headset_mic_facing_mouth"
  | "keep_head_angle_stable"
  | "check_charger_interference"
  | "check_power_interference"
  | "check_usb_port_interference"
  | "check_cables_grounding"
  | "consider_external_mic";

export interface AdviceStep {
  key: AdviceStepKey;
}

export const buildAdviceSteps = (
  primaryIssue: CategoryId | null,
  options: { isQuiet: boolean; hasHum: boolean; deviceType?: ContextInput["device_type"] }
): AdviceStep[] => {
  const deviceType = options.deviceType ?? "unknown";

  if (primaryIssue === "level") {
    if (deviceType === "bluetooth") {
      return [
        { key: "speak_louder" },
        { key: "keep_headset_mic_facing_mouth" },
        { key: "keep_head_angle_stable" },
        { key: "check_system_mic_level" },
        { key: "check_app_input_level" }
      ];
    }

    if (deviceType === "built_in") {
      return [
        { key: "check_system_mic_level" },
        { key: "check_app_input_level" },
        { key: "disable_audio_enhancements" },
        { key: "disable_auto_volume" }
      ];
    }

    return options.isQuiet
      ? [{ key: "adjust_input_gain" }, { key: "move_mic_closer" }]
      : [{ key: "adjust_input_gain" }, { key: "increase_distance_from_mic" }];
  }

  if (primaryIssue === "noise") {
    if (options.hasHum) {
      if (deviceType === "usb_mic") {
        return [{ key: "check_cables_grounding" }, { key: "check_usb_port_interference" }];
      }
      return [
        { key: "check_charger_interference" },
        { key: "check_power_interference" },
        { key: "check_usb_port_interference" }
      ];
    }

    if (deviceType === "bluetooth") {
      return [{ key: "reduce_background_noise" }, { key: "keep_headset_mic_facing_mouth" }];
    }

    return [{ key: "reduce_background_noise" }, { key: "move_mic_closer" }];
  }

  if (primaryIssue === "echo") {
    if (deviceType === "bluetooth") {
      return [{ key: "treat_room_echo" }, { key: "keep_headset_mic_facing_mouth" }];
    }
    return [{ key: "treat_room_echo" }, { key: "move_mic_closer" }];
  }

  return [];
};
