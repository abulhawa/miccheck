## Miccheck repo guidance

### Quick map
- `apps/web/`: Next.js app
- `packages/audio-core/`: core audio utilities
- `packages/audio-metrics/`: metrics built on audio-core

### Common commands
- Root: `npm run build`, `npm run test`, `npm run lint` (Turbo)
- Web only: `npm --workspace apps/web run build|test|lint`
- Audio packages: `npm --workspace packages/audio-core run test` and `npm --workspace packages/audio-metrics run test`

### Guardrails
- In this Codex container, `npm --workspace packages/audio-metrics run build` often fails because workspace resolution for `@miccheck/audio-core` is unavailable. Skip that build unless the user explicitly asks; note it is an environment limitation.
- Prefer `npm --workspace packages/audio-metrics run test` for validation when possible.

### Preferences
- Keep changes scoped to the relevant package or app.
- For UI changes, favor editing existing components/hooks in `apps/web` over new abstractions.
- For audio package tweaks, update types/exports and keep tests in sync.
