# Licensed device and language expansion

Collected September 29, 2026. These are offline benchmark assets, separate from
the public demo. `manifest.json` records all source URLs, sample ranges, hashes,
licenses, transformations, annotation limitations and split assignments.

Eight 22 s AMI crops pair a participant's headset channel with a distant
microphone-array channel at the same source time. Development uses ES2002a
(Edinburgh); evaluation uses IS1001a (Idiap). The complete meeting participant
IDs are disjoint: four per meeting, including other potentially audible
participants. Two target participants per meeting provide different excerpts;
the same participant/time across microphones belongs to the same split.
Evaluation was selected before worker outputs and was not used for tuning.
After this published run, these crops are regression material, not fresh holdout.

Selection chooses the first half-second-grid window between 10 and 600 s with
no annotated word/vocal-sound overlap during the first two seconds plus a
300 ms guard, and at least ten seconds of target word-time coverage in the next
twenty seconds. Original PCM16 samples are retrieved by HTTP byte range without
downloading complete meeting recordings. All-speaker word-time unions are
retained for diagnostic agreement because distant microphones and headsets can
pick up other participants, and some transcript words may be inaudible on the
selected channel. Channel audibility has not been independently verified. They are not labels of an acoustically isolated
speaker. Absence of a transcript event does not establish native silence.

AMI attribution: AMI Meeting Corpus, AMI Consortium; Carletta et al., _The AMI
Meeting Corpus: A Pre-announcement_. Audio and annotations are licensed
[CC BY 4.0](https://groups.inf.ed.ac.uk/ami/corpus/license.shtml). Original
license and release README are preserved as `AMI_LICENCE.txt` and
`AMI_00README_MANUAL.txt`; the downloaded manual-annotation archive is named
`ami_public_manual_1.6.2.zip` (its internal README says release 1.7).
[AMI transcription documentation](https://groups.inf.ed.ac.uk/ami/corpus/transcription.shtml)
states that word timings are automatically forced-aligned. Human transcripts
are not independent, manually verified word boundaries. This corpus adds
recorded device/room coverage; it does not close the fine-boundary validation gap.

Six FLEURS clips add German, French and Latin American Spanish: the first two
physical WAV members of each language's test archive, selected before outputs.
The pinned Hugging Face revision is in the manifest. Each original mono float32
WAV is converted to PCM16 using round-to-even and bounded PCM16 quantization;
at most twenty seconds are kept and two seconds of digital silence are
prepended. Two clips are truncated; full source transcripts must not be treated
as transcripts of the retained prefix. Original and derived hashes are separate.
Speaker identifiers and capture devices are unspecified. These six clips are
supplementary language checks, not a speaker-separated evaluation set and not
speech-timing accuracy truth. Digital calibration is not a physical room sample.

FLEURS attribution: Google FLEURS, Conneau et al., _FLEURS: Few-shot Learning
Evaluation of Universal Representations of Speech_; [official dataset](https://huggingface.co/datasets/google/fleurs).
License: CC BY 4.0, as specified in the preserved upstream `FLEURS_README.md`.
Cropping, quantization and inserted silence are our modifications.

Reproduce collection with `python scripts/gather-accuracy-expansion.py` from
`apps/web`. It caches successful downloads, streams only two WAV tar members per
language, and never calls inference or needs credentials. Run
`python scripts/verify-accuracy-expansion.py` for offline byte, sample-grid,
annotation, calibration-selection and participant-split verification. The
benchmark and normal tests read only checked-in fixtures and local models.

See [protocol, decisions and limitations](../../../../../docs/ACCURACY_ALTERNATIVES.md).
