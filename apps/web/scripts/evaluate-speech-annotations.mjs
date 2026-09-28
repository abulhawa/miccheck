/** Compare worker segments with frozen, provisional source labels, never calling them ground truth. */
export function evaluateSpeechAnnotations(clip, segments, offsetSeconds = 2) {
  const duration = clip.durationSeconds;
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(offsetSeconds)) throw new Error('Invalid duration or offset');
  let boundary = 0;
  for (const interval of clip.intervals) {
    if (!Number.isFinite(interval.start) || !Number.isFinite(interval.end) || Math.abs(interval.start - boundary) > 1e-6 || interval.end <= interval.start || interval.end > duration + 1e-6) throw new Error('Annotations must form an ordered full source partition');
    boundary = interval.end;
  }
  if (Math.abs(boundary - duration) > 1e-6) throw new Error('Annotations must cover source duration');
  if (segments.some(s => !Number.isFinite(s.start) || !Number.isFinite(s.end) || s.start > s.end)) throw new Error('Invalid detector segment');
  const predicted = segments.map(({start, end}) => ({
    start: Math.max(0, start - offsetSeconds), end: Math.min(duration, end - offsetSeconds),
  })).filter(x => x.end > x.start).sort((a, b) => a.start - b.start);
  // Union protects duration totals from overlapping detector intervals.
  const union = [];
  for (const interval of predicted) {
    const last = union.at(-1);
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else union.push({...interval});
  }
  const seconds = {truePositive: 0, falsePositive: 0, falseNegative: 0, trueNegative: 0, excludedUncertain: 0};
  for (const interval of clip.intervals) {
    const length = interval.end - interval.start;
    if (interval.label === 'uncertain') { seconds.excludedUncertain += length; continue; }
    const overlap = union.reduce((sum, p) => sum + Math.max(0, Math.min(interval.end, p.end) - Math.max(interval.start, p.start)), 0);
    if (interval.label === 'speech') {
      seconds.truePositive += overlap; seconds.falseNegative += length - overlap;
    } else if (interval.label === 'nonspeech') {
      seconds.falsePositive += overlap; seconds.trueNegative += length - overlap;
    } else throw new Error(`Unknown annotation label: ${interval.label}`);
  }
  const divide = (a, b) => b > 0 ? a / b : null;
  const words = clip.words ?? [];
  return {
    status: 'provisional_pseudo_label_agreement_not_accuracy', scope: 'original_source_clip_only', seconds,
    evaluatedCoverage: divide(duration - seconds.excludedUncertain, duration),
    pseudoLabelAgreementPrecision: divide(seconds.truePositive, seconds.truePositive + seconds.falsePositive),
    pseudoLabelAgreementRecall: divide(seconds.truePositive, seconds.truePositive + seconds.falseNegative),
    candidateBoundaryDifferences: {
      status: 'model_word_timing_comparison_not_boundary_error',
      firstStartSeconds: union.length && words.length ? union[0].start - words[0].start : null,
      lastEndSeconds: union.length && words.length ? union.at(-1).end - words.at(-1).end : null,
      uncertainty: 'Word timestamps are model estimates; collars and all uncertain intervals are excluded from agreement metrics.',
    },
  };
}
