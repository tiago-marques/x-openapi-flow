# Changelog

## 1.1.1 - 2026-02-25

### Changed
- Updated package version to `1.1.1`.
- Published unscoped package as `x-openapi-flow`, enabling direct usage with `npx x-openapi-flow ...`.

## 1.1.0 - 2026-02-25

### Added
- CLI with `validate`, `init`, `graph`, and `doctor` subcommands.
- Validation profiles: `core`, `relaxed`, and `strict`.
- `--strict-quality` flag to turn quality warnings into errors.
- Configuration support via `x-openapi-flow.config.json` (or `--config`).
- Mermaid/JSON graph export through the `graph` command.
- CI workflow example in `.github/workflows/x-openapi-flow-validate.yml`.
- Automated CLI test suite using `node:test`.
- Additional multi-domain examples (`order`, `ticket`) and warning scenarios (`quality-warning`, `non-terminating`).

### Changed
- npm package renamed to `x-openapi-flow`.
- `x-flow` schema now requires `version: "1.0"`.
- Improved schema error messages with fix suggestions.
- README reorganized with quickstart, profiles, and CI integration.

### Notes
- Quality checks are warnings by default; use `--strict-quality` for pipeline enforcement.
