"""Independent, provisional labels. Never imports Miccheck or its detector outputs."""
import argparse
import hashlib
import importlib.metadata
import json
import re
from pathlib import Path

import numpy as np
import soundfile as sf
import webrtcvad
from faster_whisper import WhisperModel
from huggingface_hub import snapshot_download

ROOT = Path(__file__).resolve().parents[3]
FIXTURES = ROOT / 'apps/web/e2e/fixtures/human-speech'


def runs(labels, frame_seconds, duration):
    result = []
    for i, label in enumerate(labels):
        end = round(min((i + 1) * frame_seconds, duration), 6)
        if result and result[-1]['label'] == label:
            result[-1]['end'] = end
        else:
            result.append({'start': round(i * frame_seconds, 6), 'end': end, 'label': label})
    return result


def tokens(text):
    return re.findall(r"[A-Z]+(?:'[A-Z]+)?", text.upper())


def edit_distance(a, b):
    previous = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        row = [i]
        for j, y in enumerate(b, 1):
            row.append(min(row[-1] + 1, previous[j] + 1, previous[j - 1] + (x != y)))
        previous = row
    return previous[-1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', default='Systran/faster-whisper-small.en')
    parser.add_argument('--revision', default='main', help='Use recorded commit to reproduce model weights')
    args = parser.parse_args()
    model_dir = Path(snapshot_download(args.model, revision=args.revision,
        cache_dir=ROOT / '.annotation-models', allow_patterns=['model.bin', 'config.json', 'tokenizer.json', 'vocabulary.*']))
    model = WhisperModel(str(model_dir), device='cpu', compute_type='int8', cpu_threads=4)
    manifest = json.loads((FIXTURES / 'manifest.json').read_text())
    output = {
        'schemaVersion': 1, 'status': 'provisional_model_assisted_not_human_ground_truth',
        'independence': 'Frozen from original source PCM before comparison with production worker; no Silero filtering or app segments used.',
        'models': {'whisper': {'repo': args.model, 'revision': model_dir.name,
            'files': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(model_dir.iterdir()) if p.is_file()}},
            'packages': {p: importlib.metadata.version(p) for p in ['faster-whisper', 'ctranslate2', 'webrtcvad-wheels', 'soundfile', 'numpy']}},
        'protocol': {'frameMs': 10, 'wordBoundaryCollarMs': 60, 'nonspeechExclusionCollarMs': 100,
            'wordProbabilityMinimum': .5, 'transcriptWerMaximum': .25, 'webrtcModes': [1, 3],
            'whisper': {'language': 'en', 'beam_size': 5, 'word_timestamps': True, 'vad_filter': False, 'condition_on_previous_text': False},
            'speech': 'Frame entirely inside a >=0.5 probability word after 60 ms erosion AND both WebRTC modes positive.',
            'nonspeech': 'Both WebRTC modes negative AND no word within 100 ms; not proof of absence of breaths/noise.',
            'uncertain': 'All other frames; entire clip uncertain if transcript WER >0.25.',
            'sourceNoise': 'Unknown/unreviewed; no inferred fan, typing, music, or clean-room labels.'},
        'clips': []}
    for clip in manifest['clips']:
        file = FIXTURES / clip['file']
        assert hashlib.sha256(file.read_bytes()).hexdigest() == clip['sha256']
        pcm, rate = sf.read(file, dtype='int16')
        assert rate == 16000 and pcm.ndim == 1
        audio = pcm.astype(np.float32) / 32768
        segments, _ = model.transcribe(audio, language='en', beam_size=5,
            word_timestamps=True, vad_filter=False, condition_on_previous_text=False)
        words = [{'start': w.start, 'end': w.end, 'text': w.word.strip(), 'probability': round(w.probability, 6)}
            for segment in segments for w in segment.words or []]
        text = ' '.join(w['text'] for w in words)
        reference = tokens(clip['transcript'])
        wer = edit_distance(reference, tokens(text)) / len(reference)
        duration = len(pcm) / rate
        votes = []
        detectors = [webrtcvad.Vad(mode) for mode in [1, 3]]
        for offset in range(0, len(pcm), 160):
            frame = pcm[offset:offset + 160]
            votes.append([v.is_speech(frame.tobytes(), rate) for v in detectors] if len(frame) == 160 else [False, False])
        labels = []
        for i, vote in enumerate(votes):
            start, end = i * .01, min((i + 1) * .01, duration)
            core = any(w['probability'] >= .5 and start >= w['start'] + .06 and end <= w['end'] - .06 for w in words)
            near_word = any(start < w['end'] + .1 and end > w['start'] - .1 for w in words)
            labels.append('uncertain' if wer > .25 else 'speech' if core and all(vote)
                else 'nonspeech' if not near_word and not any(vote) and end - start >= .0099 else 'uncertain')
        intervals = runs(labels, .01, duration)
        totals = {label: round(sum(x['end'] - x['start'] for x in intervals if x['label'] == label), 4)
            for label in ['speech', 'nonspeech', 'uncertain']}
        output['clips'].append({'file': clip['file'], 'sha256': clip['sha256'], 'speaker': clip['speaker'],
            'durationSeconds': duration, 'sourceNoise': 'unknown', 'referenceTranscript': clip['transcript'],
            'recognizedTranscript': text, 'transcriptWer': round(wer, 6), 'words': words,
            'webrtcIntervals': [runs(['speech' if v[mode] else 'nonspeech' for v in votes], .01, duration) for mode in range(2)],
            'intervals': intervals, 'secondsByLabel': totals,
            'injectedNoiseAnnotations': {
                'coordinateSystem': 'recording seconds, including two-second calibration',
                'groundTruthScope': 'Exact added-component generation intervals/nominal RMS only; original source noise remains unknown.',
                'low-floor-stationary': {'durationSeconds': duration + 4,
                    'regions': [{'start': 0, 'end': duration + 4, 'addedNoiseRmsDbfs': -70}], 'expectedAssessment': 'stable'},
                'low-floor-rise': {'durationSeconds': duration + 4,
                    'regions': [{'start': 0, 'end': duration + 2.5, 'addedNoiseRmsDbfs': -70},
                        {'start': duration + 2.5, 'end': duration + 4, 'addedNoiseRmsDbfs': -58}], 'expectedAssessment': 'unstable'},
                'brief-noise': {'durationSeconds': duration + 3,
                    'regions': [{'start': 0, 'end': duration + 2.5, 'addedNoiseUniformAmplitude': .0008},
                        {'start': duration + 2.5, 'end': duration + 2.6, 'addedNoiseUniformAmplitude': .065},
                        {'start': duration + 2.6, 'end': duration + 3, 'addedNoiseUniformAmplitude': .0008}], 'expectedAssessment': 'unstable'},
                'generator': {'seed': 12345, 'distribution': 'uniform', 'lcgMultiplier': 1664525,
                    'lcgIncrement': 1013904223, 'modulus': 4294967296, 'sampleRate': 16000}},
            'reviewFlags': ['human_listening_pending', 'word_timing_is_model_estimate'] + (['transcript_mismatch'] if wer > .25 else [])})
        print(clip['file'], 'WER', round(wer, 3), totals, flush=True)
    target = FIXTURES / 'annotations.ai.json'
    target.write_text(json.dumps(output, indent=2) + '\n', encoding='utf-8', newline='\n')
    print('Saved', target)


if __name__ == '__main__':
    main()
