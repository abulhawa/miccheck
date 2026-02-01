# MicCheck Audio Analysis Technical Specification

## 1. Overview
MicCheck computes audio quality metrics from PCM samples, using shared utilities in `audio-core` and metric implementations in `audio-metrics`, then translates metrics into category scores and an overall grade. The system evaluates clipping, level (RMS), noise/SNR (with VAD and hum detection), and echo (autocorrelation). Source-of-truth implementation references are embedded throughout this document with exact file/line citations.

## 2. Mathematical Equations (as implemented)

### 2.1 Clipping Detection
**Sample classification:**
- A sample is considered clipped when: **|x| ≥ C_threshold**. The implementation checks `Math.abs(sample) >= threshold` and counts clipped samples. (`threshold` defaults to `clippingThreshold = 0.98`.)【F:packages/audio-metrics/src/metrics/clipping.ts†L12-L26】【F:packages/audio-metrics/src/config.ts†L1-L23】

**Clipping ratio:**
- **R_clip = N_clipped / max(1, N_total)** to avoid division by zero.【F:packages/audio-metrics/src/metrics/clipping.ts†L16-L25】

**Peak measurement (for context):**
- **peak = max(|x_i|)** in `computePeak`.【F:packages/audio-core/src/pcmUtils.ts†L35-L46】

**Threshold value:**
- **C_threshold = 0.98** (`clippingThreshold`).【F:packages/audio-metrics/src/config.ts†L1-L5】

### 2.2 Voice Activity Detection (VAD)
**Frame sizing:**
- **frameSize = max(1, floor(sampleRate · frameMs / 1000))**, with default **frameMs = 30** in `detectVoiceActivity`.【F:packages/audio-core/src/vad.ts†L20-L31】

**Frame RMS (energy proxy):**
- **E_frame = RMS = sqrt((1/N) · Σ x_i²)** computed per frame via `computeRms`.【F:packages/audio-core/src/vad.ts†L34-L37】【F:packages/audio-core/src/pcmUtils.ts†L23-L33】

**Speech decision threshold:**
- **T_vad = 10^(thresholdDb / 20)**, with default **thresholdDb = -35 dBFS**. Speech if **E_frame ≥ T_vad**.【F:packages/audio-core/src/vad.ts†L20-L38】

**Speech ratio:**
- **R_speech = N_speech_frames / max(1, N_total_frames)**.【F:packages/audio-core/src/vad.ts†L31-L48】

### 2.3 Noise Floor, SNR, and Hum Detection (VAD-based)
Noise metrics are computed with a VAD-driven separation of speech/noise frames using **frameMs = 50** by default in `measureNoise`, which calls `detectVoiceActivity(samples, sampleRate, frameMs)`.【F:packages/audio-metrics/src/metrics/noise.ts†L49-L60】

**RMS per frame (noise module):**
- **RMS = sqrt((1/N) · Σ x_i²)** (duplicate local helper).【F:packages/audio-metrics/src/metrics/noise.ts†L10-L18】

**Percentile selection:**
- **percentile(values, p) = sorted[floor(n · p)]**, capped at `n - 1` for the index. Used for noise floor and speech level estimates.【F:packages/audio-metrics/src/metrics/noise.ts†L22-L27】

**Noise floor estimate:**
- **N_floor = percentile(P_noise, 0.2)** (20th percentile of non-speech frame RMS).【F:packages/audio-metrics/src/metrics/noise.ts†L71-L92】【F:packages/audio-metrics/src/metrics/noise.ts†L115-L119】

**Speech level estimate:**
- **S_level = percentile(P_speech, 0.5)** (median speech RMS).【F:packages/audio-metrics/src/metrics/noise.ts†L71-L78】【F:packages/audio-metrics/src/metrics/noise.ts†L115-L118】

**SNR (dB):**
- dB conversion uses **20 · log10(max(value, 1e-8))** to avoid `-∞`.【F:packages/audio-metrics/src/metrics/noise.ts†L20-L20】
- **SNR_dB = toDb(S_level) − toDb(N_floor)**.【F:packages/audio-metrics/src/metrics/noise.ts†L115-L118】

