"""Downgrade unsupported source candidates; never promote labels from Whisper agreement."""
import hashlib
import json
import math
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('source_annotation', Path(__file__).with_name('annotate-human-speech.py'))
source_annotation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source_annotation)
edit_distance, runs, tokens = source_annotation.edit_distance, source_annotation.runs, source_annotation.tokens

ROOT = Path(__file__).resolve().parents[3]
FOLDER = ROOT / 'apps/web/e2e/fixtures/human-speech'


def align_words(small, large):
    # Exact lexical LCS: substitutions and ambiguous spellings are not matches.
    small_units = [(token, index) for index, word in enumerate(small) for token in tokens(word['text'])]
    large_units = [(token, index) for index, word in enumerate(large) for token in tokens(word['text'])]
    a = [token for token, _ in small_units]
    b = [token for token, _ in large_units]
    table = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) - 1, -1, -1):
        for j in range(len(b) - 1, -1, -1):
            table[i][j] = 1 + table[i + 1][j + 1] if a[i] == b[j] and a[i] else max(table[i + 1][j], table[i][j + 1])
    i = j = 0
    pairs = []
    while i < len(a) and j < len(b):
        if a[i] == b[j] and a[i]:
            pair = (small_units[i][1], large_units[j][1])
            if pair not in pairs: pairs.append(pair)
            i += 1; j += 1
        elif table[i + 1][j] >= table[i][j + 1]:
            i += 1
        else:
            j += 1
    return pairs


def refine(clip, response):
    duration = clip['durationSeconds']
    words = [{'text': w['word'], 'start': w['start'], 'end': w['end']} for w in response['words']]
    invalid = any(not math.isfinite(w['start']) or not math.isfinite(w['end'])
        or w['end'] < w['start'] for w in words)
    bounded = [w['start'] >= -1e-6 and w['end'] <= duration + 1e-6 and w['end'] > w['start'] for w in words]
    out_of_bounds = any(w['start'] < -1e-6 or w['end'] > duration + 1e-6 for w in words)
    pairs = align_words(clip['words'], words)
    reference = tokens(clip['referenceTranscript'])
    wer = edit_distance(reference, tokens(response['text'])) / len(reference)
    labels = []
    downgraded = {'speech': 0, 'nonspeech': 0}
    pointer = 0
    for frame in range(math.ceil(duration / .01)):
        start, end = frame * .01, min((frame + 1) * .01, duration)
        while pointer + 1 < len(clip['intervals']) and start >= clip['intervals'][pointer]['end'] - 1e-8:
            pointer += 1
        old = clip['intervals'][pointer]['label']
        label = old
        if invalid or wer > .25:
            label = 'uncertain'
        elif old == 'speech':
            supported = any(bounded[j] and clip['words'][i]['probability'] >= .5
                and start >= clip['words'][i]['start'] + .06 - 1e-8
                and end <= clip['words'][i]['end'] - .06 + 1e-8
                and start >= words[j]['start'] + .06 - 1e-8
                and end <= words[j]['end'] - .06 + 1e-8 for i, j in pairs)
            if not supported: label = 'uncertain'
        elif old == 'nonspeech':
            if any(start < w['end'] + .1 and end > w['start'] - .1 for w in words): label = 'uncertain'
        if old != label and old in downgraded: downgraded[old] += end - start
        labels.append(label)
    intervals = runs(labels, .01, duration)
    return {**clip, 'words': words, 'recognizedTranscript': response['text'], 'transcriptWer': round(wer, 6),
        'intervals': intervals, 'secondsByLabel': {label: round(sum(i['end'] - i['start'] for i in intervals if i['label'] == label), 4)
            for label in ['speech', 'nonspeech', 'uncertain']},
        'refinement': {'matchedWordCount': len(pairs), 'downgradedSeconds': {k: round(v, 6) for k, v in downgraded.items()},
            'matchedWords': [{'smallIndex': i, 'largeIndex': j, 'text': words[j]['text'],
                'startDifferenceSeconds': round(words[j]['start'] - clip['words'][i]['start'], 6),
                'endDifferenceSeconds': round(words[j]['end'] - clip['words'][i]['end'], 6)} for i, j in pairs]},
        'reviewFlags': clip['reviewFlags'] + ['related_whisper_models_not_independent_ground_truth', 'groq_word_probability_not_supplied']
            + (['groq_transcript_mismatch'] if wer > .25 else []) + (['groq_timestamps_invalid'] if invalid else [])
            + (['provider_timestamp_out_of_bounds'] if out_of_bounds else [])}


def main():
    source_bytes = (FOLDER / 'annotations.ai.json').read_bytes()
    groq_bytes = (FOLDER / 'groq-large-v3-responses.json').read_bytes()
    source, groq = json.loads(source_bytes), json.loads(groq_bytes)
    if len(groq['clips']) != len(source['clips']): raise ValueError('Complete source transcriptions before refinement')
    output = {**source, 'independence': 'Original candidates and Groq source-word agreement frozen before comparison with saved Miccheck worker outputs.',
        'models': {**source['models'], 'groq': {'model': groq['parameters']['model'], 'providerManagedVersion': True,
            'parameters': groq['parameters'], 'wordProbabilities': 'not supplied'}},
        'parentHashes': {'smallAnnotationsSha256': hashlib.sha256(source_bytes).hexdigest(), 'groqResponsesSha256': hashlib.sha256(groq_bytes).hexdigest()},
        'protocol': {**source['protocol'], 'refinement': 'Downgrade-only. Exact lexical-token LCS (compound words retain shared time extent). Speech needs same bounded nonempty word core in both Whisper timelines (60 ms eroded); nonspeech must be outside both timelines padded100ms. Out-of-source words exclude speech support locally and retain raw bounds as nonspeech exclusions; nonfinite/reversed bounds make the clip uncertain. Original uncertain remains uncertain. Groq has no word probabilities. No threshold tuning.'},
        'clips': []}
    for clip in source['clips']:
        response = next(r for r in groq['clips'] if r['file'] == clip['file'] and r['sha256'] == clip['sha256'])
        refined = refine(clip, response['response'])
        output['clips'].append(refined)
        print(clip['file'], 'Large V3 WER', refined['transcriptWer'], 'labels', refined['secondsByLabel'], 'downgraded', refined['refinement']['downgradedSeconds'])
    (FOLDER / 'annotations.consensus.ai.json').write_text(json.dumps(output, indent=2) + '\n', encoding='utf-8', newline='\n')


if __name__ == '__main__':
    main()
