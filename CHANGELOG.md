# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