**Fallbacks when speech/noise frames are missing:**
- If both speech/noise are empty, it seeds noise with **percentile(allFrames, 0.1)**.【F:packages/audio-metrics/src/metrics/noise.ts†L81-L84】
- If no speech frames: **snrDb = 0** and `noiseFloor = percentile(noiseFrames, 0.2)`.【F:packages/audio-metrics/src/metrics/noise.ts†L90-L93】
- If no noise frames: gated noise estimate with **gate = overallRms · 0.2**, RMS of samples where |x| ≤ gate; if empty, fallback to **percentile(frameRms, 0.1)**. SNR is then **toDb(overallRms) − toDb(noiseFloor)**.【F:packages/audio-metrics/src/metrics/noise.ts†L95-L112】

**Hum detection (Goertzel):**
- Uses Goertzel power at 50 Hz and 60 Hz.
- **k = round(0.5 + N · f / sampleRate)**
- **ω = (2πk) / N**
- **coeff = 2 · cos(ω)**
- Recurrence: **s0 = x + coeff·s1 − s2** (iterated); **power = s1² + s2² − coeff·s1·s2**, then **power / N**.【F:packages/audio-metrics/src/metrics/noise.ts†L29-L44】
- Total energy: **E_total = (1/N) · Σ x_i²** and **H_ratio = max(E_50Hz, E_60Hz) / E_total** (if E_total > 0).【F:packages/audio-metrics/src/metrics/noise.ts†L66-L69】

### 2.4 Level (RMS) Measurement
**RMS:**
- **RMS = sqrt((1/N) · Σ x_i²)** in `computeRms` (shared).【F:packages/audio-core/src/pcmUtils.ts†L23-L33】

**dBFS conversion:**
- **dBFS = 20 · log10(max(RMS, 1e-8))** in `measureLevel`.【F:packages/audio-metrics/src/metrics/level.ts†L8-L15】

**Target range:**
- **targetRmsDb = −18 dBFS**, **targetRangeDb = 6 dB**, so the target band is **[−24, −12] dBFS**. Level severities use min/max thresholds from config. 【F:packages/audio-metrics/src/config.ts†L6-L12】【F:packages/audio-metrics/src/scoring/categoryScores.ts†L10-L31】

### 2.5 Echo Detection
**Autocorrelation (raw):**
- **R(τ) = (1/(N − τ)) · Σ x_i · x_{i+τ}**, computed over `samples.length - lag`.【F:packages/audio-metrics/src/metrics/echo.ts†L5-L14】

**Lag range:**
- **τ_min = floor(sampleRate · 0.08)** (80 ms)
- **τ_max = floor(sampleRate · 0.2)** (200 ms)
- Step = **floor(sampleRate · 0.01)** (10 ms).【F:packages/audio-metrics/src/metrics/echo.ts†L19-L49】

**Normalization:**
- Average energy: **E_avg = (1/N) · Σ x_i²**. Each correlation is normalized by **E_avg**, and clipped to non-negative: **normalized = max(0, R(τ) / E_avg)**.【F:packages/audio-metrics/src/metrics/echo.ts†L33-L46】

**Echo score (contrast normalization):**
- Compute mean correlation across lags and compute **local contrast** for each lag: **contrast = corr_i − localMean_i**, where `localMean_i` is the mean of neighbors within ±2 indices (excluding self). The maximum contrast is used. Then:

  **E_score = 0** if **meanCorrelation ≥ 0.999**, else
  **E_score = clamp( maxLocalContrast / (1 − meanCorrelation), 0, 1 )**.

This matches the normalization logic in `measureEcho`.【F:packages/audio-metrics/src/metrics/echo.ts†L56-L81】

## 3. Algorithm Pseudocode (implementation-aligned)

### Algorithm: VAD-based SNR calculation
**Input:** `samples`, `sampleRate`
**Output:** `noiseFloor`, `snrDb`, `humRatio`, `confidence`

