# x-openapi-flow v1.1.1

## Summary

This release finalizes package naming and distribution updates so users can run the CLI directly via:

- `npx x-openapi-flow ...`

## Highlights

- Published unscoped npm package: `x-openapi-flow@1.1.1`.
- Confirmed direct NPX usage without scope.
- Updated documentation and badges to the unscoped package name.

## Notes

- The OpenAPI extension key remains `x-flow`.
- CLI binary remains `x-openapi-flow`.

## Quick verify

```bash
npm view x-openapi-flow@1.1.1 name version
npx --yes x-openapi-flow@latest --help
```
