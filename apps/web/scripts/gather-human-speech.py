"""Gather a small, reproducible human-speech collection using only Python's stdlib."""
import hashlib
import json
import tarfile
import urllib.request
from datetime import date
from pathlib import Path

SOURCE = 'https://www.openslr.org/resources/12/test-clean.tar.gz'
DEST = Path(__file__).resolve().parents[1] / 'e2e' / 'fixtures' / 'human-speech'
DEST.mkdir(parents=True, exist_ok=True)
clips = []
speakers = {}
transcripts = {}
speaker_metadata = ''

with urllib.request.urlopen(SOURCE, timeout=120) as response:
    with tarfile.open(fileobj=response, mode='r|gz') as archive:
        for member in archive:
            if not member.isfile():
                continue
            name = Path(member.name).name
            if name.endswith('.trans.txt'):
                for line in archive.extractfile(member).read().decode('utf-8').splitlines():
                    clip_id, text = line.split(' ', 1)
                    transcripts[clip_id] = text
            elif name == 'SPEAKERS.TXT':
                speaker_metadata = archive.extractfile(member).read().decode('utf-8')
            elif name.endswith('.flac'):
                speaker = name.split('-')[0]
                # Keep the existing speaker separate from this new collection.
                if speaker == '6930' or speakers.get(speaker, 0) >= 2:
                    continue
                if speaker not in speakers and len(speakers) >= 6:
                    continue
                data = archive.extractfile(member).read()
                if data[:4] != b'fLaC' or data[4] & 127 != 0:
                    raise ValueError('Expected FLAC STREAMINFO')
                packed = int.from_bytes(data[18:26], 'big')
                rate = packed >> 44
                frames = packed & ((1 << 36) - 1)
                seconds = frames / rate
                if not 3 <= seconds <= 12:
                    continue
                (DEST / name).write_bytes(data)
                speakers[speaker] = speakers.get(speaker, 0) + 1
                clips.append(dict(file=name, speaker=speaker, archive_path=member.name,
                                  sample_rate=rate, duration_seconds=round(seconds, 4),
                                  sha256=hashlib.sha256(data).hexdigest()))
                print(f'Collected {name}: {seconds:.2f}s', flush=True)

for clip in clips:
    clip['transcript'] = transcripts[Path(clip['file']).stem]
if len(clips) != 12 or len(speakers) != 6:
    raise ValueError('Expected two recordings from each of six speakers')
manifest = dict(source=SOURCE, retrieved=str(date.today()), license='CC BY 4.0',
                license_url='https://creativecommons.org/licenses/by/4.0/',
                attribution='LibriSpeech: Vassil Panayotov, Guoguo Chen, Daniel Povey, Sanjeev Khudanpur; source audiobooks from LibriVox',
                selection='First six archive speakers other than 6930, first two clips per speaker lasting 3–12 seconds',
                speech_boundaries='Not manually annotated', clips=clips)
(DEST / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
(DEST / 'SPEAKERS.TXT').write_text(speaker_metadata, encoding='utf-8')
print(f'Saved {len(clips)} clips from {len(speakers)} speakers to {DEST}', flush=True)