```
1. if samples.length == 0: return {noiseFloor: 0, snrDb: 0, humRatio: 0, confidence: "low"}
2. vad = detectVoiceActivity(samples, sampleRate, frameMs=50)
3. frameRms = vad.frameRms (or vad.frames[].rms)
4. isSpeechFrame = vad.isSpeechFrame (or vad.frames[].isSpeech)
5. if frameRms is empty: return {noiseFloor: 0, snrDb: 0, humRatio: 0, confidence: "low"}
6. hum50 = goertzel(samples, sampleRate, 50)
7. hum60 = goertzel(samples, sampleRate, 60)
8. totalEnergy = (Σ x_i²) / N
9. humRatio = (totalEnergy > 0) ? max(hum50, hum60) / totalEnergy : 0
10. speechFrames = [frameRms[i] where isSpeechFrame[i]]
11. noiseFrames = [frameRms[i] where !isSpeechFrame[i]]
12. if speechFrames and noiseFrames are both empty:
      noiseFrames.add(percentile(frameRms, 0.1))
13. speechRatio = speechFrames.length / max(1, frameRms.length)
14. confidence = (speechFrames.length == 0) ? "low" : (speechRatio >= 0.3) ? "high" : "medium"
15. if speechFrames is empty:
      noiseFloor = percentile(noiseFrames, 0.2)
      return {noiseFloor, snrDb: 0, humRatio, confidence}
16. if noiseFrames is empty:
      overallRms = computeRms(samples)
      gate = overallRms * 0.2
      noiseFloor = rms(samples where |x| <= gate)
      if noiseFloor == 0: noiseFloor = percentile(frameRms, 0.1)
      snrDb = toDb(overallRms) - toDb(noiseFloor)
      return {noiseFloor, snrDb, humRatio, confidence: "medium"}
17. noiseFloor = percentile(noiseFrames, 0.2)
18. speechLevel = percentile(speechFrames, 0.5)
19. snrDb = toDb(speechLevel) - toDb(noiseFloor)
20. return {noiseFloor, snrDb, humRatio, confidence}
```

Implementation references: `measureNoise`, `detectVoiceActivity`, `computeRms`, `toDb`, `computePercentile`, and Goertzel helpers.【F:packages/audio-metrics/src/metrics/noise.ts†L1-L119】【F:packages/audio-core/src/vad.ts†L20-L58】

## 4. Threshold Configuration Table

