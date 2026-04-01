# Release Notes v1.6.4

Date: 2026-04-01

## Highlights

### Swagger UI operation cards are resilient again

The Swagger UI integration now renders the per-endpoint `x-openapi-flow` card even when the raw vendor extension row is not visible in the operation details table.

- The plugin still supports the vendor-extension-row path when it exists.
- It now also falls back to resolving the rendered operation by method + path directly from the loaded spec.
- `showExtensions` remains optional. It is no longer required for the flow card itself.

### Duplicate `operationId` handling is now deterministic

When an input OpenAPI document reuses the same `operationId` across multiple endpoints, flow generation now normalizes those collisions instead of propagating ambiguous ids.

- `init` generates canonical unique operation ids for ambiguous operations.
- `init --suggest-transitions` uses those canonical ids when producing inferred transitions.
- `apply` writes the canonical ids into the generated `openapi.flow.*` output so downstream consumers see unique operation identifiers.

### Duplicate `operationId` diagnostics added to validation and linting

The tool now flags duplicate OpenAPI `operationId`s explicitly before they become a downstream problem.

- `validate --format json` emits structured quality issues with code `XFLOW_W208`.
- `lint --format json` emits dedicated lint issues with code `XFLOW_L309`.

## Validation

- Package version bumped from `1.6.3` to `1.6.4`.
- Full package test suite passed locally via `cd x-openapi-flow && npm test`.
- Added or expanded coverage for:
  - Swagger UI per-endpoint fallback rendering without visible extension rows
  - duplicate `operationId` canonization in `init`
  - duplicate `operationId` canonization in `init --suggest-transitions`
  - canonical `operationId` propagation in `apply`
  - duplicate `operationId` diagnostics in `validate --format json`
  - duplicate `operationId` diagnostics in `lint --format json`