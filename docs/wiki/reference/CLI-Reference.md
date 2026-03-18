# CLI Reference

## Command UX shortcuts

Useful command discovery and shell UX helpers:

```bash
npx x-openapi-flow help [command]
npx x-openapi-flow <command> --help
npx x-openapi-flow version
npx x-openapi-flow --version
npx x-openapi-flow completion [bash|zsh]
```

Global troubleshooting flag:

```bash
npx x-openapi-flow <command> --verbose
```

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
npx x-openapi-flow apply openapi.json --flows examples/openapi.x.json
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

## `analyze`

Infers a starter sidecar from operation naming + path heuristics.

```bash
npx x-openapi-flow analyze [openapi-file] [--format pretty|json] [--out path]

npx x-openapi-flow analyze [openapi-file] [--format pretty|json] [--out path] [--merge] [--flows path]
```

- Use when you need an initial flow draft for a spec that has no `x-openapi-flow` yet.
- `--out` writes the inferred sidecar (`{context}.x.(json|yaml)` recommended).
- Without `--out`, `pretty` prints summary + sidecar YAML to stdout.
- Generated transitions are suggestions and should be reviewed before committing.
- `--merge` preserves existing sidecar values and merges inferred operations/fields.
- `--flows` selects the sidecar file used by `--merge`.
- In `json`, transition confidence scores are reported in `analysis.transitionConfidence`.

## `generate-sdk`

Generates a flow-aware SDK from OpenAPI + `x-openapi-flow` metadata.

```bash
npx x-openapi-flow generate-sdk [openapi-file] --lang typescript [--output path]
```

- MVP currently supports `--lang typescript`.
- Reuses lifecycle graph modeling to keep behavior aligned with `validate`, `graph`, and `diff`.
- Output includes resource classes, state classes, lifecycle helper (`runFlow`) and `flow-model.json`.

## `export-doc-flows`

Exports lifecycle documentation pages/models from `x-openapi-flow`.

```bash
npx x-openapi-flow export-doc-flows [openapi-file] [--output path] [--format markdown|json]
```

- `markdown` generates an API Flows page with Mermaid diagrams and operation-level lifecycle metadata.
- `json` exports the structured flow model for custom doc portals or Redocly-based rendering.

## `generate-postman`

Generates a Postman collection organized by lifecycle journeys.

```bash
npx x-openapi-flow generate-postman [openapi-file] [--output path] [--with-scripts]
```

- Folders are grouped by resource lifecycle.
- `--with-scripts` adds pre-request/test scripts for prerequisite checks and ID propagation.

## `generate-insomnia`

Generates an Insomnia export organized by resource flow groups.

```bash
npx x-openapi-flow generate-insomnia [openapi-file] [--output path]
```

## `generate-redoc`

Generates a Redoc package with lifecycle panel powered by `x-openapi-flow`.

```bash
npx x-openapi-flow generate-redoc [openapi-file] [--output path]
```

- Output includes `index.html`, `x-openapi-flow-redoc-plugin.js`, `flow-model.json`, and copied OpenAPI spec.
- Useful when you want a Redoc experience similar to the Swagger UI plugin flow visualization.

## `doctor`

Checks environment/configuration:

```bash
npx x-openapi-flow doctor [--config path]
```