| Threshold | Value | Purpose | Source File |
| --- | --- | --- | --- |
| `clippingThreshold` | 0.98 | Soft clipping detection threshold | `packages/audio-metrics/src/config.ts`【F:packages/audio-metrics/src/config.ts†L1-L5】 |
| `clippingRatioWarning` | 0.005 | Clipping warning severity | `packages/audio-metrics/src/config.ts`【F:packages/audio-metrics/src/config.ts†L1-L5】 |
| `clippingRatioSevere` | 0.02 | Clipping severe severity | `packages/audio-metrics/src/config.ts`【F:packages/audio-metrics/src/config.ts†L1-L5】 |
| `targetRmsDb` | -18 dBFS | Ideal RMS target | `packages/audio-metrics/src/config.ts`【F:packages/audio-metrics/src/config.ts†L6-L12】 |
| `targetRangeDb` | 6 dB | Acceptable RMS range around target | `packages/audio-metrics/src/config.ts`【F:packages/audio-metrics/src/config.ts†L6-L12】 |
| `minRmsDb` | -30 dBFS | Lower RMS warning threshold | `packages/audio-metrics/src/config.ts`【F:packages/audio-metrics/src/config.ts†L6-L12】 |
| `maxRmsDb` | -8 dBFS | Upper RMS warning threshold | `packages/audio-metrics/src/config.ts`【F:packages/audio-metrics/src/config.ts†L6-L12】 |
| `minRmsDbSevere` | -40 dBFS | Lower RMS severe threshold | `packages/audio-metrics/src/config.ts`【F:packages/audio-metrics/src/config.ts†L10-L12】 |
| `maxRmsDbSevere` | -2 dBFS | Upper RMS severe threshold | `packages/audio-metrics/src/config.ts`【F:packages/audio-metrics/src/config.ts†L10-L12】 |
| `snrExcellentDb` | 35 dB | SNR for 5-star noise rating | `packages/audio-metrics/src/config.ts`【F:packages/audio-metrics/src/config.ts†L13-L18】 |
| `snrGoodDb` | 25 dB | SNR for 4-star noise rating | `packages/audio-metrics/src/config.ts`【F:packages/audio-metrics/src/config.ts†L13-L18】 |
| `snrFairDb` | 15 dB | SNR for 3-star noise rating | `packages/audio-metrics/src/config.ts`【F:packages/audio-metrics/src/config.ts†L13-L18】 |
| `snrPoorDb` | 10 dB | SNR for 2-star noise rating | `packages/audio-metrics/src/config.ts`【F:packages/audio-metrics/src/config.ts†L13-L18】 |
| `snrSevereDb` | 5 dB | SNR severe flag | `packages/audio-metrics/src/config.ts`【F:packages/audio-metrics/src/config.ts†L13-L18】 |
| `humWarningRatio` | 0.08 | Hum detection warning ratio | `packages/audio-metrics/src/config.ts`【F:packages/audio-metrics/src/config.ts†L19-L22】 |
| `echoWarningScore` | 0.35 | Echo warning threshold | `packages/audio-metrics/src/config.ts`【F:packages/audio-metrics/src/config.ts†L19-L22】 |
| `echoSevereScore` | 0.75 | Echo severe threshold | `packages/audio-metrics/src/config.ts`【F:packages/audio-metrics/src/config.ts†L19-L22】 |
| `vadThresholdDb` | -35 dBFS | Energy-based VAD cutoff | `packages/audio-core/src/vad.ts`【F:packages/audio-core/src/vad.ts†L20-L31】 |
| `frameMs` (VAD) | 30 ms | Default VAD frame duration | `packages/audio-core/src/vad.ts`【F:packages/audio-core/src/vad.ts†L20-L31】 |
| `frameMs` (Noise) | 50 ms | Default noise/VAD frame duration | `packages/audio-metrics/src/metrics/noise.ts`【F:packages/audio-metrics/src/metrics/noise.ts†L49-L53】 |

## 5. Grading Logic Specification

### 5.1 Category scores (1–5 stars)
**Level:**
- 1 star if `clippingRatio > clippingRatioWarning` or RMS beyond severe bounds.
- 2 stars if RMS beyond warning bounds.
- 4 stars if RMS outside target range, else 5 stars. Full conditional order: clipping check → severe RMS → warning RMS → target range → excellent. 【F:packages/audio-metrics/src/scoring/categoryScores.ts†L10-L31】

**Noise:**
- 2 stars if `humRatio > humWarningRatio` (hum check overrides SNR buckets).
- SNR buckets from 5 stars (≥ 35 dB) down to 1 star (< 10 dB).【F:packages/audio-metrics/src/scoring/categoryScores.ts†L34-L51】

**Echo:**
- 1 star if `echoScore > echoSevereScore`.
- 2 stars if `echoScore > echoWarningScore`.
- 3 stars if `echoScore > echoWarningScore · 0.7`.
- 4 stars if `echoScore > echoWarningScore · 0.4`.
- 5 stars otherwise.【F:packages/audio-metrics/src/scoring/categoryScores.ts†L53-L67】

### 5.2 Overall grade mapping
- Stars map to letter grades: 5→A, 4→B, 3→C, 2→D, 1→F. Default falls back to F. 【F:packages/audio-metrics/src/scoring/overallGrade.ts†L4-L18】

