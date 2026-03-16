# x-openapi-flow

![x-openapi-flow logo](https://raw.githubusercontent.com/tiago-marques/x-openapi-flow/main/docs/assets/x-openapi-flow-logo.svg)

CLI and extension contract for documenting and validating resource lifecycle workflows in OpenAPI using `x-openapi-flow`.

## Overview

`x-openapi-flow` validates:

- Extension schema correctness
- Lifecycle graph consistency
- Optional quality checks for transitions and references

It also supports a sidecar workflow (`init` + `apply`) so lifecycle metadata stays preserved when OpenAPI source files are regenerated.

## Installation

```bash
npm install x-openapi-flow
```

Optional mirror on GitHub Packages (default usage remains unscoped on npm):

```bash
npm config set @tiago-marques:registry https://npm.pkg.github.com
npm install @tiago-marques/x-openapi-flow
```

If authentication is required, include this in your `.npmrc`:

```ini
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

Use a GitHub PAT with `read:packages` (install) and `write:packages` (publish).

## Quick Start

```bash
npx x-openapi-flow init
npx x-openapi-flow apply openapi.yaml
```

Optional checks:

```bash
npx x-openapi-flow validate openapi.yaml --profile strict
npx x-openapi-flow lint openapi.yaml
npx x-openapi-flow graph openapi.yaml
```

## CLI Commands

```bash
npx x-openapi-flow help [command]
npx x-openapi-flow --help
npx x-openapi-flow version
npx x-openapi-flow --version
npx x-openapi-flow validate <openapi-file> [--format pretty|json] [--profile core|relaxed|strict] [--strict-quality] [--config path]
npx x-openapi-flow init [--flows path] [--force] [--dry-run]
npx x-openapi-flow apply [openapi-file] [--flows path] [--out path]
npx x-openapi-flow diff [openapi-file] [--flows path] [--format pretty|json]
npx x-openapi-flow lint [openapi-file] [--format pretty|json] [--config path]
npx x-openapi-flow analyze [openapi-file] [--format pretty|json] [--out path] [--merge] [--flows path]
npx x-openapi-flow generate-sdk [openapi-file] --lang typescript [--output path]
npx x-openapi-flow export-doc-flows [openapi-file] [--output path] [--format markdown|json]
npx x-openapi-flow generate-postman [openapi-file] [--output path] [--with-scripts]
npx x-openapi-flow generate-insomnia [openapi-file] [--output path]
npx x-openapi-flow generate-redoc [openapi-file] [--output path]
npx x-openapi-flow graph <openapi-file> [--format mermaid|json]
npx x-openapi-flow doctor [--config path]
npx x-openapi-flow completion [bash|zsh]
```

Helpful additions:

- Command-specific help: `x-openapi-flow <command> --help` (example: `x-openapi-flow validate --help`)
- Verbose troubleshooting: `x-openapi-flow <command> --verbose`
- Shell completion output: `x-openapi-flow completion bash` or `x-openapi-flow completion zsh`

## Output Adapters

`x-openapi-flow` now supports modular output adapters that reuse the same internal flow graph:

- OpenAPI + `x-openapi-flow` -> parser -> graph builder -> adapters
- Adapters: docs (`export-doc-flows`), SDK (`generate-sdk`), Postman (`generate-postman`), Insomnia (`generate-insomnia`)
  and Redoc package (`generate-redoc`)

### Redoc/Docs Adapter (`export-doc-flows`)

```bash
npx x-openapi-flow export-doc-flows openapi.yaml --output ./docs/api-flows.md
npx x-openapi-flow export-doc-flows openapi.yaml --format json --output ./docs/api-flows.json
```

Generates a lifecycle page (or JSON model) with:

- Flow/Lifecycle panel per resource
- Mermaid diagram per resource
- Current state, prerequisites (`prerequisite_operation_ids`), next operations (`next_operation_id`)

### Redoc Package Adapter (`generate-redoc`)

```bash
npx x-openapi-flow generate-redoc openapi.yaml --output ./redoc-flow
```

Generates a ready-to-open Redoc bundle with:

- `index.html` (Redoc + Flow/Lifecycle panel)
- `x-openapi-flow-redoc-plugin.js` (DOM enhancer)
- `flow-model.json` (flow graph model)
- copied OpenAPI spec (`openapi.yaml`/`openapi.json`)

### Postman Adapter (`generate-postman`)

```bash
npx x-openapi-flow generate-postman openapi.yaml --output ./x-openapi-flow.postman_collection.json --with-scripts
```

Generates lifecycle-oriented folders/journeys and optional scripts for:

- prerequisite enforcement before request execution
- propagated operation tracking and ID persistence in collection variables

### Insomnia Adapter (`generate-insomnia`)

```bash
npx x-openapi-flow generate-insomnia openapi.yaml --output ./x-openapi-flow.insomnia.json
```

Generates an Insomnia export organized by resource flow groups and ordered requests.

## SDK Generator (`generate-sdk`)

Generate a flow-aware SDK from OpenAPI + `x-openapi-flow` metadata.

```bash
npx x-openapi-flow generate-sdk openapi.yaml --lang typescript --output ./sdk
```

MVP output (TypeScript):

- `src/resources/<Resource>.ts`: resource client + state classes (`PaymentAuthorized`, `PaymentCaptured`, etc.)
- `src/index.ts`: root `FlowApiClient`
- `src/http-client.ts`: pluggable HTTP client interface and fetch implementation
- `src/flow-helpers.ts`: `runFlow("authorize -> capture")`
- `flow-model.json`: intermediate model `{ resource, operations, prerequisites, nextOperations, states }`

SDK layers (resource-centric):

- Collection/service layer: `api.payments.create()`, `api.payments.retrieve(id)`, `api.payments.list()`
- Resource instance/state layer: objects expose valid lifecycle transitions (`payment.capture()`, etc.)
- Optional lifecycle helper methods at service level (`api.payments.capture(id, params, { autoPrerequisites: true })`)

Pipeline used by the generator:

- OpenAPI -> parser -> flow graph -> state machine -> templates -> SDK
- Reuses lifecycle graph logic from the validator to stay consistent with `validate`, `graph`, and `diff`
- Transition ordering uses `next_operation_id`, `prerequisite_operation_ids`, and state transitions from `x-openapi-flow`

## Flow Analyzer (`analyze`)

Use `analyze` to bootstrap a sidecar from OpenAPI paths/operation names.

```bash
npx x-openapi-flow analyze openapi.yaml --out openapi.x.yaml
npx x-openapi-flow analyze openapi.yaml --format json
npx x-openapi-flow analyze openapi.yaml --merge --flows openapi.x.yaml
```

Notes:

- The output is heuristic and intended as a starting point.
- Inferred states/transitions should be reviewed and adjusted by API/domain owners.
- Default output format is `pretty`; without `--out`, the suggested sidecar is printed to stdout.
- `--merge` merges inferred data into an existing sidecar (default path or `--flows`) while preserving existing operation fields.
- In `json`, inferred transition confidence is available in `analysis.transitionConfidence`.

`diff` now reports field-level changes for operations that already exist in the sidecar.
In `pretty` format, this appears under `Changed details` with changed paths per operation (for example, `current_state` or `transitions[0].target_state`).
In `json` format, this appears in `diff.changedOperationDetails`:

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

### CI usage (`diff` as a gate)

Fail the pipeline when sidecar drift is detected:

```bash
npx x-openapi-flow diff openapi.yaml --format json | node -e '
const fs = require("fs");
const payload = JSON.parse(fs.readFileSync(0, "utf8"));
const diff = payload.diff || {};
const changes = (diff.added || 0) + (diff.removed || 0) + (diff.changed || 0);
if (changes > 0) {
  console.error("x-openapi-flow diff detected changes. Run init/apply and commit sidecar updates.");
  process.exit(1);
}
'
```

This keeps `.x` sidecar data aligned with the OpenAPI source in pull requests.

## Semantic lint (`lint`)

Use `lint` to run semantic checks focused on flow modeling quality.

```bash
npx x-openapi-flow lint openapi.yaml
npx x-openapi-flow lint openapi.yaml --format json
```

MVP semantic rules:

- `next_operation_id_exists`
- `prerequisite_operation_ids_exist`
- `duplicate_transitions`
- `terminal_path` (states without path to terminal)

Disable individual rules with config (`x-openapi-flow.config.json`):

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

## Graph JSON contract (`graph --format json`)

`graph --format json` returns a stable contract for CI/pipeline integrations:

- `format_version`: output contract version (currently `"1.0"`).
- `flowCount`: number of operations with `x-openapi-flow`.
- `nodes`: sorted state names (deterministic order).
- `edges`: sorted transitions by `from`, `to`, `next_operation_id`, and prerequisites.
- `mermaid`: deterministic Mermaid rendering of the same graph.

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
  "mermaid": "stateDiagram-v2\n  state CONFIRMED\n  state CREATED\n  state SHIPPED\n  CONFIRMED --> SHIPPED: next:shipOrder"
}
```

## HTTP Methods Support

`init`, `apply`, and `graph` support all OpenAPI 3 HTTP operation methods:

- `get`
- `put`
- `post`
- `delete`
- `options`
- `head`
- `patch`
- `trace`

## Sidecar Workflow

Behavior summary:

- `init` works on an existing OpenAPI source file in your repository.
- `init` creates/synchronizes `{context}.x.(json|yaml)` as a persistent sidecar for `x-openapi-flow` data.
- If `{context}.flow.(json|yaml)` does not exist, `init` generates it automatically (same merge result as `apply`).
- If `{context}.flow.(json|yaml)` already exists, `init` asks in interactive mode whether to recreate it.
- On confirmation (or with `--force`), `init` creates a sidecar backup as `{context}.x.(json|yaml).backup-N` before regenerating `{context}.flow.(json|yaml)`.
- In non-interactive mode, `init` fails when flow output already exists unless `--force` is provided.
- With `--dry-run`, `init` prints a summary of sidecar/flow behavior without writing files.
- Use `apply` to inject sidecar flows back into regenerated OpenAPI source files.
- If no OpenAPI/Swagger source file exists yet, generate one first with your framework's official tooling.

### Recommended Sequence

```bash
npx x-openapi-flow init
npx x-openapi-flow init --dry-run
# edit {context}.x.(json|yaml)
npx x-openapi-flow diff openapi.yaml
npx x-openapi-flow apply openapi.yaml
```

## Sidecar File Contract (all supported fields)

Sidecar top-level shape:

```yaml
version: "1.0"
operations:
  - operationId: createOrder
    x-openapi-flow:
      version: "1.0"
      id: create-order
      current_state: CREATED
      description: Creates an order and starts its lifecycle
      idempotency:
        header: Idempotency-Key
        required: true
      transitions:
        - target_state: PAID
          trigger_type: synchronous
          condition: Payment approved
          next_operation_id: payOrder
          prerequisite_operation_ids:
            - createOrder
          prerequisite_field_refs:
            - createOrder:request.body.customer_id
          propagated_field_refs:
            - createOrder:response.201.body.order_id
```

Top-level (sidecar document):

- `version` (optional, string): sidecar contract version. Default is `"1.0"`.
- `operations` (optional, array): entries keyed by operation.

Per operation entry:

- `operationId` (recommended, string): target operation identifier in OpenAPI.
- `x-openapi-flow` (object): lifecycle metadata for that operation.
- `key` (optional, legacy): backward-compatibility fallback key used by apply.

`x-openapi-flow` fields:

- Required:
  - `version` (string): currently `"1.0"`.
  - `id` (string): unique flow id.
  - `current_state` (string): state represented by this operation.
- Optional:
  - `description` (string): human-readable purpose.
  - `idempotency` (object):
    - `header` (required, string)
    - `required` (optional, boolean)
  - `transitions` (array of transition objects)

Transition object fields:

- Required:
  - `target_state` (string)
  - `trigger_type` (enum): `synchronous`, `webhook`, `polling`
- Optional:
  - `condition` (string)
  - `next_operation_id` (string)
  - `prerequisite_operation_ids` (array of strings)
  - `prerequisite_field_refs` (array of strings)
  - `propagated_field_refs` (array of strings)

Field refs format:

- `operationId:request.body.field`
- `operationId:request.path.paramName`
- `operationId:response.<status>.body.field`

## Configuration

Create `x-openapi-flow.config.json` in your project directory:

```json
{
  "profile": "strict",
  "format": "pretty",
  "strictQuality": false
}
```

## Compatibility

- OpenAPI input in `.yaml`, `.yml`, and `.json`
- Validation processes OAS content with the `x-openapi-flow` extension

## Transition Guidance Fields

- `next_operation_id`: operationId usually called for the next state transition
- `prerequisite_operation_ids`: operationIds expected before a transition
- `prerequisite_field_refs`: required field refs before transition
- `propagated_field_refs`: field refs used by downstream flows

Field reference format:

- `operationId:request.body.field`
- `operationId:response.<status>.body.field`

## Visualization

### Swagger UI

- UI plugin behavior is covered by tests in `tests/plugins/plugin-ui.test.js`.
- For UI interpretation of `x-openapi-flow`, use `showExtensions: true` with the plugin at `adapters/ui/swagger-ui/x-openapi-flow-plugin.js`.
- A ready HTML example is available at `../example/openapi-swagger-ui/examples/swagger-ui/index.html`.
- The plugin renders a global **Flow Overview** (Mermaid image) near the top of the docs, plus operation-level flow cards.

![Swagger UI integration result](../docs/assets/x-openapi-flow-extension.png)

### Graph Output Example

`x-openapi-flow graph` includes transition guidance labels in Mermaid output when present (`next_operation_id`, `prerequisite_operation_ids`).
The `graph` command accepts both full OpenAPI source files and sidecar files (`{context}.x.(json|yaml)` and legacy `{context}-openapi-flow.(json|yaml)`).

![Guided graph example](../docs/assets/x-openapi-flow-overview.png)

## Repository and Documentation

- Repository: https://github.com/tiago-marques/x-openapi-flow
- Full guide and changelog are available in the root repository.
