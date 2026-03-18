# Changelog

All notable changes to this project are documented in this file.

## Unreleased

## 1.5.0 - 2026-03-18

### Added
- Introduced runtime guard runtime components for stateful API lifecycle enforcement, including `runtime-guard` core modules for Express and Fastify.
- Added reusable runtime primitives and adapters: `openapi-state-machine-adapter`, `state-machine-engine`, and centralized `error-codes`.
- Added runtime-focused automated coverage with new tests for runtime guard, state machine engine, and OpenAPI state machine adapter.
- Added complete runtime guard runnable examples under `example/runtime-guard/` for Express, Fastify, and a minimal order flow.
- Added new reference docs for Runtime Guard, OpenAPI State Machine Adapter, and State Machine Engine in the wiki.

### Changed
- Updated CLI and validator flow to support runtime guard and state-machine-oriented validation pathways.
- Expanded and aligned documentation across root README and wiki pages (Quickstart, CLI Reference, FAQ, Sidecar Contract, and integration testing guidance).
- Refined adapter test support with a dedicated flow test adapter and updated flow output adapter plumbing.

## 1.4.4 - 2026-03-18

### Changed
- Standardized example assets and commands from `swagger.*` naming to `openapi.*` naming across `example/` projects.
- Updated example scripts, READMEs, ignore rules, and integration tests to use `openapi.json`, `openapi.flow.json`, and `openapi.x.*` paths.
- Kept CLI compatibility and legacy behavior for `swagger.*` naming in command discovery and compatibility tests.

## 1.4.3 - 2026-03-18

### Changed
- Replaced the static hero image in the root README with an animated GIF to showcase the tool in action.

## 1.4.2 - 2026-03-18

### Changed
- Added direct anchor links in the root README from the value summary section to the matching in-page sections for Swagger UI, Redoc, CLI commands, Mermaid lifecycle diagrams, SDK generation, Postman, Insomnia, and AI Sidecar Authoring.
- Expanded AI Sidecar Authoring documentation with recommended workflows, a realistic sidecar example, prompt patterns, review guidance, and common AI authoring mistakes.

## 1.4.1 - 2026-03-18

### Changed
- Updated README headline section: renamed "What You Get" to "What This Enables" with clearer benefit descriptions.
- Moved download milestone banner to top of README (after badges).
- Updated download count from 1,300+ to 1,400+ in the first 3 weeks.

## 1.4.0 - 2026-03-17

### Added
- Dedicated TypeScript SDK runnable example project under `example/sdk/typescript` with apply/validate/generate/build scripts.
- New Redoc plugin test coverage in `x-openapi-flow/tests/plugins/redoc-plugin.test.js`.
- Swagger UI example now includes sidecar fallback apply helper (`example/swagger-ui/scripts/apply-with-fallback.js`).

### Changed
- Wiki information architecture reorganized into thematic sections:
	- `docs/wiki/getting-started`
	- `docs/wiki/reference`
	- `docs/wiki/integrations`
	- `docs/wiki/engineering`
	- `docs/wiki/releases`
- Root docs navigation (`README.md`, `docs/index.md`, `docs/wiki/Home.md`) aligned with the new wiki structure.
- `llm.txt` updated with current sidecar authoring workflow (`analyze`/`diff`/`apply`/`validate`/`lint`) and `request.path` field-ref support.
- Swagger UI example `apply` flow now auto-selects sidecar from local `swagger.x.*` and falls back to `examples/swagger.x.yaml|json`.

### Fixed
- Redoc lifecycle graph edge labels no longer overlap arrows by applying Mermaid edge label styling consistently.
- Postman adapter generation improved with:
	- request body examples from schema/examples,
	- journey names with operation path context,
	- prerequisite rule sets with OR semantics,
	- robust response identifier extraction (`id`/`*_id`) and safer JSON parsing in scripts.
- Insomnia adapter generation improved with:
	- journey grouping by lifecycle,
	- richer operation descriptions (`current_state`, prerequisites, next transitions),
	- schema-based request body examples.

## 1.3.4 - 2026-03-16

### Fixed
- npm publish workflow now uses the repository secret mapping actually configured in GitHub Actions (`GH_PACKAGES_TOKEN` for npm publish and `GH_PACKAGES_TOKEN_V2` for GitHub Packages).

## 1.3.3 - 2026-03-16

### Changed
- GitHub Packages publish pipeline consolidated to a single canonical workflow: `.github/workflows/publish-github-packages.yml`.
- npm publish workflow now validates and uses `NPM_TOKEN` (instead of GitHub Packages secrets).
- GitHub Packages install docs now use a generic env var name: `GITHUB_PACKAGES_TOKEN`.
- Root README refreshed with a shorter product-first introduction while preserving adoption, validation, and integration guidance.

## 1.3.2 - 2026-03-16

### Added
- Dedicated example suites by integration focus under `example/`:
	- `openapi-swagger-ui`
	- `redoc`
	- `postman`
	- `insomnia`
- New integration test coverage for all example focuses in `x-openapi-flow/tests/integration/examples.test.js`.
- Per-example npm scripts for apply/validate/generate workflows in Redoc/Postman/Insomnia folders.

### Changed
- Main package folder renamed from `flow-spec` to `x-openapi-flow`.
- Repository paths, workflows, docs, and local package links updated to the new folder naming.
- Swagger UI example moved to `example/openapi-swagger-ui` and documentation references updated.

## 1.3.1 - 2026-03-16