### 5.3 Worst-offender logic
- Overall stars are the **minimum** of the three category star ratings (`minStars`).【F:packages/audio-metrics/src/scoring/overallGrade.ts†L117-L124】
- `primaryIssueCategory` is chosen as follows:
  - If any category has a **severity ≥ 3**, choose the category with the **highest severity**.
  - Otherwise, among categories at the minimum star rating, select the one with higher severity (tie-break).【F:packages/audio-metrics/src/scoring/overallGrade.ts†L117-L139】

### 5.4 Severity scoring system
Severity is derived per metric with hard-coded thresholds:
- **Level severity**: 3 if `clippingRatio ≥ clippingRatioSevere` or RMS beyond severe bounds; 2 if RMS beyond warning bounds. 【F:packages/audio-metrics/src/scoring/overallGrade.ts†L24-L34】
- **Noise severity**: 3 if `snrDb ≤ snrSevereDb`, 2 if `snrDb ≤ snrPoorDb`, and 2 if `humRatio ≥ humWarningRatio`. The max of these is used. 【F:packages/audio-metrics/src/scoring/overallGrade.ts†L35-L42】
- **Echo severity**: 3 if `echoScore ≥ echoSevereScore`, 2 if `echoScore ≥ echoWarningScore`. 【F:packages/audio-metrics/src/scoring/overallGrade.ts†L43-L49】
- **Clipping severity** (used for explanation): 3 if `clippingRatio ≥ clippingRatioSevere`, 2 if ≥ warning. 【F:packages/audio-metrics/src/scoring/overallGrade.ts†L49-L55】

## 6. File Structure & Data Flow
```
audio-core/
  vad.ts: energy-based VAD → frames, speechRatio, frameRms, isSpeechFrame
  pcmUtils.ts: RMS/peak utilities used by VAD and level calculations
  ↓
audio-metrics/
  metrics/noise.ts: VAD + percentile statistics → noiseFloor, snrDb, humRatio
  metrics/clipping.ts: absolute-sample thresholding → clippingRatio, peak
  metrics/level.ts: RMS calculation → rms, rmsDb
  metrics/echo.ts: autocorrelation + normalization → echoScore
  ↓
  scoring/categoryScores.ts: metrics → per-category 1–5 stars
  scoring/overallGrade.ts: star ratings + severities → letter grade + explanation
```
Implementation references: VAD and utilities in `audio-core`, metrics in `audio-metrics`, and scoring logic in `scoring/`.【F:packages/audio-core/src/vad.ts†L20-L58】【F:packages/audio-core/src/pcmUtils.ts†L23-L46】【F:packages/audio-metrics/src/metrics/noise.ts†L49-L119】【F:packages/audio-metrics/src/metrics/clipping.ts†L12-L26】【F:packages/audio-metrics/src/metrics/level.ts†L13-L15】【F:packages/audio-metrics/src/metrics/echo.ts†L19-L81】【F:packages/audio-metrics/src/scoring/categoryScores.ts†L72-L99】【F:packages/audio-metrics/src/scoring/overallGrade.ts†L113-L147】

## 7. Edge Case Handling

- **Empty or silent recordings:**
  - Noise: immediate return with zeros and `confidence: "low"`.【F:packages/audio-metrics/src/metrics/noise.ts†L54-L56】
  - Echo: returns `echoScore: 0` if not enough samples or if average energy ≤ 0.【F:packages/audio-metrics/src/metrics/echo.ts†L28-L41】
  - RMS/Peak utilities return 0 when inputs are empty (RMS uses `samples.length === 0`).【F:packages/audio-core/src/pcmUtils.ts†L23-L33】

- **All-noise or all-speech recordings:**
  - If all frames are noise (no speech), `snrDb = 0` and noise floor is 20th percentile of noise frames.【F:packages/audio-metrics/src/metrics/noise.ts†L90-L93】
  - If all frames are speech (no noise), noise floor uses gated RMS at 20% of overall RMS; if empty, percentile fallback is used. SNR computed from overall RMS vs. noise floor.【F:packages/audio-metrics/src/metrics/noise.ts†L95-L112】

