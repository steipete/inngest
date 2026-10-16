# Releasing

The package is `@steipete/inngest`, with the `inngest` executable. Node.js 20 or newer is required. npm is the install channel; GitHub Releases contain the same verified npm archive and checksums. There are no native binaries, Homebrew formula, or appcast.

Publication runs through [release.yml](.github/workflows/release.yml), using [`openclaw/release-workflows`' npm archetype at `@v1`](https://github.com/openclaw/release-workflows/blob/v1/README.md). It freezes the protected source commit, builds with pnpm 10.34.5 and Node.js 24, verifies the packed CLI on independent x64 and arm64 runners, publishes those exact bytes with npm trusted publishing, verifies registry integrity and provenance, and creates the GitHub Release. Stable versions use `latest`; prereleases use `next`. The runtime minimum remains Node.js 20.

## Publisher prerequisite

The npm package must authorize GitHub Actions trusted publishing from repository `steipete/inngest`, workflow filename `release.yml`. The reusable workflow's filename is not the trusted caller. Configure it through the approved npm-service helper immediately before the first OIDC publication. An unused trust record expires after two days without a successful OIDC publish; a dry run does not activate it. If it expires, delete the expired record and recreate the same repository/workflow relationship immediately before release. No npm token or `NODE_AUTH_TOKEN` secret is used. A successful dry run does not prove that npm has authorized the publisher.

## Prepare and rehearse

1. Start from clean, synchronized `main`. Check current npm versions and dist-tags, tags, and GitHub Releases.
2. Prepare the package version and a dated changelog section in a PR, preserving contributor credit and leaving an empty `## [Unreleased]` section above it. The CLI reads its version from package metadata; the pnpm lockfile has no root version field.
3. Run `pnpm install --frozen-lockfile`, `pnpm check`, and `pnpm test:smoke`. Review and merge the preparation PR. Require successful independent push CI on that exact commit, including all supported Node versions.
4. Dispatch a rehearsal on merged `main` using the prepared version:

   ```bash
   gh workflow run release.yml --ref main -f version=X.Y.Z -F dry_run=true
   ```

The rehearsal validates, builds, packs, installs, and tests without creating a tag, publishing to npm, or creating a GitHub Release. It always checks current protected main even when that version already has a historical tag.

## Publish and verify

Only after explicit release authorization and a successful rehearsal, verify the publisher prerequisite and create an SSH-signed annotated `vX.Y.Z` tag at the prepared commit using the release key authorized in `.github/release-allowed-signers`. The workflow requires and verifies that signature against the policy from the tagged commit. Push that tag to start publication. Do not publish locally first, move an existing tag, or overwrite an npm version.

Wait for the exact workflow run to pass. Verify `npm view @steipete/inngest@X.Y.Z` reports the intended version, dist-tag, tarball, integrity, and publication time. Check the GitHub Release and its changelog body, download its archive and `SHA256SUMS`, and install the archive in a scratch directory to test `inngest --version` and `--help`.

If publication partially succeeds, preserve the version and tag. Follow the shared workflow's immutable-byte recovery contract; an existing npm version is accepted only when its integrity, downloaded bytes, and provenance match. Never rerun a live publication speculatively. Leave the checkout clean on synchronized `main` after closeout.
