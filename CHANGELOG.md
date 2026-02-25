# Changelog

All notable changes to this project are documented in this file.

## 1.2.1 - 2026-02-25

### Added
- `llm.txt` guide for AI-assisted sidecar authoring.
- Copilot-ready documentation section and badge in root README.
- Wiki page: `docs/wiki/AI-Sidecar-Authoring.md`.
- Sidecar JSON example in `example-project/examples/order-openapi-flow.json`.
- `apply:yaml-example` and `apply:json-example` scripts in `example-project`.

### Changed
- `init` sidecar scaffold now creates complete `x-openapi-flow` placeholders instead of `null`.
- `init` and `apply` now support fallback operationId generation when an operation does not define `operationId`.
- `graph` command now accepts sidecar files (`{context}-openapi-flow.(json|yaml)`) in addition to full OpenAPI files.
- Swagger UI plugin now renders a global Flow Overview (Mermaid image) while keeping operation-level cards.
- `example-project` workflow aligned to sidecar-first usage (`apply` default in ad hoc mode).

### Fixed
- `example-project` default Swagger UI loading behavior hardened for zero-config local startup.

## 1.2.0 - 2026-02-25

### Added
- Local integration playground in `example-project/` with:
	- OpenAPI sample (`openapi.yaml`)
	- Swagger UI server (`server.js`)
	- Local package wiring (`x-openapi-flow: file:../flow-spec`)
- GitHub Packages publish workflow in `.github/workflows/publish-github-packages.yml`.
- Structured `x-openapi-flow` rendering in Swagger UI plugin (metadata, transitions, operation-level graph lines).
- DOM-based fallback enhancer in the Swagger UI plugin for `swagger-ui-express` and other late-load environments.

### Changed
- `flow-spec/examples/swagger-ui/x-openapi-flow-plugin.js` now provides richer native visualization of `x-openapi-flow` content.
- Root and package README files now document GitHub Packages as an optional scoped mirror while keeping unscoped npm usage as the default.

### Fixed
- GitHub Packages publish scope aligned with repository owner namespace (`@tiago-marques`).

## 1.1.3 - 2026-02-25

### Added
- Optional transition operation guidance fields:
	- `next_operation_id`
	- `prerequisite_operation_ids`
- Mermaid graph labels now include transition guidance fields when present.
- Graph image example added to README and wiki docs.

### Changed
- Validator now checks referenced `operationId` values from transition guidance fields and reports missing references in quality checks.
- README and wiki expanded with practical developer UX and complete real-world examples.

## 1.1.2 - 2026-02-25

### Added
- Swagger UI integration example with plugin for rendering `x-openapi-flow` operation details.
- Ready-to-run Swagger UI sample page at `flow-spec/examples/swagger-ui/index.html`.

### Changed
- OpenAPI extension key renamed from `x-flow` to `x-openapi-flow` across validator, CLI sidecar apply flow, tests, fixtures, examples, and docs.
- JSON Schema metadata updated to `x-openapi-flow` naming (`$id`, `title`, and `description` fields).

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
