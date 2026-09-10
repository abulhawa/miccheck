# Release checklist

## Automated gates

- [ ] `npm ci` on a clean checkout with Node.js 22 or 24.
- [ ] `npm run test` passes all workspaces and coverage thresholds.
- [ ] `npm run build` succeeds, including model checksum validation.
- [ ] `npm run lint` passes.
- [ ] `npm audit` reviewed; CI rejects high-severity advisories.
- [ ] `npx playwright install chromium`, then `npm --workspace apps/web run test:e2e`.

## Manual validation before a public release

- [ ] Physical microphones: built-in, USB, Bluetooth; quiet speech, fan, typing, clipping, silence, and changed device.
- [ ] Permission denied, slow permission, device disconnected, background tab, interrupted capture, and storage blocked.
- [ ] Chrome/Edge, Firefox, and Safari on real desktop/mobile devices; record versions and limitations in COMPATIBILITY.md.
- [ ] Keyboard and screen-reader review of recording status, results, sliders, and comparison controls.
- [ ] Inspect `/`, `/test`, `/pro`, `/results`, and `/privacy` on the deployed HTTPS origin.
- [ ] Confirm model assets and runtime are served from that origin, and network requests contain no microphone audio.
- [ ] Keep analytics disabled unless the deployment's disclosures and configuration have been reviewed.
- [ ] Run the synthetic benchmark and collect a separate representative speaker/room/device evaluation before claiming accuracy.

The automated suite uses generated voice and a fake microphone. It does not replace the unchecked physical-device and accessibility evaluations above. Deployment and publishing are separate from local verification.
