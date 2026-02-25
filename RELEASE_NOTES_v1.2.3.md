# x-openapi-flow v1.2.3

## Summary

This release standardizes the apply output convention and improves Swagger UI plugin packaging and defaults.

## Highlights

- `apply` now writes to `.flow` output by default:
  - `openapi.yaml` -> `openapi.flow.yaml`
  - `swagger.json` -> `swagger.flow.json`
- Added `--in-place` to preserve legacy behavior when needed.
- Moved Swagger UI plugin from examples to a stable package path:
  - `flow-spec/lib/swagger-ui/x-openapi-flow-plugin.js`
- Updated local example defaults to:
  - base: `swagger.json`
  - sidecar: `swagger-openapi-flow.json`
  - applied output: `swagger.flow.json`
- Swagger UI local server now prefers `swagger.flow.json` with fallback to `swagger.json`.
- Plugin now skips UI enhancement when loaded spec has no `x-openapi-flow` data.

## Compatibility

- Non-breaking for existing users relying on explicit `--out`.
- Legacy in-place behavior remains available via `--in-place`.
- Existing sidecar naming (`{context}-openapi-flow.(json|yaml)`) is unchanged.

## Recommended Usage

```bash
npx x-openapi-flow init openapi.yaml
npx x-openapi-flow apply openapi.yaml
```

Optional legacy mode:

```bash
npx x-openapi-flow apply openapi.yaml --in-place
```
