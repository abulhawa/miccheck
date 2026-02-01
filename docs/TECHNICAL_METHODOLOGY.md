# Technical Methodology: Audio Analysis

This page explains, in plain English, exactly how our current audio analysis works. It is based on the production code in `@miccheck/audio-metrics` and `@miccheck/audio-core`.

## 1) Clipping

**What we measure**
- We scan every sample and check its absolute value (how close it is to full scale). If a sample is at or above **0.98**, we count it as clipped. That 0.98 threshold is a **soft threshold**, not true digital 0 dBFS.
- We then compute a **clipping ratio**: the number of “clipped” samples divided by the total sample count.

**Key takeaways**
- **Soft threshold, not true 0 dB:** we use 0.98 instead of 1.0, so clipping can be flagged slightly before a signal reaches full scale.
- **We count samples, not just the max peak:** the result is a ratio (percentage of samples), not a single peak value.

**Simple math**
```
clippingRatio = (# of samples where |sample| >= 0.98) / (total samples)
```

## 2) Noise / SNR

**Do we use a VAD?**
Yes — but it’s a **simple energy-based VAD**, not a complex AI model. We split the audio into short frames and mark a frame as “speech” if its RMS level is above a fixed threshold (about **-35 dBFS**).

**How we estimate noise and speech**
- We compute RMS for each frame.
- Frames above the VAD threshold are “speech frames.” Frames below it are “noise frames.”
- The **noise floor** is taken as the 20th percentile of the noise frames. (If we can’t find any noise frames, we fall back to the 10th percentile of *all* frames.)
- The **speech level** is the median (50th percentile) of the speech frames.

**SNR math**
```
SNR (dB) = 20*log10(speechLevel) - 20*log10(noiseFloor)
```

**Plain-English summary**
- We are **not** just comparing the loudest frame to the quietest frame.
- We **do** separate speech from non‑speech using a basic RMS threshold (energy VAD).
- The SNR is based on **typical speech vs. typical noise**, not the single max peak.

## 3) Grading (Overall Letter Grade)

**How the grade is chosen**
- We compute category scores (1–5 stars) for **Level**, **Noise**, and **Echo**.
- The **overall grade is the worst (lowest) star rating** among those categories.
- That means a single weak area (like heavy clipping or very poor SNR) **drags the whole grade down**.

**Important detail: clipping affects the Level score**
- If the clipping ratio exceeds the warning threshold, the Level category is forced to **1 star**, even if the RMS volume is otherwise “good.”

**Plain-English summary**
- **Not an average:** we don’t average scores across categories.
- **Worst-offender logic:** the grade reflects the weakest category.

---

If you want more detail on thresholds (like exact SNR cutoffs or clipping warning levels), see the configuration values in `packages/audio-metrics/src/config.ts`.
