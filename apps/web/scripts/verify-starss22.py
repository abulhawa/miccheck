"""Offline provenance/annotation checks for the frozen STARSS22 pilot."""
import hashlib
import json
import wave
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'e2e/fixtures/starss22'
manifest = json.loads((root / 'manifest.json').read_text())
rooms = {'development': set(), 'evaluation': set()}
seconds = 0
for clip in manifest['clips']:
    audio = root / clip['file']
    metadata = root / Path(clip['metadata_path']).name
    for file, expected in [(audio, clip['sha256']), (metadata, clip['metadata_sha256'])]:
        if hashlib.sha256(file.read_bytes()).hexdigest() != expected:
            raise ValueError('Checksum mismatch: ' + file.name)
    with wave.open(str(audio)) as w:
        if (w.getnchannels(), w.getsampwidth(), w.getframerate()) != (1, 2, 24000):
            raise ValueError('Unexpected pilot WAV format')
        if w.getnframes() != clip['source_samples'][1] - clip['source_samples'][0]:
            raise ValueError('Crop sample count mismatch')
        if abs(w.getnframes() / 24000 - clip['duration_seconds']) > 1e-9:
            raise ValueError('Duration mismatch')
    frames = {}
    for line in metadata.read_text().splitlines():
        frame, cls, *_ = map(int, line.split(','))
        frames.setdefault(frame, set()).add(cls)
    start = clip['crop_frames'][0]
    end = min(clip['crop_frames'][1], clip['source_samples'][1] // 2400)
    if any(frames.get(f) for f in range(start, start + 20)):
        raise ValueError('Calibration contains an annotated target event')
    if sum(bool(frames.get(f, set()) & {0, 1}) for f in range(start + 20, end)) < 20:
        raise ValueError('Insufficient annotated speech')
    a, b = clip['event_frames']
    if a < start + 20 or b > end or b - a < 10:
        raise ValueError('Event outside crop or too short')
    if any(clip['event_class'] not in frames.get(f, set()) or frames[f] & {0, 1, 4} for f in range(a, b)):
        raise ValueError('Event annotations do not match selection')
    rooms[clip['split']].add(clip['room'])
    seconds += clip['duration_seconds']
if len(manifest['clips']) != 4 or any(len(r) != 2 for r in rooms.values()) or rooms['development'] & rooms['evaluation']:
    raise ValueError('Expected four distinct development/evaluation rooms')
print(f'Validated four annotated clips, {seconds:.1f} seconds, with disjoint rooms. No model calls.')
