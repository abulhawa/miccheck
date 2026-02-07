# MicCheck

[![CI](https://github.com/miccheck/miccheck/actions/workflows/ci.yml/badge.svg)](https://github.com/miccheck/miccheck/actions/workflows/ci.yml)

MicCheck is a browser-based microphone quality analyzer that records a short sample locally, analyzes it in the browser, and provides actionable feedback.

![MicCheck results page screenshot](docs/images/results-page.png)

## How It Works

Record -> Analyze -> Fix

- **Record:** Capture a 5-7 second microphone sample in the browser.
- **Analyze:** Measure clipping, volume, noise floor, and room echo locally.
- **Fix:** Get a letter grade and the single most impactful improvement.

## Features

- 5-7 second recording flow with real-time meter
- Local analysis for clipping, volume, noise, and room echo
- A-F grade with one prioritized fix
- Works across modern desktop and mobile browsers

## Supported Browsers

| Browser | Status | Notes |
| --- | --- | --- |
| Chrome / Edge (desktop) | Full | Best experience |
| Firefox (desktop) | Partial | Minor quirks possible |
| Safari (macOS) | Limited | System processing may override |
| Safari (iOS) | Degraded | Basic analysis only |

## Privacy

MicCheck analyzes audio locally in your browser and does not upload recorded audio to our servers.
The latest sample is temporarily stored in `sessionStorage` to support playback after navigation/refresh in the same tab.
Review the full policy in [docs/PRIVACY.md](docs/PRIVACY.md).

## Release Readiness

Use [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) before any public release.

## Local Development

```bash
npm install && npm run dev
```

Then visit `http://localhost:3000`.

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS
- Turborepo workspaces
- Vitest

## Project Structure

- `apps/web`: Next.js frontend
- `packages/audio-core`: low-level PCM utilities and browser helpers
- `packages/audio-metrics`: analysis and scoring engine
- `docs`: privacy and compatibility docs