- **Very short recordings (< 0.5s):**
  - Echo detector returns `echoScore: 0` when sample count ≤ max lag (min 80–200 ms). This acts as a safe fallback for short clips.【F:packages/audio-metrics/src/metrics/echo.ts†L23-L31】
  - VAD computes frame size with `max(1, floor(...))`, ensuring at least 1 sample per frame.【F:packages/audio-core/src/vad.ts†L26-L34】

- **Sample rate variations:**
  - Frame size and lag calculations scale directly with `sampleRate`, so time-based windows remain consistent across sample rates.【F:packages/audio-core/src/vad.ts†L26-L27】【F:packages/audio-metrics/src/metrics/echo.ts†L23-L43】

- **Browser API limitations:**
  - This repo does not include explicit browser API guards in these files; consumers should ensure PCM buffers are valid `Float32Array` instances and handle capture errors externally. (No additional implementation references in these modules.)

## 8. Constants & Conversion Factors

- **dB conversion:** `20 · log10(max(x, 1e-8))` in noise and level computations.【F:packages/audio-metrics/src/metrics/noise.ts†L20-L20】【F:packages/audio-metrics/src/metrics/level.ts†L8-L15】
- **Frame duration:** VAD uses `frameMs = 30`, noise uses `frameMs = 50`.【F:packages/audio-core/src/vad.ts†L20-L24】【F:packages/audio-metrics/src/metrics/noise.ts†L49-L53】
- **Percentile indices:** 0.2 (noise floor), 0.5 (speech level), 0.1 (fallback).【F:packages/audio-metrics/src/metrics/noise.ts†L81-L118】
- **Clipping ratio thresholds:** warning 0.005, severe 0.02.【F:packages/audio-metrics/src/config.ts†L1-L5】
- **Echo thresholds:** warning 0.35, severe 0.75.【F:packages/audio-metrics/src/config.ts†L19-L22】
- **Hum ratio warning:** 0.08.【F:packages/audio-metrics/src/config.ts†L19-L22】

## 9. Implementation Notes

- **Linear vs. dB scale:** All RMS values are computed in linear amplitude, then converted to dB via `20 · log10(max(x, 1e-8))`. The VAD threshold is converted from dB to linear amplitude with `10^(thresholdDb / 20)`.【F:packages/audio-metrics/src/metrics/noise.ts†L20-L20】【F:packages/audio-metrics/src/metrics/level.ts†L8-L15】【F:packages/audio-core/src/vad.ts†L30-L37】
- **Normalization:** Echo correlations are normalized by average energy, clipped to non-negative values, and scaled by contrast normalization to yield a 0–1 score.【F:packages/audio-metrics/src/metrics/echo.ts†L33-L81】
- **Clipping ratio normalization:** division by `max(1, samples.length)` avoids undefined ratios on empty inputs.【F:packages/audio-metrics/src/metrics/clipping.ts†L16-L25】

## 10. Appendix: Key Reference Files
- `packages/audio-metrics/src/config.ts` — threshold constants.【F:packages/audio-metrics/src/config.ts†L1-L23】
- `packages/audio-metrics/src/metrics/clipping.ts` — clipping detection.【F:packages/audio-metrics/src/metrics/clipping.ts†L12-L26】
- `packages/audio-metrics/src/metrics/noise.ts` — noise/SNR with VAD and hum detection.【F:packages/audio-metrics/src/metrics/noise.ts†L1-L119】
- `packages/audio-metrics/src/metrics/level.ts` — level measurement.【F:packages/audio-metrics/src/metrics/level.ts†L1-L16】
- `packages/audio-metrics/src/metrics/echo.ts` — echo detection.【F:packages/audio-metrics/src/metrics/echo.ts†L1-L81】
- `packages/audio-core/src/vad.ts` — voice activity detection.【F:packages/audio-core/src/vad.ts†L1-L58】
- `packages/audio-metrics/src/scoring/` — grading logic and overall grade synthesis.【F:packages/audio-metrics/src/scoring/categoryScores.ts†L1-L99】【F:packages/audio-metrics/src/scoring/overallGrade.ts†L1-L148】
