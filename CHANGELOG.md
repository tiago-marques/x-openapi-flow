# Changelog

## 1.1.3 - 2026-02-25

### Added
- Optional transition operation guidance fields:
	- `next_operation_id`
	- `prerequisite_operation_ids`
- Mermaid graph labels now include transition guidance fields when present.
- Graph image example added to README and wiki docs.

### Changed
- Validator now checks referenced operationIds from transition guidance fields and reports missing references in quality checks.
- README and wiki expanded with practical developer UX and complete real-world examples.

## 1.1.2 - 2026-02-25

### Added
- Swagger UI integration example with plugin for rendering `x-openapi-flow` operation details.
- Ready-to-run Swagger UI sample page at `flow-spec/examples/swagger-ui/index.html`.

### Changed
- OpenAPI extension key renamed from `x-flow` to `x-openapi-flow` across validator, CLI sidecar apply flow, tests, fixtures, examples, and docs.
- JSON Schema metadata updated to `x-openapi-flow` naming (`$id`, title, descriptions).

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
- `x-openapi-flow` schema now requires `version: "1.0"`.
- Improved schema error messages with fix suggestions.
- README reorganized with quickstart, profiles, and CI integration.

### Notes
- Quality checks are warnings by default; use `--strict-quality` for pipeline enforcement.
