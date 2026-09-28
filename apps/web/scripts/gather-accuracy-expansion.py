"""Small, reproducible CC-BY recording expansion; never runs app inference.

AMI: range-download paired headset/distant channels at annotation-selected times.
FLEURS: stream only the first two WAV members per language, retaining transcripts.
Cached downloads resume without re-fetching successful sources. No API credentials.
"""
import hashlib
import io
import json
import pathlib
import struct
import tarfile
import urllib.request
import wave
import xml.etree.ElementTree as ET
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = ROOT / "apps/web/e2e/fixtures/accuracy-expansion"
CACHE = ROOT / "apps/web/.test-assets/accuracy-expansion"
OUT.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)
manifest_path = OUT / "manifest.json"
previous = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else None
expected_clips = {c["file"]: c for c in previous["clips"]} if previous else {}


def save_clip(name, data):
    if name in expected_clips and sha(data) != expected_clips[name]["sha256"]:
        raise RuntimeError("Pinned source changed: " + name)
    (OUT / name).write_bytes(data)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def fetch(url, name):
    target = CACHE / name
    if not target.exists():
        with urllib.request.urlopen(url, timeout=60) as response:
            data = response.read()
        target.write_bytes(data)
    return target.read_bytes()


def interval_union(intervals):
    result = []
    for start, end in sorted(intervals):
        if result and start <= result[-1][1]:
            result[-1][1] = max(end, result[-1][1])
        else:
            result.append([start, end])
    return result


