"""Freeze annotation-selected VAD evaluation crops in three unused rooms.

Fetch selected ZIP members only. Benchmarks remain offline; reruns use cached
sources. Upstream 100 ms target labels are incomplete, not exhaustive truth.
"""
import array
import collections
import hashlib
import io
import json
import re
import urllib.request
import wave
import zipfile
from pathlib import Path

BASE = 'https://zenodo.org/records/6387880/files/'
WEB = Path(__file__).resolve().parents[1]
CACHE = WEB / '.test-assets/starss22'
DEST = WEB / 'e2e/fixtures/starss22-vad'


class RemoteZip(io.RawIOBase):
    def __init__(self, url):
        self.url, self.position = url, 0
        with urllib.request.urlopen(urllib.request.Request(url, headers={'Range': 'bytes=-65536'}), timeout=45) as r:
            if r.status != 206:
                raise ValueError('Ranges required; refusing full archive download')
            self.size = int(r.headers['Content-Range'].split('/')[-1])
            self.tail = r.read()
        self.tail_start = self.size - len(self.tail)

    def seek(self, offset, whence=0):
        self.position = offset if whence == 0 else self.position + offset if whence == 1 else self.size + offset
        return self.position

    def tell(self):
        return self.position

    def read(self, size=-1):
        size = self.size - self.position if size < 0 else min(size, self.size - self.position)
        if not size:
            return b''
        if self.position >= self.tail_start:
            data = self.tail[self.position - self.tail_start:self.position - self.tail_start + size]
        else:
            if size > 100_000_000:
                raise ValueError('Unexpected oversized member request')
            span = f'bytes={self.position}-{self.position + size - 1}'
            with urllib.request.urlopen(urllib.request.Request(self.url, headers={'Range': span}), timeout=45) as r:
                if r.status != 206 or not r.headers['Content-Range'].startswith(f'bytes {self.position}-'):
                    raise ValueError('Invalid range response')
                data = r.read()
            if len(data) != size:
                raise ValueError('Incomplete range response')
        self.position += len(data)
        return data


