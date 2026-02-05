export interface AnalysisScoringContract {
  targetRmsDb: number;
  targetRangeDb: number;
  snrGoodDb: number;
}

/**
 * Mirrors key scoring thresholds from @miccheck/audio-metrics/src/config.ts.
 */
export const ANALYSIS_SCORING_CONTRACT: AnalysisScoringContract = {
  targetRmsDb: -18,
  targetRangeDb: 6,
  snrGoodDb: 25
};

export interface AnalysisDisplayThresholds {
  levelTargetDbfs: number;
  levelAcceptableMinDbfs: number;
  levelAcceptableMaxDbfs: number;
  snrCleanThresholdDb: number;
  snrCleanLoudnessRatio: number;
}

const snrCleanLoudnessRatio = Math.round(10 ** (ANALYSIS_SCORING_CONTRACT.snrGoodDb / 20));

export const analysisDisplayThresholds: AnalysisDisplayThresholds = {
  levelTargetDbfs: ANALYSIS_SCORING_CONTRACT.targetRmsDb,
  levelAcceptableMinDbfs:
    ANALYSIS_SCORING_CONTRACT.targetRmsDb - ANALYSIS_SCORING_CONTRACT.targetRangeDb,
  levelAcceptableMaxDbfs:
    ANALYSIS_SCORING_CONTRACT.targetRmsDb + ANALYSIS_SCORING_CONTRACT.targetRangeDb,
  snrCleanThresholdDb: ANALYSIS_SCORING_CONTRACT.snrGoodDb,
  snrCleanLoudnessRatio
};
