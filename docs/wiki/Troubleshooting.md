# Troubleshooting

This page centralizes common issues and quick fixes.

## `init` fails in non-interactive mode

Symptom:

- `init` fails when `{context}.flow.(json|yaml)` already exists.

Fix:

```bash
npx x-openapi-flow init --force
```

Use `--dry-run` first when needed:

```bash
npx x-openapi-flow init --dry-run
```

## Sidecar not found on `apply` or `diff`

Symptom:

- `Flows sidecar not found` error.

Fix:

- Run `init` once to create sidecar.
- Or pass explicit path:

```bash
npx x-openapi-flow apply openapi.yaml --flows openapi.x.yaml
npx x-openapi-flow diff openapi.yaml --flows openapi.x.yaml
```

Legacy naming (`{context}-openapi-flow.*`) is still accepted.

## Swagger UI shows grouped endpoints as `default`

Symptom:

- Operations appear under `default` group.

Fix:

- Add OpenAPI `tags` and tag operations consistently in your source OpenAPI.

## `validate` fails with schema errors

Symptom:

- Missing required fields like `version`, `id`, or `current_state`.

Fix:

- Ensure each `x-openapi-flow` block has required fields.
- Use [Sidecar Contract](Sidecar-Contract) as source of truth.

## `lint` reports invalid operation references

Symptom:

- Violations in `next_operation_id_exists` or `prerequisite_operation_ids_exist`.

Fix:

- Confirm referenced `operationId` exists in current OpenAPI source file.
- Update references after endpoint renames.

## `lint` reports terminal path issues

Symptom:

- States without path to terminal.

Fix:

- Ensure graph has at least one terminal state.
- Add transitions so all states can eventually reach a terminal state.

## `diff` reports unexpected changed fields

Symptom:

- `Changed details` includes fields you did not intend to modify.

Fix:

- Inspect sidecar entry for the affected `operationId`.
- Compare generated defaults vs explicit values.
- Re-run:

```bash
npx x-openapi-flow diff openapi.yaml --format pretty
npx x-openapi-flow diff openapi.yaml --format json
```

## Need machine-readable diagnostics in CI

Use JSON output:

```bash
npx x-openapi-flow validate openapi.yaml --format json
npx x-openapi-flow lint openapi.yaml --format json
npx x-openapi-flow graph openapi.yaml --format json
```
