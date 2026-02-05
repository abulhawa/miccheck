import type { CategoryId, ContextInput, DiagnosticCertainty } from "../types";
import { applyDeviceConstraints } from "./deviceConstraints";
import {
  selectAdviceTemplate,
  type AdviceDeviceType,
  type AdviceFailureMode,
  type AdviceMetric,
  type AdviceUseCase
} from "./adviceLibrary";

export type AdviceStepKey =
  | "adjust_input_gain"
  | "move_mic_closer"
  | "increase_distance_from_mic"
  | "reduce_background_noise"
  | "treat_room_echo"
  | "enable_echo_cancellation"
  | "reposition_mic_away_from_speakers"
  | "check_system_mic_level"
  | "check_app_input_level"
  | "disable_audio_enhancements"
  | "disable_auto_volume"
  | "speak_louder"
  | "speak_softer"
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

interface BuildAdviceStepOptions {
  isQuiet: boolean;
  hasHum: boolean;
  clippingDetected?: boolean;
  echoScore?: number;
  useCase?: ContextInput["use_case"];
  deviceType?: ContextInput["device_type"];
  diagnosticCertainty?: DiagnosticCertainty;
}

const mapDeviceType = (deviceType: ContextInput["device_type"]): AdviceDeviceType => {
  if (deviceType === "usb_mic") return "usb_mic";
  if (deviceType === "bluetooth" || deviceType === "headset") return "bluetooth_headset";
  if (["built_in", "laptop", "desktop", "mobile"].includes(deviceType)) return "built_in_mic";
  return "unknown";
};

const mapUseCase = (useCase: ContextInput["use_case"]): AdviceUseCase => {
  if (useCase === "voice_note") return "podcast";
  return useCase;
};

const lowCertaintyChecks = (deviceType: AdviceDeviceType): AdviceStep[] => {
  if (deviceType === "bluetooth_headset") {
    return [
      { key: "check_system_mic_level" },
      { key: "check_app_input_level" },
      { key: "keep_headset_mic_facing_mouth" }
    ];
  }

  if (deviceType === "built_in_mic") {
    return [
      { key: "check_system_mic_level" },
      { key: "disable_audio_enhancements" },
      { key: "disable_auto_volume" }
    ];
  }

  if (deviceType === "usb_mic") {
    return [
      { key: "check_system_mic_level" },
      { key: "check_app_input_level" },
      { key: "adjust_input_gain" }
    ];
  }

  return [
    { key: "check_system_mic_level" },
    { key: "check_app_input_level" },
    { key: "move_mic_closer" }
  ];
};

const determineMode = (
  primaryIssue: CategoryId | null,
  options: BuildAdviceStepOptions
): { metric: AdviceMetric; failureMode: AdviceFailureMode } => {
  if (options.clippingDetected && primaryIssue === "level") {
    return { metric: "clipping", failureMode: "clipping" };
  }

  if (primaryIssue === "noise") {
    return { metric: "noise", failureMode: options.hasHum ? "constant_hum" : "general_noise" };
  }

  if (primaryIssue === "echo") {
    return { metric: "echo", failureMode: (options.echoScore ?? 0) >= 0.7 ? "strong_echo" : "roomy" };
  }

  if (primaryIssue === "level") {
    return { metric: "level", failureMode: options.isQuiet ? "low" : "high" };
  }

  return { metric: "level", failureMode: options.isQuiet ? "low" : "high" };
};

export const buildAdviceSteps = (primaryIssue: CategoryId | null, options: BuildAdviceStepOptions): AdviceStep[] => {
  const deviceType = mapDeviceType(options.deviceType ?? "unknown");
  const useCase = mapUseCase(options.useCase ?? "meetings");

  const shouldUseHypothesisChecks =
    options.diagnosticCertainty === "low" && !options.hasHum && !options.clippingDetected;

  const baseSteps = shouldUseHypothesisChecks
    ? lowCertaintyChecks(deviceType)
    : selectAdviceTemplate({
        ...determineMode(primaryIssue, options),
        useCase,
        deviceType
      });

  return applyDeviceConstraints(baseSteps, {
    device_type: options.deviceType ?? "unknown"
  });
};
