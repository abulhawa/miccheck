"""Offline provenance, sample-grid and speaker-split validation."""
import hashlib
import json
import pathlib
import wave
import xml.etree.ElementTree as ET

folder = pathlib.Path(__file__).resolve().parents[1] / "e2e/fixtures/accuracy-expansion"
manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
sha = lambda data: hashlib.sha256(data).hexdigest()
for name, expected in manifest["annotationSnapshotSha256"].items():
    assert sha((folder / name).read_bytes()) == expected, name
meetings = ET.fromstring((folder / "ami-meetings.xml").read_bytes())
development, evaluation = set(), set()
assert len(manifest["clips"]) == 14
for clip in manifest["clips"]:
    data = (folder / clip["file"]).read_bytes()
    assert sha(data) == clip["sha256"], clip["file"]
    with wave.open(str(folder / clip["file"]), "rb") as reader:
        assert reader.getframerate() == clip["sampleRate"] and reader.getnchannels() == 1 and reader.getsampwidth() == 2
        expected = clip["sourceEndSample"] - clip["sourceStartSample"]
        if clip["corpus"] == "FLEURS":
            expected += 2 * clip["sampleRate"]
        assert reader.getnframes() == expected
        pcm = reader.readframes(expected)
    if clip["corpus"] == "AMI":
        assert sha(pcm) == clip["sourceRangeSha256"]
        meeting = next(m for m in meetings if m.get("observation") == clip["meeting"])
        ids = sorted(s.get("global_name") for s in meeting)
        assert ids == clip["participantIds"] and clip["targetParticipant"] in ids
        target = next(s for s in meeting if s.get("global_name") == clip["targetParticipant"])
        expected_suffix = f"Headset-{target.get('channel')}" if clip["device"] == "headset" else "Array1-01"
        assert clip["sourceUrl"].endswith(f"{clip['meeting']}.{expected_suffix}.wav")
        (development if clip["split"] == "development" else evaluation).update(ids)
        # Confirm native calibration was selected without annotation overlap.
        start = clip["sourceStartSample"] / clip["sampleRate"]
        assert expected == 22 * clip["sampleRate"] and start * 2 == int(start * 2)
        words = []
        target_words = []
        for agent in "ABCD":
            for item in ET.fromstring((folder / f"{clip['meeting']}.{agent}.words.xml").read_bytes()):
                if item.get("punc") == "true" or not item.get("starttime"):
                    continue
                a, b = float(item.get("starttime")), float(item.get("endtime"))
                if b > a:
                    assert not (a < start + 2.3 and b > start - .3)
                    if item.tag == "w" and a < start + 22 and b > start:
                        words.append([max(a, start) - start, min(b, start + 22) - start])
                        if agent == target.get("nxt_agent"):
                            target_words.append([max(a, start + 2), min(b, start + 22)])
        def union(intervals):
            result = []
            for a, b in sorted(intervals):
                if result and a <= result[-1][1]:
                    result[-1][1] = max(b, result[-1][1])
                else:
                    result.append([a, b])
            return result
        assert union(words) == clip["speechIntervals"]
        assert sum(b - a for a, b in union(target_words)) >= 10
        assert clip["speechIntervals"] and all(0 <= a < b <= 22 for a, b in clip["speechIntervals"])
    else:
        assert clip["speechIntervals"] is None and clip["participantIds"] is None
        assert not any(pcm[:2 * clip["sampleRate"] * 2])
assert len(development) == len(evaluation) == 4 and development.isdisjoint(evaluation)
print(json.dumps(dict(clips=14, developmentParticipants=4, evaluationParticipants=4, languages=4, deviceClasses=2, passed=True)))
