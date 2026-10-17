# Agent Onboarding for `inngest`

Welcome! This repository contains a TypeScript CLI for interacting with the Inngest API. These notes capture the practical setup steps, conventions, and pitfalls observed while collaborating across agents.

## Environment & Tooling

- Node.js `>=20` required (checked via `package.json` engines).
- Dependencies are managed with pnpm. Run `pnpm install` before building or testing.
- Dependabot groups weekly npm patch/minor updates and security updates in `.github/dependabot.yml`. Majors that drop Node.js 20 are deferred. Keep version updates at least three days old: Dependabot's cooldown and pnpm's `minimumReleaseAge: 4320` align with the updater's release-age gate. Do not raise a manifest's minimum version to an ineligible release, even if a frozen install passes.
- Oxfmt 0.66 pinned vulnerable `tinypool@2.1.0` exactly; updating the transitive package alone cannot override that requirement. Keep Oxfmt on a patched release (0.73 or newer), regenerate the lockfile with pnpm, and retain the dependency-security regression tests. The Vite and esbuild overrides live in `pnpm-workspace.yaml`.
- TypeScript sources live in `src/`; compiled output goes to `dist/` via `tsc`.
- The published package name is `@steipete/inngest`; the executable is `dist/cli.js` (exposed as `inngest`).
- Environment variable `INNGEST_SIGNING_KEY` is mandatory for commands that touch the live API. Optional overrides: `INNGEST_API_URL`, `INNGEST_DEV_SERVER_URL`, `INNGEST_DEV_SERVER_PORT`, `INNGEST_ENV`.

## Common Commands

- Build once: `npm run build`
- Rebuild on changes: `npm run dev`
- Test suite: `npm test`
- Test with coverage: `npm run test:coverage`
- Lint/format: `npm run lint` (check only) and `npm run lint:fix` or `npm run format`
- Full CI parity: `npm run check` (lint → build → test). Release CI runs the checks before packing the publication artifact.

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
- Publishing happens through GitHub Actions with npm trusted publishing; follow [RELEASING.md](RELEASING.md). Use its no-publish rehearsal before an authorized release, and verify `npm view @steipete/inngest version` against the built CLI.

## Testing Tips

- Use `npm test` for quick feedback; prefer focused tests in `src/__tests__/` that mock HTTP via the existing fixtures.
- When working on the CLI behavior, add end-to-end style tests to `src/__tests__/commands.test.ts` using the helper utilities already present.
- Snapshot-style outputs (tables/JSON) should be asserted via the `prepare*` helpers instead of raw string matching where possible; this keeps tests resilient to formatting tweaks.

## Operational Checklist for Agents

1. Install dependencies with `pnpm install` (skip if `node_modules/` already present and up to date).
2. For CLI changes, run `npm run build` and execute the relevant `dist/cli.js` command to validate behavior locally.
3. Run `npm run check` before handing off significant changes.
4. Document user-facing additions in `CHANGELOG.md` and `README.md` when shipping features.
5. Ensure new API integrations include schema updates plus error-handling tests.

## Links & References

- Primary docs: `README.md`
- Licensing: `LICENSE`
- Issue tracker: https://github.com/steipete/inngest/issues
- npm package: `@steipete/inngest`

Keep this file updated as workflows evolve. Happy shipping!
