"""Offline checks for the frozen continuation comparison sources and labels."""
import hashlib
import json
import wave
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'e2e/fixtures'
folder = root / 'starss22-vad'
selection_bytes = (folder / 'selection.json').read_bytes()
selection = json.loads(selection_bytes)
manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
candidate = json.loads((folder / 'candidate.json').read_text(encoding='utf-8'))
if manifest['protocol'] != selection or hashlib.sha256(selection_bytes).hexdigest() != candidate['selectionSha256']:
    raise ValueError('Frozen selection/protocol mismatch')
old_rooms = {c['room'] for c in json.loads((root / 'starss22/manifest.json').read_text())['clips']}
rooms = {c['room'] for c in manifest['clips']}
if old_rooms & rooms or rooms != {'room22', 'room23', 'room8'} or len(manifest['clips']) != 6:
    raise ValueError('Expected six crops in three previously unused rooms')
for clip, chosen in zip(manifest['clips'], selection['selection']):
    if any(clip[k] != v for k, v in chosen.items()):
        raise ValueError('Manifest differs from annotation-only selection')
    audio = folder / clip['file']
    metadata = folder / Path(clip['metadata_path']).name
    if hashlib.sha256(audio.read_bytes()).hexdigest() != clip['sha256'] or hashlib.sha256(metadata.read_bytes()).hexdigest() != clip['metadataSha256']:
        raise ValueError('Fixture checksum mismatch')
    with wave.open(str(audio)) as w:
        if (w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()) != (1, 2, 24000, 22 * 24000):
            raise ValueError('Expected unchanged mono 24 kHz 22 s crop')
    if clip['sourceSamples'] != [clip['startFrame'] * 2400, (clip['startFrame'] + 220) * 2400]:
        raise ValueError('Source sample bounds mismatch')
    frames = {}
    for line in metadata.read_text().splitlines():
        frame, cls, *_ = map(int, line.split(','))
        frames.setdefault(frame - clip['startFrame'], set()).add(cls)
    speech = lambda f: bool(frames.get(f, set()) & {0, 1})
    if any(speech(f) for f in range(20)):
        raise ValueError('Annotated speech during calibration')
    interiors = sum(all(speech(f + d) for d in range(-2, 3)) for f in range(220))
    noise = sum(all(frames.get(f + d, set()) & {5, 9, 10} and not frames.get(f + d, set()) & {0, 1, 4, 8}
                    for d in range(-5, 6)) for f in range(220))
    if (interiors, noise) != (clip['interiorSpeechFrames'], clip['candidateNoiseFrames']):
        raise ValueError('Independent conservative label counts changed')
for name in ['UPSTREAM_LICENSE', 'UPSTREAM_README.md']:
    if (folder / name).read_bytes() != (root / 'starss22' / name).read_bytes():
        raise ValueError('Upstream attribution changed')
print('Validated six contiguous crops, 132 s, three unused rooms, frozen labels and attribution. Offline; no model calls.')
