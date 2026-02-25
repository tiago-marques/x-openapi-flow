# x-openapi-flow v1.1.2

## Summary

This release finalizes the extension naming migration to `x-openapi-flow` and adds a practical Swagger UI integration example.

## Highlights

- Extension key migration completed:
  - `x-flow` -> `x-openapi-flow`
- Validator, CLI sidecar merge/apply flow, tests, fixtures, examples, and docs are aligned with the new key.
- Swagger UI integration example added:
  - Plugin: `flow-spec/examples/swagger-ui/x-openapi-flow-plugin.js`
  - Demo page: `flow-spec/examples/swagger-ui/index.html`

## Compatibility Notes

- OpenAPI files using `x-flow` must be migrated to `x-openapi-flow` for validation in this version.
- CLI command names remain unchanged (`x-openapi-flow validate|init|apply|graph|doctor`).

## Quick verify

```bash
cd flow-spec
npm test
node bin/x-openapi-flow.js validate examples/payment-api.yaml --profile strict
```
