import type { UseCase, VerdictCategoryDescriptionKey } from "../types";
import { getThresholdsForUseCase } from "../policy/thresholdMatrix";
import { describeLevel } from "./categoryScores";

export type LevelStatus = "excellent" | "good" | "acceptable" | "low";

export interface LevelInterpretation {
  levelStatus: LevelStatus;
  levelAdviceEnabled: boolean;
  levelCopyKey: VerdictCategoryDescriptionKey;
  noteKey?: "level.note_noise_first";
}

interface LevelInterpretationInput {
  rmsDb: number;
  clippingRatio: number;
  humRatio: number;
  useCase?: UseCase;
}

const statusFromStars = (stars: number): LevelStatus => {
  if (stars >= 5) return "excellent";
  if (stars === 4) return "good";
  if (stars === 3) return "acceptable";
  return "low";
};

export const interpretLevel = ({
  rmsDb,
  clippingRatio,
  humRatio,
  useCase = "meetings"
}: LevelInterpretationInput): LevelInterpretation => {
  const toleranceDb = 3;
  const meetingFloor = getThresholdsForUseCase("meetings").level.minRmsDb;
  const humThreshold = getThresholdsForUseCase(useCase).noise.humWarningRatio;
  const humPresent = humRatio >= humThreshold;
  const base = describeLevel(rmsDb, clippingRatio, useCase);

  if (base.descriptionKey === "level.clipping_detected") {
    return {
      levelStatus: statusFromStars(base.stars),
      levelAdviceEnabled: true,
      levelCopyKey: base.descriptionKey
    };
  }

  if (humPresent && rmsDb >= meetingFloor - toleranceDb) {
    return {
      levelStatus: "acceptable",
      levelAdviceEnabled: false,
      levelCopyKey: "level.acceptable_noise_first",
      noteKey: "level.note_noise_first"
    };
  }

  if (rmsDb < meetingFloor - toleranceDb) {
    return {
      levelStatus: "low",
      levelAdviceEnabled: true,
      levelCopyKey: "level.low"
    };
  }

  return {
    levelStatus: statusFromStars(base.stars),
    levelAdviceEnabled: true,
    levelCopyKey: base.descriptionKey
  };
};
