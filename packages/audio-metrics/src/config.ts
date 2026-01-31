export const ANALYSIS_CONFIG = {
  // Clipping thresholds.
  clippingThreshold: 0.98,
  clippingRatioWarning: 0.005,
  clippingRatioSevere: 0.02,
  // Level targets tuned for raw microphone input.
  targetRmsDb: -18,
  targetRangeDb: 6,
  minRmsDb: -30,
  maxRmsDb: -8,
  minRmsDbSevere: -40,
  maxRmsDbSevere: -2,
  // Noise thresholds based on consumer/home studio expectations.
  snrExcellentDb: 45,
  snrGoodDb: 35,
  snrFairDb: 25,
  snrPoorDb: 15,
  snrSevereDb: 10,
  // Hum and echo detection thresholds.
  humWarningRatio: 0.08,
  echoWarningScore: 0.35,
  echoSevereScore: 0.75
};