def wav(pcm, rate):
    output = io.BytesIO()
    with wave.open(output, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(rate)
        writer.writeframes(pcm)
    return output.getvalue()


def ranged(url, start, end, name):
    target = CACHE / name
    if not target.exists():
        request = urllib.request.Request(url, headers={"Range": f"bytes={start}-{end}"})
        with urllib.request.urlopen(request, timeout=60) as response:
            if response.status != 206 or not response.headers["Content-Range"].startswith(f"bytes {start}-{end}/"):
                raise RuntimeError("Server did not honor exact byte range")
            data = response.read()
        if len(data) != end - start + 1:
            raise RuntimeError("Incomplete range")
        target.write_bytes(data)
    return target.read_bytes()


annotation_url = "https://groups.inf.ed.ac.uk/ami/AMICorpusAnnotations/ami_public_manual_1.6.2.zip"
annotation_bytes = fetch(annotation_url, "ami_public_manual_1.6.2.zip")
if previous and sha(annotation_bytes) != previous["amiAnnotationSha256"]:
    raise RuntimeError("Pinned AMI annotation archive changed")
clips = []
with zipfile.ZipFile(io.BytesIO(annotation_bytes)) as archive:
    for name in ["LICENCE.txt", "00README_MANUAL.txt"]:
        (OUT / ("AMI_" + name)).write_bytes(archive.read(name))
    meetings_bytes = archive.read("corpusResources/meetings.xml")
    meetings = ET.fromstring(meetings_bytes)
    (OUT / "ami-meetings.xml").write_bytes(meetings_bytes)
    for meeting_id, split in [("ES2002a", "development"), ("IS1001a", "evaluation")]:
        meeting = next(m for m in meetings if m.get("observation") == meeting_id)
        annotations = []
        for agent in "ABCD":
            name = f"words/{meeting_id}.{agent}.words.xml"
            data = archive.read(name)
            (OUT / f"{meeting_id}.{agent}.words.xml").write_bytes(data)
            for item in ET.fromstring(data):
                if item.get("punc") == "true" or not item.get("starttime"):
                    continue
                start, end = float(item.get("starttime")), float(item.get("endtime"))
                if end > start:
                    annotations.append((start, end, agent, item.tag))
        for agent in "AB":
            # First half-second grid window with 2 s free of all annotated vocal
            # activity (300 ms guard), then >=10 s target word coverage in 20 s.
            start = None
            for step in range(20, 1200):
                candidate = step / 2
                if any(a < candidate + 2.3 and b > candidate - .3 for a, b, _, _ in annotations):
                    continue
                words = interval_union([(max(a, candidate + 2), min(b, candidate + 22))
                                        for a, b, speaker, kind in annotations
                                        if speaker == agent and kind == "w" and a < candidate + 22 and b > candidate + 2])
                if sum(b - a for a, b in words) >= 10:
                    start = candidate
                    break
            if start is None:
                raise RuntimeError("No protocol-qualified AMI crop")
            speakers = {s.get("nxt_agent"): s for s in meeting}
            target = speakers[agent]
            intervals = interval_union([(max(a, start) - start, min(b, start + 22) - start)
                                        for a, b, _, kind in annotations if kind == "w" and a < start + 22 and b > start])
            for device, suffix in [("headset", f"Headset-{target.get('channel')}"), ("distant-array", "Array1-01")]:
                url = f"https://groups.inf.ed.ac.uk/ami/AMICorpusMirror/amicorpus/{meeting_id}/audio/{meeting_id}.{suffix}.wav"
                header = ranged(url, 0, 255, f"{meeting_id}.{suffix}.header")
                # These selected upstream signals use the canonical 44-byte PCM header.
                if header[:4] != b"RIFF" or header[8:16] != b"WAVEfmt " or header[36:40] != b"data":
                    raise RuntimeError("Unexpected AMI WAV layout")
                fmt, channels, rate, _, _, bits = struct.unpack_from("<HHIIHH", header, 20)
                if (fmt, channels, bits) != (1, 1, 16):
                    raise RuntimeError("Expected mono PCM16")
                first, count = round(start * rate), 22 * rate
                pcm = ranged(url, 44 + first * 2, 44 + (first + count) * 2 - 1,
                             f"{meeting_id}.{agent}.{suffix}.pcm")
                data = wav(pcm, rate)
                filename = f"ami-{meeting_id}-{agent}-{device}.wav"
                save_clip(filename, data)
                clips.append(dict(file=filename, corpus="AMI", license="CC-BY-4.0", split=split,
                                  language="en", device=device, meeting=meeting_id,
                                  participantIds=sorted(s.get("global_name") for s in meeting),
                                  targetParticipant=target.get("global_name"), sourceUrl=url,
                                  sourceStartSample=first, sourceEndSample=first + count,
                                  sourceRangeSha256=sha(pcm), sourceHeaderSha256=sha(header),
                                  sampleRate=rate, sha256=sha(data), speechIntervals=intervals,
                                  annotationKind="Human transcript; automatically forced-aligned word timings. All speakers, including possible headset bleed.",
                                  calibrationKind="Native room interval without annotated vocal activity; absence of labels is not verified silence."))

# FLEURS official source: first two physical WAV members, not selected by app
# outputs. Streaming tar reading avoids downloading ~0.5 GB per language.
revision = previous["fleursRevision"] if previous else json.loads(fetch("https://huggingface.co/api/datasets/google/fleurs", "fleurs-info.json"))["sha"]
card = fetch(f"https://huggingface.co/datasets/google/fleurs/raw/{revision}/README.md", "FLEURS_README.md")
(OUT / "FLEURS_README.md").write_bytes(card)
for language in ["de_de", "fr_fr", "es_419"]:
    base = f"https://huggingface.co/datasets/google/fleurs/resolve/{revision}/data/{language}"
    tsv = fetch(base + "/test.tsv", language + "-test.tsv")
    rows = {fields[1]: fields for line in tsv.decode().splitlines() if len(fields := line.split("\t")) >= 4}
    members_file = CACHE / (language + "-members.json")
    if members_file.exists():
        members = json.loads(members_file.read_text())
    else:
        members = []
        with urllib.request.urlopen(base + "/audio/test.tar.gz", timeout=60) as response:
            with tarfile.open(fileobj=response, mode="r|gz") as archive:
                for member in archive:
                    if member.isfile() and member.name.endswith(".wav"):
                        filename = pathlib.PurePosixPath(member.name).name
                        data = archive.extractfile(member).read()
                        (CACHE / (language + "-" + filename)).write_bytes(data)
                        members.append(filename)
                        if len(members) == 2:
                            break
        members_file.write_text(json.dumps(members))
    for filename in members:
        data = (CACHE / (language + "-" + filename)).read_bytes()
        offset, source_pcm, fmt = 12, None, None
        while offset + 8 <= len(data):
            kind, size = data[offset:offset + 4], struct.unpack_from("<I", data, offset + 4)[0]
            if kind == b"fmt ":
                fmt = struct.unpack_from("<HHIIHH", data, offset + 8)
            if kind == b"data":
                source_pcm = data[offset + 8:offset + 8 + size]
            offset += 8 + size + size % 2
        if fmt is None or source_pcm is None or (fmt[0], fmt[1], fmt[5]) != (3, 1, 32):
            raise RuntimeError("Expected mono IEEE float32 FLEURS")
        rate = fmt[2]
        source_frames = len(source_pcm) // 4
        frames = min(source_frames, 20 * rate)
        # Round-to-even, clamp only at PCM16 representable bounds. Retain hash
        # of original float WAV separately from this derived app fixture.
        converted = b"".join(struct.pack("<h", max(-32768, min(32767, round(value * 32768))))
                             for (value,) in struct.iter_unpack("<f", source_pcm[:frames * 4]))
        pcm = b"\0" * (2 * rate * 2) + converted
        output = wav(pcm, rate)
        name = f"fleurs-{language}-{filename}"
        save_clip(name, output)
        fields = rows[filename]
        clips.append(dict(file=name, corpus="FLEURS", license="CC-BY-4.0", split="supplementary",
                          language=language, device="unspecified", participantIds=None,
                          sourceUrl=base + "/audio/test.tar.gz", sourceMember=filename,
                          sourceSha256=sha(data), sourceStartSample=0, sourceEndSample=frames,
                          sampleRate=rate, sha256=sha(output), transcript=fields[2],
                          truncated=frames < source_frames,
                          conversion="IEEE float32 to PCM16: round-to-even(x*32768), clamp to [-32768,32767]; prepend 2 s zeros",
                          speechIntervals=None, annotationKind="Transcript only; no speech-boundary truth or speaker split claim.",
                          calibrationKind="Inserted digital silence; not native room calibration."))

manifest = dict(schemaVersion=1, protocol="Frozen before worker output: AMI first eligible annotation window on .5 s grid; FLEURS first two WAV tar members in each language. No tuning on evaluation outputs.",
                amiAnnotationUrl=annotation_url, amiAnnotationSha256=sha(annotation_bytes),
                fleursRevision=revision,
                annotationSnapshotSha256={p.name: sha(p.read_bytes()) for p in sorted(OUT.iterdir(), key=lambda p: p.name.casefold())
                                         if p.name.endswith('.xml') or p.name in ['AMI_LICENCE.txt', 'AMI_00README_MANUAL.txt', 'FLEURS_README.md']},
                clips=clips)
if previous and manifest != previous:
    raise RuntimeError("Recollection differs from the pinned manifest; inspect provenance before replacing it")
if not previous:
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
print(json.dumps(dict(clips=len(clips), bytes=sum((OUT / c["file"]).stat().st_size for c in clips))))
