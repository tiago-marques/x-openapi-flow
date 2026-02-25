# x-openapi-flow v1.2.2

## Summary

This release focuses on stability and developer experience for sidecar-first workflows.

## Highlights

- Added `graph` support for sidecar files (`{context}-openapi-flow.(json|yaml)`), not only full OpenAPI files.
- Added global Flow Overview in Swagger UI (Mermaid-based), while keeping per-operation cards.
- Improved Swagger UI plugin stability to avoid render-loop related stalls.
- Simplified onboarding documentation to the default minimal flow:
  - `npx x-openapi-flow init`
  - `npx x-openapi-flow apply`
- Expanded examples and guidance for advanced transition references (`prerequisite_field_refs`, `propagated_field_refs`).

## Compatibility

- No breaking changes in payload shape.
- Existing sidecar and OpenAPI workflows remain compatible.

## Recommended Usage

```bash
npx x-openapi-flow init
# fill or improve {context}-openapi-flow.(json|yaml)
npx x-openapi-flow apply
```

Optional:

```bash
npx x-openapi-flow validate openapi.yaml --profile strict
```
