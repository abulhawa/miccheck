"""Freeze independent component labels before running Miccheck (stdlib only)."""
import array
import hashlib
import json
import math
import sys
import wave
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'e2e/fixtures/starss22'
manifest = json.loads((root / 'manifest.json').read_text())
output = root / 'reference.json'

def level(samples):
    return 10 * math.log10(max(sum(x*x for x in samples) / len(samples) / 32768**2, 1e-16))

clips = []
for clip in manifest['clips']:
    raw = (root / clip['file']).read_bytes()
    if hashlib.sha256(raw).hexdigest() != clip['sha256']:
        raise ValueError('Audio provenance mismatch')
    with wave.open(str(root / clip['file'])) as w:
        samples = array.array('h', w.readframes(w.getnframes()))
        rate = w.getframerate()
    if sys.byteorder != 'little':
        samples.byteswap()
    metadata = (root / Path(clip['metadata_path']).name).read_bytes()
    if hashlib.sha256(metadata).hexdigest() != clip['metadata_sha256']:
        raise ValueError('Annotation provenance mismatch')
    frames = {}
    for line in metadata.decode().splitlines():
        f, cls, *_ = map(int, line.split(','))
        frames.setdefault(f - clip['crop_frames'][0], set()).add(cls)
    # Pick a five-second continuous source excerpt containing the most
    # upstream speech frames. Ties resolve by onset, independent of VAD.
    total = len(samples) // (rate // 10)
    start = max(range(20, total - 49), key=lambda s: sum(bool(frames.get(f, set()) & {0, 1}) for f in range(s, s + 50)))
    annotated_speech = sum(bool(frames.get(f, set()) & {0, 1}) for f in range(start, start + 50)) / 10
    if annotated_speech < 2:
        raise ValueError('Speech excerpt lacks independent evidence')
    a, b = clip['event_frames']
    a, b = a - clip['crop_frames'][0], b - clip['crop_frames'][0]
    # Wide one-second blocks, excluding one second at either event edge.
    # These measure mixture level, not isolated source-noise ground truth.
    blocks = [{'interval': [f / 10, f / 10 + 1], 'rmsDbfs': level(samples[f*rate//10:(f+10)*rate//10])}
              for f in range(a + 10, b - 19, 10)]
    clips.append({'file': clip['file'], 'split': clip['split'], 'room': clip['room'], 'sha256': clip['sha256'],
                  'metadataSha256': clip['metadata_sha256'], 'noiseSourceSamples': [0, 2*rate],
                  'speechSourceSamples': [start*rate//10, (start+50)*rate//10], 'annotatedSpeechSeconds': annotated_speech,
                  'nativeCalibrationDbfs': level(samples[:2*rate]), 'nativeEventBlocks': blocks,
                  'nativeExpectedNoiseRetry': None,
                  'nativeExpectationReason': 'Event presence and 1 s mixture levels do not label all quiet intervals or exclude unannotated interference; no full-recording stable/unstable ground truth.',
                  'cases': [{'name': name, 'tailGainDb': gain, 'expectedStability': 'stable' if gain == 0 else 'unstable',
                             'expectedRetry': None if gain == 0 else 'noise_unstable'}
                            for name, gain in [('stationary', 0), ('increase', 12), ('decrease', -12)]]})
reference = {'protocol': 'starss22-pilot-v1', 'manifestSha256': hashlib.sha256((root / 'manifest.json').read_bytes()).hexdigest(),
             'definition': 'Constructed component comparison, not contiguous real capture: recorded first 2 s noise repeated through 2 s calibration, 5 s source excerpt, and 4.5 s tail. Tail gain changes only from 0.75 to 3.25 s after excerpt. Entire source excerpt, including residual noise, is the signal component. No normalization, limiting, or source SNR claim.',
             'noiseEventLocalSeconds': [7.75, 10.25], 'speechLocalSeconds': [2, 7], 'clips': clips}
serialized = json.dumps(reference, indent=2) + '\n'
if output.exists() and output.read_text() != serialized:
    raise ValueError('Frozen reference differs; preserve old labels and review a separately versioned protocol')
output.write_text(serialized)
print('Frozen four-room reference: 12 constructed labels; native retry truth explicitly unknown. No Miccheck/model calls.')
