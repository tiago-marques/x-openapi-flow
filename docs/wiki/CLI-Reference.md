# CLI Reference

## `validate`

Validates schema + graph rules + quality checks.

```bash
npx x-openapi-flow validate <openapi-file> \
  [--format pretty|json] \
  [--profile core|relaxed|strict] \
  [--strict-quality] \
  [--config path]
```

## `init`

Synchronizes OpenAPI with sidecar.

```bash
npx x-openapi-flow init [--flows path] [--force] [--dry-run]
```

- Uses OpenAPI source file auto-discovery (`openapi.yaml`, `openapi.json`, `swagger.yaml`, etc.).
- Run from your OpenAPI project root.
- Creates/synchronizes `{context}.x.(json|yaml)` (legacy `{context}-openapi-flow.(json|yaml)` is still accepted)
- If `{context}.flow.(json|yaml)` already exists, ask for confirmation in interactive mode.
- Use `--force` to skip prompt in non-interactive environments; it backs up the sidecar and recreates `{context}.flow.(json|yaml)`.
- Use `--dry-run` to preview sidecar/flow changes without writing files.
- Supports all OpenAPI 3 HTTP methods: `get`, `put`, `post`, `delete`, `options`, `head`, `patch`, `trace`.

## `apply`

Applies sidecar data to OpenAPI (useful after regeneration).

```bash
npx x-openapi-flow apply [openapi-file] [--flows path] [--out path]
```

Example using the local example sidecar naming:

```bash
npx x-openapi-flow apply swagger.json --flows examples/swagger.x.json
```

## `diff`

Shows what `init` would change in the sidecar (without writing files).

```bash
npx x-openapi-flow diff [openapi-file] [--flows path] [--format pretty|json]
```

- `pretty` includes `Changed details` with field-level paths per changed operation (for example `current_state`, `transitions[0].target_state`).
- `json` includes `diff.changedOperationDetails`, with one item per changed operation:

```json
{
  "diff": {
    "changedOperationDetails": [
      {
        "operationId": "listItems",
        "changedPaths": ["current_state"]
      }
    ]
  }
}
```

CI gate example (fail if drift is detected):

```bash
npx x-openapi-flow diff openapi.yaml --format json | node -e '
const fs = require("fs");
const payload = JSON.parse(fs.readFileSync(0, "utf8"));
const diff = payload.diff || {};
const changes = (diff.added || 0) + (diff.removed || 0) + (diff.changed || 0);
if (changes > 0) process.exit(1);
'
```

## `lint`

Runs semantic flow lint checks.

```bash
npx x-openapi-flow lint [openapi-file] [--format pretty|json] [--config path]
```

- Rules (MVP): `next_operation_id_exists`, `prerequisite_operation_ids_exist`, `duplicate_transitions`, `terminal_path`.
- `json` output is stable for CI parsing (`ok`, `ruleConfig`, `issues`, `summary`).
- Rules can be enabled/disabled in `x-openapi-flow.config.json`:

```json
{
  "lint": {
    "rules": {
      "next_operation_id_exists": true,
      "prerequisite_operation_ids_exist": true,
      "duplicate_transitions": false,
      "terminal_path": true
    }
  }
}
```

## `graph`

Generates state graph:

```bash
npx x-openapi-flow graph <openapi-file> [--format mermaid|json]
```

- `json` output is deterministic for CI parsing.
- Contract fields: `format_version`, `flowCount`, `nodes` (sorted), `edges` (sorted), `mermaid`.

Example:

```json
{
  "format_version": "1.0",
  "flowCount": 3,
  "nodes": ["CONFIRMED", "CREATED", "SHIPPED"],
  "edges": [
    {
      "from": "CONFIRMED",
      "to": "SHIPPED",
      "next_operation_id": "shipOrder",
      "prerequisite_operation_ids": []
    }
  ],
  "mermaid": "stateDiagram-v2\\n  state CONFIRMED\\n  state CREATED\\n  state SHIPPED\\n  CONFIRMED --> SHIPPED: next:shipOrder"
}
```

## `doctor`

Checks environment/configuration:

```bash
npx x-openapi-flow doctor [--config path]
```
