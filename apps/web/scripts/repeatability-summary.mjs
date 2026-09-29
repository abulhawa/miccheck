// Descriptive statistics only: no significance gate or inferred uncertainty band.
export function summarize(values) {
  if (!values.length || values.some(x => !Number.isFinite(x))) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const differences = [];
  for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) differences.push(Math.abs(values[i] - values[j]));
  return { n: values.length, mean, median: sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2,
    min: sorted[0], max: sorted.at(-1), range: sorted.at(-1) - sorted[0],
    sampleSd: values.length > 1 ? Math.sqrt(values.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (values.length - 1)) : null,
    absolutePairDifferences: differences, pairCount: differences.length,
    pairDifferencesAreIndependent: false };
}

export function summarizeTakes(takes) {
  const eligible = takes.filter(t => !t.analysis.specialState && t.analysis.evidence?.noiseReliable && t.analysis.evidence?.noiseStability === 'stable' && t.analysis.evidence?.capture?.format === 'pcm' && ['echoCancellation', 'noiseSuppression', 'autoGainControl'].every(key => t.analysis.evidence.capture[key] === false));
  const fields = { speechRmsDb: 'dBFS', snrDb: 'dB', speechClippingRatio: 'fraction', clippedDurationSeconds: 'seconds', humRatio: 'fraction' };
  return { totalTakes: takes.length, eligibleTakes: eligible.length,
    excludedIds: takes.filter(t => !eligible.includes(t)).map(t => t.id),
    metrics: Object.fromEntries(Object.entries(fields).map(([key, unit]) => [key, { unit, all: summarize(takes.map(t => t.analysis.metrics[key])), eligible: summarize(eligible.map(t => t.analysis.metrics[key])) }])),
    speechSeconds: summarize(takes.map(t => t.analysis.evidence?.speechSeconds)),
    outcomes: takes.map(t => ({ id: t.id, specialState: t.analysis.specialState ?? null, noiseStability: t.analysis.evidence?.noiseStability, certainty: t.analysis.verdict.diagnosticCertainty, grade: t.analysis.verdict.overall.grade })),
    meaningfulChangeThreshold: null };
}
