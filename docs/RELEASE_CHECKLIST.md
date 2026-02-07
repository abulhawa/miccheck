# Release Checklist

Use this checklist before public launch or significant updates.

## Privacy and Legal

- Confirm all privacy copy matches real behavior in `apps/web` and `docs/PRIVACY.md`.
- Verify no recorded audio is uploaded to backend services.
- Verify temporary audio storage behavior (`sessionStorage`) is documented and intentional.
- Confirm affiliate disclosure text is visible where recommendations/links appear.
- Verify policy links are present and functional on all primary routes.

## Analytics and Consent

- Inventory analytics providers and events (Vercel Analytics, Speed Insights, custom events).
- Confirm analytics payloads never include raw audio, transcripts, or direct identifiers.
- Confirm consent requirements for target regions (for example GDPR/EEA and CPRA) and implement gating if required.
- Verify analytics can be disabled in non-production or privacy-sensitive deployments.

## Test and Coverage Gating

- Run `npm run lint` at repo root and resolve warnings intended to block release.
- Run `npm run test` at repo root and ensure all workspace suites pass.
- Run `npm run build` at repo root and ensure all workspace builds pass.
- Verify coverage thresholds are actually enforced in CI (not only configured in package metadata).
- Perform a manual smoke test of `/`, `/test`, `/pro`, `/results`, and `/privacy` on desktop and mobile.
