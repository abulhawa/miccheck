"""Collect a small annotated real-room pilot without downloading the 2 GB archive.

Selection uses upstream metadata only, before Miccheck outputs are inspected.
HTTP ranges fetch just selected ZIP members. No model API calls.
"""
import hashlib
import io
import json
import urllib.request
import wave
import zipfile
from pathlib import Path

BASE = 'https://zenodo.org/records/6387880/files/'
DEST = Path(__file__).resolve().parents[1] / 'e2e/fixtures/starss22'
CACHE = Path(__file__).resolve().parents[1] / '.test-assets/starss22'
DEST.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)
previous = json.loads((DEST / 'manifest.json').read_text()) if (DEST / 'manifest.json').exists() else {'clips': []}


def download(name, md5=None):
    target = CACHE / name
    if not target.exists():
        with urllib.request.urlopen(BASE + name + '?download=1', timeout=45) as response:
            target.write_bytes(response.read())
    data = target.read_bytes()
    if md5 and hashlib.md5(data).hexdigest() != md5:
        raise ValueError('Upstream checksum mismatch: ' + name)
    return data


class RemoteZip(io.RawIOBase):
    def __init__(self, url):
        self.url, self.position = url, 0
        with urllib.request.urlopen(urllib.request.Request(url, headers={'Range': 'bytes=-65536'}), timeout=45) as r:
            if r.status != 206:
                raise ValueError('Server must support ranges; refusing full archive download')
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


metadata = download('metadata_dev.zip', 'b460e17e0848c49f03f238afb89fa87e')
for name in ['LICENSE', 'README.md']:
    (DEST / ('UPSTREAM_' + name)).write_bytes(download(name))
labels = zipfile.ZipFile(io.BytesIO(metadata))
candidates = []
for name in sorted(labels.namelist()):
    if not name.endswith('.csv'):
        continue
    rows = [list(map(int, line.split(','))) for line in labels.read(name).decode().splitlines() if line.strip()]
    frames = {}
    for frame, cls, *_ in rows:
        frames.setdefault(frame, set()).add(cls)
    # Require 2 s with no annotated target event for calibration, followed by
    # >=2 s speech and a >=1 s speech-free noise event in a <=60 s crop.
    # Empty metadata frames remain candidate quiet, not verified silence.
    for start in range(max(frames) - 20):
        if any(frames.get(f) for f in range(start, start + 20)):
            continue
        end = start + 600
        speech = sum(bool(frames.get(f, set()).intersection({0, 1})) for f in range(start + 20, end))
        if speech < 20:
            continue
        for cls in [5, 10, 8]:
            eligible = [f for f in range(start + 20, end) if cls in frames.get(f, set()) and not frames[f].intersection({0, 1, 4})]
            runs = []
            for frame in eligible:
                if not runs or frame != runs[-1][-1] + 1:
                    runs.append([])
                runs[-1].append(frame)
            for run in runs:
                if len(run) >= 10:
                    candidates.append(dict(metadata_path=name, event_class=cls, event_frames=[run[0], run[-1] + 1],
                                           crop_frames=[start, end], score=len(run), speech_frames=speech))

selected = []
for split in ['dev-train-sony', 'dev-train-tau', 'dev-test-sony', 'dev-test-tau']:
    pool = [c for c in candidates if '/' + split + '/' in c['metadata_path']]
    if not pool:
        raise ValueError('No eligible recording for ' + split)
    choice = sorted(pool, key=lambda c: (-c['score'], c['metadata_path'], c['crop_frames'][0], c['event_frames'][0]))[0]
    selected.append({**choice, 'source_split': split, 'split': 'development' if 'train' in split else 'evaluation'})

manifest = dict(source='https://zenodo.org/records/6387880', version='1.0.0',
                audio_archive_url=BASE + 'mic_dev.zip?download=1', upstream_archive_md5='46b55d0be507afa986cd29120e42b188',
                metadata_sha256=hashlib.sha256(metadata).hexdigest(),
                selection='One recording per site/split: longest speech-free domestic/water/music run in <=60 s crop with 2 s initial absence of annotated target events and >=2 s later speech. Tie by path, crop onset, then event onset. No app outputs used.',
                channel=0, annotations='Upstream human-validated event frames at 100 ms resolution; absence of labels is not verified silence.', clips=[])
archive = None
for choice in selected:
    name = choice['metadata_path']
    audio_path = name.replace('metadata_dev/', 'mic_dev/').replace('.csv', '.wav')
    source_file = CACHE / Path(audio_path).name
    if not source_file.exists():
        if archive is None:
            archive = zipfile.ZipFile(RemoteZip(BASE + 'mic_dev.zip?download=1'))
        source_file.write_bytes(archive.read(audio_path))  # ZIP CRC checked by zipfile.
    raw = source_file.read_bytes()
    old = next((c for c in previous['clips'] if c['archive_path'] == audio_path), None)
    if old and hashlib.sha256(raw).hexdigest() != old['source_sha256']:
        raise ValueError('Cached source changed: ' + audio_path)
    with wave.open(io.BytesIO(raw)) as w:
        rate, channels, width = w.getframerate(), w.getnchannels(), w.getsampwidth()
        if (rate, channels, width) != (24000, 4, 2):
            raise ValueError(f'Unexpected source PCM format: {rate}, {channels}, {width}')
        start = choice['crop_frames'][0] * (rate // 10)
        end = min(w.getnframes(), choice['crop_frames'][1] * (rate // 10))
        w.setpos(start)
        pcm = w.readframes(end - start)
    mono = bytearray((end - start) * 2)
    for i in range(end - start):
        mono[2*i:2*i+2] = pcm[8*i:8*i+2]
    target = DEST / source_file.name
    with wave.open(str(target), 'wb') as w:
        w.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        w.writeframes(mono)
    (DEST / Path(name).name).write_bytes(labels.read(name))
    manifest['clips'].append({**choice, 'file': target.name, 'room': target.stem.split('_')[1],
                              'archive_path': audio_path, 'source_sha256': hashlib.sha256(raw).hexdigest(),
                              'source_samples': [start, end], 'sample_rate': rate, 'duration_seconds': (end-start)/rate,
                              'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                              'metadata_sha256': hashlib.sha256(labels.read(name)).hexdigest()})
    print(f"Collected {target.name}: {(end-start)/rate:.1f}s, {choice['split']}, class {choice['event_class']}", flush=True)
(DEST / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
retained = {c['file'] for c in manifest['clips']}
for old in previous['clips']:
    if old['file'] not in retained:
        for filename in [old['file'], Path(old['metadata_path']).name]:
            target = (DEST / filename).resolve()
            if target.parent != DEST.resolve():
                raise ValueError('Unexpected cleanup path')
            target.unlink(missing_ok=True)
