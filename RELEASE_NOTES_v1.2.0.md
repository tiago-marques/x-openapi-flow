# x-openapi-flow v1.2.0

## Summary

This release introduces a complete local playground for testing the library with Swagger UI and improves native Swagger UI rendering of `x-openapi-flow` so extension details are readable and graph-oriented by default.

## Highlights

- Added `example-project/` to test local library changes end-to-end without publishing.
- Improved native Swagger UI plugin rendering with:
  - structured metadata (`version`, `id`, `current_state`)
  - readable transitions list
  - operation-level flow graph lines
- Added DOM-based fallback rendering in plugin to support `swagger-ui-express` and late plugin load scenarios.
- Added GitHub Packages publish workflow as optional mirror channel.

## Package channels

- Default npm package (recommended): `x-openapi-flow`
- Optional GitHub Packages mirror: `@tiago-marques/x-openapi-flow`

## Compatibility

- No breaking schema changes in `x-openapi-flow` payload.
- Existing OpenAPI files remain compatible.

## Quick verify

```bash
cd flow-spec
npm test

cd ../example-project
npm install
npm run validate
npm start
```
