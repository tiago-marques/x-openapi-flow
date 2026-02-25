# x-openapi-flow v1.1.0

## Summary

This release focuses on developer experience (DX), with a more complete CLI, profile-based validations, configurable quality rules, and stronger CI integration.

## Highlights

- npm publication under the `x-openapi-flow` name.

- New CLI with subcommands:
  - `validate`
  - `init`
  - `graph`
  - `doctor`
- Validation profiles for different strictness levels:
  - `core`
  - `relaxed`
  - `strict`
- `--strict-quality` flag to turn quality warnings into errors (exit code 1).
- File-based configuration support via `x-openapi-flow.config.json` (or `--config`).
- State graph export in Mermaid/JSON.
- Schema error messages with fix suggestions.

## Breaking / Contract Changes

- The `x-openapi-flow` object now requires `version: "1.0"`.

## Quality and Examples

- New multi-domain examples and diagnostics scenarios:
  - `order-api.yaml`
  - `ticket-api.yaml`
  - `quality-warning-api.yaml`
  - `non-terminating-api.yaml`
- Automated CLI test suite using `node:test`.

## CI/CD

- Ready-to-use workflow for automatic validation on pull requests:
  - `.github/workflows/x-openapi-flow-validate.yml`

## How to Validate Locally

```bash
cd flow-spec
npm install
npm test
```

## Reference Files

- `CHANGELOG.md`
- `RELEASE_CHECKLIST.md`
- `README.md`
