# Agent Onboarding for `inngest`

Welcome! This repository contains a TypeScript CLI for interacting with the Inngest API. These notes capture the practical setup steps, conventions, and pitfalls observed while collaborating across agents.

## Environment & Tooling
- Node.js `>=18` required (checked via `package.json` engines). Prefer 18.18+ to match local dev.
- Dependencies are managed with npm. Run `npm install` before building or testing.
- TypeScript sources live in `src/`; compiled output goes to `dist/` via `tsc`.
- The published package name is `@steipete/inngest`; the executable is `dist/cli.js` (exposed as `inngest`).
- Environment variable `INNGEST_SIGNING_KEY` is mandatory for commands that touch the live API. Optional overrides: `INNGEST_API_URL`, `INNGEST_DEV_SERVER_URL`, `INNGEST_DEV_SERVER_PORT`, `INNGEST_ENV`.

## Common Commands
- Build once: `npm run build`
- Rebuild on changes: `npm run dev`
- Test suite: `npm test`
- Test with coverage: `npm run test:coverage`
- Lint/format: `npm run lint` (check only) and `npm run lint:fix` or `npm run format`
- Full CI parity: `npm run check` (lint → test → build). This runs automatically on publish (`prepublishOnly`).

## Repo Layout Highlights
- `src/cli.ts` wires together Commander commands defined in `src/commands/`.
- HTTP interaction lives in `src/api/client.ts` with Zod validation schemas in `src/api/types.ts`.
- Table/JSON rendering helpers are in `src/utils/display.ts`.
- Tests reside under `src/__tests__/` and use Vitest.
- `docs/` contains product-focused usage docs; keep developer docs in this file or the README.

## Development Notes
- After editing TypeScript, run `npm run build` so `dist/` stays in sync before testing the binary or committing.
- The CLI relies on strict Zod schemas; when backend responses change, update both the schema (`src/api/types.ts`) and any pretty-printers in `src/utils/display.ts` to avoid runtime validation failures (recent issue seen in `inngest jobs` command with missing fields).
- `biome.json` configures lint/format; respect its style to reduce diff noise.
- Keep CLI UX consistent: update both Commander definitions (flags, descriptions) and README usage examples when adding options.
- Publishing happens through npm (`npm publish`); verify `npm view inngest-cli version` against local `dist` if release alignment matters.

## Testing Tips
- Use `npm test` for quick feedback; prefer focused tests in `src/__tests__/` that mock HTTP via the existing fixtures.
- When working on the CLI behavior, add end-to-end style tests to `src/__tests__/commands.test.ts` using the helper utilities already present.
- Snapshot-style outputs (tables/JSON) should be asserted via the `prepare*` helpers instead of raw string matching where possible; this keeps tests resilient to formatting tweaks.

## Operational Checklist for Agents
1. Install dependencies with `npm install` (skip if `node_modules/` already present and up to date).
2. For CLI changes, run `npm run build` and execute the relevant `dist/cli.js` command to validate behavior locally.
3. Run `npm run check` before handing off significant changes.
4. Document user-facing additions in `CHANGELOG.md` and `README.md` when shipping features.
5. Ensure new API integrations include schema updates plus error-handling tests.

## Links & References
- Primary docs: `README.md`
- Licensing: `LICENSE`
- Issue tracker: https://github.com/steipete/inngest/issues
- npm package: `inngest-cli` (alias for the published binary version)

Keep this file updated as workflows evolve. Happy shipping!
