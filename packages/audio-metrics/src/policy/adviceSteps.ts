import type { CategoryId } from "../types";

export type AdviceStepKey =
  | "adjust_input_gain"
  | "move_mic_closer"
  | "increase_distance_from_mic"
  | "reduce_background_noise"
  | "treat_room_echo"
  | "consider_external_mic";

export interface AdviceStep {
  key: AdviceStepKey;
}

/**
 * Build a minimal ladder of behavior-first fixes for the current primary issue.
 */
export const buildAdviceSteps = (
  primaryIssue: CategoryId | null,
  options: { isQuiet: boolean }
): AdviceStep[] => {
  if (primaryIssue === "level") {
    return options.isQuiet
      ? [{ key: "adjust_input_gain" }, { key: "move_mic_closer" }]
      : [{ key: "adjust_input_gain" }, { key: "increase_distance_from_mic" }];
  }

  if (primaryIssue === "noise") {
    return [{ key: "reduce_background_noise" }, { key: "move_mic_closer" }];
  }

  if (primaryIssue === "echo") {
    return [{ key: "treat_room_echo" }, { key: "move_mic_closer" }];
  }

  return [];
};
