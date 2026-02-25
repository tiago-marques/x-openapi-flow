# x-openapi-flow v1.3.0

## Summary

This release improves sidecar workflow safety, Swagger UI overview UX, and CLI ergonomics.

## Highlights

- `init` now auto-generates `{context}.flow.(json|yaml)` when it does not exist.
- If flow output already exists:
  - interactive mode asks before recreation and creates backup files (`.backup-N`);
  - non-interactive mode fails and guides users to run `apply`.
- `apply` now accepts a sidecar path as positional argument:
  - `x-openapi-flow apply examples/order-openapi-flow.yaml`
- Default scaffold values now use `operationId` directly for `id` and `current_state`.
- Validator now supports path parameter field references:
  - `operationId:request.path.paramName`

## Swagger UI Overview Improvements

- Dynamic title using `info.title`:
  - `{API Title} — Flow Overview (x-openapi-flow)`
- Overview is now collapsed by default (accordion).
- Mermaid rendering stability improvements:
  - safe state IDs and labels;
  - horizontal layout (`direction LR`);
  - no infinite DOM rewrite in no-transition scenarios;
  - detailed fallback diagnostics when Mermaid parsing fails.

## Quality and Docs

- Added UI plugin automated tests and integrated into package test pipeline.
- Expanded docs for complete sidecar contract and examples.
- Removed CI hash guard that blocked `example-project/swagger.json` updates.

## Recommended Commands

```bash
cd flow-spec
npm test

cd ../example-project
npx x-openapi-flow init
npx x-openapi-flow apply examples/order-openapi-flow.yaml
```
