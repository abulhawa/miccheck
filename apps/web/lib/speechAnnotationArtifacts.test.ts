import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expect, it} from 'vitest';

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url));
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const sourceBytes = read('../e2e/fixtures/human-speech/annotations.ai.json');
const groqBytes = read('../e2e/fixtures/human-speech/groq-large-v3-responses.json');
const consensusBytes = read('../e2e/fixtures/human-speech/annotations.consensus.ai.json');
const workerBytes = read('../../../docs/ai-annotation-evaluation.json');
const source = JSON.parse(sourceBytes.toString());
const consensus = JSON.parse(consensusBytes.toString());

it('preserves snapshot provenance across repository checkouts without API calls', () => {
  expect(consensus.parentHashes.smallAnnotationsSha256).toBe(hash(sourceBytes));
  expect(consensus.parentHashes.groqResponsesSha256).toBe(hash(groqBytes));
  expect(JSON.parse(workerBytes.toString()).annotationsSha256).toBe(hash(sourceBytes));
  const evaluated = JSON.parse(read('../../../docs/groq-annotation-evaluation.json').toString());
  expect(evaluated.sourceWorkerReportSha256).toBe(hash(workerBytes));
  expect(evaluated.consensusAnnotationsSha256).toBe(hash(consensusBytes));
});

it('ties annotations to the original source recordings', () => {
  expect(source.clips).toHaveLength(12);
  expect(consensus.clips).toHaveLength(12);
  for (const clip of source.clips) {
    expect(clip.sha256).toBe(hash(read(`../e2e/fixtures/human-speech/${clip.file}`)));
    expect(consensus.clips.find((c: {file: string}) => c.file === clip.file).sha256).toBe(clip.sha256);
  }
});