### Added
- New `analyze` CLI command to infer a starter sidecar (`x-openapi-flow`) from OpenAPI operation names and paths.
- `analyze --merge` mode to preserve existing sidecar fields while merging inferred operations.
- Transition confidence scoring in `analyze --format json` under `analysis.transitionConfidence`.
- New `generate-sdk` CLI command (`--lang typescript`) for flow-aware SDK generation from OpenAPI + `x-openapi-flow`.
- TypeScript SDK templates and generator pipeline (parser -> graph -> state machine -> templates -> SDK).
- Generated SDK lifecycle helper (`runFlow`) and exported intermediate model (`flow-model.json`).
- New modular output adapters:
	- `export-doc-flows` (Markdown/JSON lifecycle docs for Redoc/portals)
	- `generate-postman` (flow-oriented Postman collections)
	- `generate-insomnia` (flow-organized Insomnia exports)
- New `generate-redoc` command to produce a Redoc bundle with flow panel (`index.html`, plugin, flow model, spec).

### Changed
- Repository structure reorganized to isolate core from adapters:
  - `x-openapi-flow/lib` now contains only core logic (`validator`, graph checks, SDK generator).
  - visualization/export adapters moved to `x-openapi-flow/adapters` (Swagger UI, Redoc, Postman/Insomnia/doc exporters).
- Tests reorganized into `x-openapi-flow/tests/cli`, `x-openapi-flow/tests/plugins`, and `x-openapi-flow/tests/integration`.
- Swagger UI demo moved to `example-project/examples/swagger-ui` to keep `x-openapi-flow/examples` focused on test/fixture-like API examples.
- Root/package/wiki CLI documentation now includes `analyze`, `generate-sdk`, and output adapter commands.

## 1.3.0 - 2026-02-25

### Added
- UI plugin test suite (`x-openapi-flow/tests/plugin-ui.test.js`) integrated into `npm test`.
- Sidecar positional usage in `apply` (for example: `x-openapi-flow apply examples/order-openapi-flow.yaml`).
- Dedicated wiki page for sidecar schema: `docs/wiki/reference/Sidecar-Contract.md`.

### Changed
- `init` now auto-generates `{context}.flow.(json|yaml)` when missing.
- `init` behavior with existing flow output:
	- interactive mode asks confirmation and creates incremental backups (`.backup-N`) before recreate;
	- non-interactive mode fails with guidance to use `apply`.
- Default scaffold values from `init` now use `operationId` directly for `id` and `current_state`.
- Validator and docs now support `request.path` references (`operationId:request.path.paramName`).
- Swagger UI overview improved:
	- dynamic title from `OpenAPI info.title`;
	- accordion collapsed by default;
	- stable rendering without infinite DOM rewrite;
	- Mermaid syntax hardening and horizontal layout (`direction LR`);
	- better fallback diagnostics with parser error details.
- Removed CI hash guard that blocked updates to `example-project/swagger.json`.

### Fixed
- Mermaid overview parse issues caused by unsafe labels in `stateDiagram-v2`.
- Empty/placeholder overview behavior when flows have no transitions.
- Example project OpenAPI/sidecar alignment for idempotency headers and path parameter dependencies.

## 1.2.3 - 2026-02-25

### Added
- `--in-place` option in `apply` to preserve legacy in-place output behavior when explicitly requested.

### Changed
- `apply` now writes to `{context}.flow.(json|yaml)` by default (for example: `openapi.flow.yaml`, `swagger.flow.json`).
- Swagger UI plugin moved from `x-openapi-flow/examples/swagger-ui/x-openapi-flow-plugin.js` to `x-openapi-flow/lib/swagger-ui/x-openapi-flow-plugin.js`.
- `example-project` now uses `swagger.flow.json` as default applied output with fallback to `swagger.json` in local Swagger UI server.
- Documentation and local scripts updated for `.flow` output convention.

### Fixed
- Swagger UI plugin no longer applies UI enhancements when the loaded spec does not contain `x-openapi-flow` data.

## 1.2.2 - 2026-02-25

### Added
- Sidecar graph support in `graph` command for `{context}-openapi-flow.(json|yaml)` files.
- Swagger UI global Flow Overview (Mermaid-based) while preserving operation-level cards.
- Copilot prompt template in root README for sidecar authoring workflow.

### Changed
- Root and package docs simplified to emphasize minimal adoption flow: `npx x-openapi-flow init` + `npx x-openapi-flow apply`.
- Wiki quickstart updated to sidecar contextual naming and optional validation/graph steps.
- Example sidecar guidance expanded with `prerequisite_field_refs` and `propagated_field_refs` usage.

### Fixed
- Swagger UI plugin global graph rendering stabilized (debounce/guard) to prevent UI stalls.

## 1.2.1 - 2026-02-25

### Added
- `llm.txt` guide for AI-assisted sidecar authoring.
- Copilot-ready documentation section and badge in root README.
- Wiki page: `docs/wiki/engineering/AI-Sidecar-Authoring.md`.
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
	- Local package wiring (`x-openapi-flow: file:../x-openapi-flow`)
- GitHub Packages publish workflow in `.github/workflows/publish-github-packages.yml`.
- Structured `x-openapi-flow` rendering in Swagger UI plugin (metadata, transitions, operation-level graph lines).
- DOM-based fallback enhancer in the Swagger UI plugin for `swagger-ui-express` and other late-load environments.

### Changed
- `x-openapi-flow/examples/swagger-ui/x-openapi-flow-plugin.js` now provides richer native visualization of `x-openapi-flow` content.
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
- Ready-to-run Swagger UI sample page at `x-openapi-flow/examples/swagger-ui/index.html`.

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
