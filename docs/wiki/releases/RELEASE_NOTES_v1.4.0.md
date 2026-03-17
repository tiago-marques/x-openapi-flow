# Release Notes v1.4.0

Date: 2026-03-17

## Highlights

- Reorganized project documentation into a cleaner wiki IA with dedicated sections for getting started, reference, integrations, engineering, and releases.
- Updated root docs navigation and links (`README`, docs index, wiki home) to match the new wiki layout.
- Improved Redoc lifecycle visualization by fixing Mermaid edge-label overlap for better readability.
- Improved Postman generation quality:
  - schema/example-based request bodies,
  - clearer journey naming,
  - OR semantics for prerequisite rule sets,
  - robust identifier extraction in scripts.
- Improved Insomnia generation quality with lifecycle journey grouping, richer flow descriptions, and schema-based request body examples.
- Added a runnable TypeScript SDK example project (`example/sdk/typescript`) covering apply/validate/generate/build/sample usage.
- Added Redoc plugin test coverage (`tests/plugins/redoc-plugin.test.js`).
- Hardened Swagger UI example `apply` workflow with sidecar fallback (`swagger.x.*` -> `examples/swagger.x.*`).
- Updated `llm.txt` with the current authoring workflow (`analyze`/`diff`/`apply`/`validate`/`lint`) and `request.path` field-ref support.

## Validation

- Swagger UI example executed and validated end-to-end (`apply` + `validate` + server/UI endpoint checks).
- Wiki links validated after reorganization (no broken internal markdown links).
- Package release documentation synchronized between root README and package README.
