export interface SoundHint {label: string; score: number; advice: string}
// A deliberately small experimental subset of the official AudioSet class map.
const classes = [
  {index:378,label:'Typing',advice:'Move the microphone away from the keyboard or mute while typing.'},
  {index:380,label:'Computer keyboard',advice:'Move the microphone away from the keyboard or mute while typing.'},
  {index:407,label:'Air conditioning',advice:'Try a quieter location or move closer to the microphone.'},
  {index:132,label:'Music',advice:'Pause nearby music and record again.'},
];

export function selectSoundHint(scores: ArrayLike<number>): SoundHint | null {
  const ranked = classes.map((item) => ({...item,score:Number(scores[item.index] ?? 0)})).sort((a,b) => b.score - a.score);
  const best = ranked[0];
  // Scores are model outputs, not calibrated probabilities. Require stronger
  // support than silence/speech and keep an unknown result for ambiguity.
  if (!Number.isFinite(best.score) || best.score < 0.35 || best.score < Number(scores[494] ?? 0) || best.score < Number(scores[0] ?? 0)) return null;
  return {label:best.label,score:best.score,advice:best.advice};
}

export async function classifyBackground(samples16k: Float32Array, assetBase: string): Promise<SoundHint | null> {
  const tf = await import('@tensorflow/tfjs');
  await tf.setBackend('cpu');
  await tf.ready();
  const model = await tf.loadGraphModel(`${assetBase}/yamnet/model.json`);
  const input = tf.tensor1d(samples16k);
  let outputs: import('@tensorflow/tfjs').Tensor[] = [];
  try {
    const result = await model.executeAsync(input);
    outputs = Array.isArray(result) ? result : Object.values(result instanceof tf.Tensor ? {result} : result);
    const scores = outputs.find((tensor) => tensor.shape.at(-1) === 521);
    if (!scores) throw new Error('Unexpected YAMNet output');
    const mean = scores.mean(0);
    try {return selectSoundHint(await mean.data());} finally {mean.dispose();}
  } finally {input.dispose(); outputs.forEach((output) => output.dispose()); model.dispose();}
}
