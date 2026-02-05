import type { UseCase } from "../types";
import { ANALYSIS_CONFIG } from "../config";

export interface UseCaseThresholds {
  clipping: {
    warningRatio: number;
    severeRatio: number;
  };
  level: {
    targetRmsDb: number;
    targetRangeDb: number;
    minRmsDb: number;
    maxRmsDb: number;
    minRmsDbSevere: number;
    maxRmsDbSevere: number;
  };
  noise: {
    snrExcellentDb: number;
    snrGoodDb: number;
    snrFairDb: number;
    snrPoorDb: number;
    humWarningRatio: number;
  };
  echo: {
    warningScore: number;
    severeScore: number;
    moderateFactor: number;
    lightFactor: number;
  };
}

const meetingsThresholds: UseCaseThresholds = {
  clipping: {
    warningRatio: ANALYSIS_CONFIG.clippingRatioWarning,
    severeRatio: ANALYSIS_CONFIG.clippingRatioSevere
  },
  level: {
    targetRmsDb: ANALYSIS_CONFIG.targetRmsDb,
    targetRangeDb: ANALYSIS_CONFIG.targetRangeDb,
    minRmsDb: ANALYSIS_CONFIG.minRmsDb,
    maxRmsDb: ANALYSIS_CONFIG.maxRmsDb,
    minRmsDbSevere: ANALYSIS_CONFIG.minRmsDbSevere,
    maxRmsDbSevere: ANALYSIS_CONFIG.maxRmsDbSevere
  },
  noise: {
    snrExcellentDb: ANALYSIS_CONFIG.snrExcellentDb,
    snrGoodDb: ANALYSIS_CONFIG.snrGoodDb,
    snrFairDb: ANALYSIS_CONFIG.snrFairDb,
    snrPoorDb: ANALYSIS_CONFIG.snrPoorDb,
    humWarningRatio: ANALYSIS_CONFIG.humWarningRatio
  },
  echo: {
    warningScore: ANALYSIS_CONFIG.echoWarningScore,
    severeScore: ANALYSIS_CONFIG.echoSevereScore,
    moderateFactor: 0.7,
    lightFactor: 0.4
  }
};

export const thresholdMatrix: Record<UseCase, UseCaseThresholds> = {
  meetings: meetingsThresholds,
  podcast: {
    ...meetingsThresholds,
    noise: {
      ...meetingsThresholds.noise,
      snrGoodDb: ANALYSIS_CONFIG.snrExcellentDb,
      snrFairDb: ANALYSIS_CONFIG.snrGoodDb,
      snrPoorDb: ANALYSIS_CONFIG.snrFairDb
    }
  },
  streaming: meetingsThresholds,
  voice_note: {
    ...meetingsThresholds,
    noise: {
      ...meetingsThresholds.noise,
      snrExcellentDb: ANALYSIS_CONFIG.snrGoodDb,
      snrGoodDb: ANALYSIS_CONFIG.snrFairDb,
      snrFairDb: ANALYSIS_CONFIG.snrPoorDb
    }
  }
};

export const getThresholdsForUseCase = (useCase: UseCase): UseCaseThresholds =>
  thresholdMatrix[useCase];
