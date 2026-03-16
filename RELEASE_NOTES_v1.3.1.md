# Release Notes v1.3.1

Date: 2026-03-16

## Highlights

- Added `analyze` command for flow inference and sidecar bootstrap.
- Added `generate-sdk` command (TypeScript) with flow-aware SDK generation.
- Added modular output adapters:
  - `export-doc-flows`
  - `generate-postman`
  - `generate-insomnia`
  - `generate-redoc`
- Reorganized project structure for scalability:
  - core logic isolated in `flow-spec/lib`
  - adapters centralized in `flow-spec/adapters`
  - tests split into `tests/cli`, `tests/plugins`, `tests/integration`
- Added dedicated wiki pages for integrations and adapter architecture:
  - Swagger UI, Redoc, Postman, Insomnia
  - Adapters Architecture
  - Integration Testing

## Validation

- Full test suite passing:
  - CLI: 42 tests
  - UI plugins: 7 tests
  - Integration: 2 tests
  - Smoke: passing
