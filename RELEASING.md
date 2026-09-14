# Releasing

The package is `@steipete/inngest`, with the `inngest` executable. Node.js 20 or newer is required. npm is the install channel; GitHub Releases mirror the published npm archive with a SHA-256 checksum. There are no native binaries, Homebrew formula, or appcast.

Versions 0.10.2 and 0.10.3 were published locally to npm on September 24, 2025 with annotated, unsigned Git tags and no GitHub Releases. Their changelog sections were reconstructed from those tags when preparing 0.10.4. The GitHub Release workflow follows the tag-triggered, npm-first pattern used by `steipete/summarize`.

1. Start from clean, synchronized `main`. Confirm the latest registry version with `npm view @steipete/inngest versions dist-tags --json` and check that the intended tag and GitHub Release do not exist.
2. On a release branch, bump `package.json` and finalize the current changelog section with the local release date. The CLI reads its version from package metadata; the pnpm lockfile has no root version field.
3. Run `pnpm install --frozen-lockfile`, `pnpm check`, and `pnpm test:smoke`. Review the complete release change and merge its PR. Wait for all four Node versions in CI to pass on the exact `main` release commit.
4. Immediately before tagging, recheck the remote releases and tags. Create an annotated tag (`git tag -a vX.Y.Z -m "Release vX.Y.Z" <release-commit>`), matching the existing unsigned tag convention.
5. Publish locally from that clean release commit with the approved npm authentication helper. The helper uses a temporary npm configuration and runs the package's `prepublishOnly` gate. Verify the registry version, `latest` tag, tarball, integrity, and publication time before pushing the tag. Do not republish an existing version or substitute credentials after an authentication failure.
6. Push the tag to trigger `.github/workflows/release.yml`. It checks annotated-tag identity, ancestry on `main`, package version, successful push CI, and npm publication. It runs the local gates again, downloads the published npm archive, verifies its SHA-512 integrity, compares every packaged file with a fresh package built from the tag, and creates a GitHub Release with the archive and `SHA256SUMS`. Release notes come from the exact changelog section and include npm and proof links. Only the built-in GitHub token is needed; npm credentials stay in the local publication step.
7. Wait for the release workflow to finish. Download the GitHub assets, verify `SHA256SUMS`, and compare the archive with npm's integrity. Install the package in a scratch directory and verify `inngest --version` and `--help`.
8. Reopen an empty `## [Unreleased]` section above the finalized release, review and commit it as `chore: open X.Y.Z unreleased` for the next patch, and push or merge it. Leave the checkout clean on synchronized `main` and remove task branches and generated build output.

If npm publication succeeds but the tag workflow fails, preserve the version and tag. Fix or rerun the workflow after diagnosing the failure; never move a published tag or publish different bytes under the same npm version.
