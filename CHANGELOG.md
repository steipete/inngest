# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.4] - 2026-09-13

**Highlights:** Event watches stay active while runs are queued (thanks @devYRPauli), and the CLI now requires Node.js 20 or newer.

### Fixed

- Kept event watches active while runs are queued instead of reporting them complete before execution starts. Thanks @devYRPauli.

### Changed

- Updated the supported runtime to Node.js 20 or newer to match the CLI's runtime dependencies.
- Updated HTTP and validation dependencies, including upstream proxy-bypass and error-reporting fixes.
- Updated Node.js type definitions, Oxlint, and Oxfmt while retaining Node.js 20 support.
- Added a tag-triggered GitHub Release workflow that verifies the published npm archive and attaches it with a SHA-256 checksum.

## [0.10.3] - 2025-09-24

### Fixed

- Derived the CLI version from package metadata so `--version` reports the installed package version.

## [0.10.2] - 2025-09-24

### Changed

- Refactored run lookup and collection helpers, refined run collection typings, and expanded test coverage.

## [0.10.1] - 2025-09-24

### Added

- Support for `Queued` run statuses across validation, filtering, and display.

### Changed

- `list` command now accepts `Queued` in `--status` and colors queued runs cyan in table output.

## [0.10.0] - 2025-09-24

### Added

- Unit tests covering `RunWatcher` behaviour, including completion, timeout, error propagation, and event-run flows.
- Commander-level integration test to ensure the `list` command surfaces next-cursor hints when more runs are available.

### Changed

- `list` command pagination now preserves API cursors, reports availability consistently in both table and JSON output, and replaces the broken cursor hint.