def main(rooms=('room22', 'room23', 'room8'), destination=DEST, speech_only_rooms=()):
    destination.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    metadata_path = CACHE / 'metadata_dev.zip'
    if metadata_path.exists():
        metadata = metadata_path.read_bytes()
    else:
        with urllib.request.urlopen(BASE + 'metadata_dev.zip?download=1', timeout=45) as response:
            metadata = response.read()
    if hashlib.md5(metadata).hexdigest() != 'b460e17e0848c49f03f238afb89fa87e':
        raise ValueError('Upstream metadata checksum mismatch')
    if not metadata_path.exists():
        metadata_path.write_bytes(metadata)
    labels = zipfile.ZipFile(io.BytesIO(metadata))
    selection = []
    if len(set(rooms)) != len(rooms) or any(not re.fullmatch(r'room\d+', room) for room in rooms):
        raise ValueError('Expected unique room identifiers')
    if not set(speech_only_rooms).issubset(rooms):
        raise ValueError('Speech-only rooms must be among selected rooms')
    for room in rooms:
        pool = []
        for name in sorted(labels.namelist()):
            if not name.endswith('.csv') or re.search(r'room\d+', name).group() != room:
                continue
            frames = collections.defaultdict(set)
            for line in labels.read(name).decode().splitlines():
                frame, cls, *_ = map(int, line.split(','))
                frames[frame].add(cls)
            last = max(frames)
            speech = lambda f: bool(frames[f] & {0, 1})
            interiors = {f for f in range(last + 1) if all(speech(f + d) for d in range(-2, 3))}
            # Playback music remains uncertain; instruments without annotated
            # music/vocals supply candidate controls, not proof of no interference.
            noise = {f for f in range(last + 1) if all(frames[f + d] & {5, 9, 10} and
                     not frames[f + d] & {0, 1, 4, 8} for d in range(-5, 6))}
            for start in range(last - 219):
                if any(speech(f) for f in range(start, start + 20)):
                    continue
                sp = sum(f in interiors for f in range(start + 20, start + 220))
                ns = sum(f in noise for f in range(start, start + 220))
                pool.append(dict(metadata_path=name, startFrame=start,
                                 interiorSpeechFrames=sp, candidateNoiseFrames=ns))
        if not pool:
            raise ValueError('No usable upstream labels for ' + room)
        for role, score in [('speech', 'interiorSpeechFrames'), ('noise', 'candidateNoiseFrames')]:
            if role == 'noise' and room in speech_only_rooms:
                continue
            other = 'candidateNoiseFrames' if role == 'speech' else 'interiorSpeechFrames'
            chosen = sorted(pool, key=lambda c: (-c[score], -c[other], c['metadata_path'], c['startFrame']))[0]
            if chosen[score] < (30 if role == 'speech' else 50):
                raise ValueError('Insufficient labels for ' + room + '/' + role)
            selection.append(dict(**chosen, room=room, role=role, split='evaluation'))
    protocol = dict(version=1, rooms=list(rooms),
        source='https://zenodo.org/records/6387880', channel=0, seconds=22,
        metadataSha256=hashlib.sha256(metadata).hexdigest(),
        rule='Per unused room, maximize speech interiors or domestic/water/instrument candidate noise in a contiguous 22 s crop with no annotated speech in initial 2 s; tie by other label count, metadata path, then crop onset. Freeze before VAD outputs.',
        selection=selection)
    if speech_only_rooms:
        protocol['speechOnlyRooms'] = list(speech_only_rooms)
    frozen = destination / 'selection.json'
    if frozen.exists() and json.loads(frozen.read_text(encoding='utf-8')) != protocol:
        raise ValueError('Frozen annotation selection changed')
    frozen.write_text(json.dumps(protocol, indent=2) + '\n', encoding='utf-8')
    archive = None
    clips = []
    previous = json.loads((destination / 'manifest.json').read_text(encoding='utf-8')) if (destination / 'manifest.json').exists() else {'clips': []}
    for choice in selection:
        name = choice['metadata_path']
        audio_path = name.replace('metadata_dev/', 'mic_dev/').replace('.csv', '.wav')
        source = CACHE / Path(audio_path).name
        if not source.exists():
            if archive is None:
                archive = zipfile.ZipFile(RemoteZip(BASE + 'mic_dev.zip?download=1'))
            source.write_bytes(archive.read(audio_path))  # zipfile checks member CRC.
        raw = source.read_bytes()
        source_hash = hashlib.sha256(raw).hexdigest()
        old = next((c for c in previous['clips'] if c['archive_path'] == audio_path), None)
        if old and old['sourceSha256'] != source_hash:
            raise ValueError('Cached source hash changed')
        with wave.open(io.BytesIO(raw)) as w:
            if (w.getframerate(), w.getnchannels(), w.getsampwidth()) != (24000, 4, 2):
                raise ValueError('Unexpected source format')
            start = choice['startFrame'] * 2400
            end = start + 22 * 24000
            if end > w.getnframes():
                raise ValueError('Metadata-selected crop exceeds source')
            w.setpos(start)
            samples = array.array('h', w.readframes(end - start))
        filename = f"{source.stem}-{choice['role']}.wav"
        target = destination / filename
        with wave.open(str(target), 'wb') as w:
            w.setparams((1, 2, 24000, 0, 'NONE', 'not compressed'))
            w.writeframes(samples[::4].tobytes())
        annotation = labels.read(name)
        (destination / Path(name).name).write_bytes(annotation)
        clips.append(dict(**choice, file=filename, archive_path=audio_path,
            sourceSha256=source_hash, sourceSamples=[start, end], sampleRate=24000,
            sha256=hashlib.sha256(target.read_bytes()).hexdigest(),
            metadataSha256=hashlib.sha256(annotation).hexdigest()))
        # Save each completed crop so interrupted gathering resumes safely.
        (destination / 'manifest.json').write_text(json.dumps(dict(protocol=protocol, clips=clips), indent=2) + '\n', encoding='utf-8')
        print(f"Collected {filename}, source {start / 24000:.1f}-{end / 24000:.1f} s", flush=True)
    for name in ['UPSTREAM_LICENSE', 'UPSTREAM_README.md']:
        (destination / name).write_bytes((WEB / 'e2e/fixtures/starss22' / name).read_bytes())
    print(f'Frozen {len(clips)} evaluation crops, {len(clips)*22} s, {len(rooms)} rooms. No model calls.')


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--rooms', nargs='+', default=['room22', 'room23', 'room8'])
    parser.add_argument('--output-directory', choices=['starss22-vad', 'clipping-selection-evaluation'], default='starss22-vad')
    parser.add_argument('--speech-only-rooms', nargs='*', default=[])
    args = parser.parse_args()
    main(args.rooms, WEB / 'e2e/fixtures' / args.output_directory, args.speech_only_rooms)
