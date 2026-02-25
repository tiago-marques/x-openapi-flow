# x-openapi-flow

CLI and extension contract for documenting and validating resource lifecycle workflows in OpenAPI using `x-openapi-flow`.

## Overview

`x-openapi-flow` validates:

- Extension schema correctness
- Lifecycle graph consistency
- Optional quality checks for transitions and references

It also supports a sidecar workflow (`init` + `apply`) to preserve lifecycle metadata when OpenAPI files are regenerated.

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
//npm.pkg.github.com/:_authToken=${GH_PACKAGES_TOKEN}
```

Use a GitHub PAT with `read:packages` (install) and `write:packages` (publish).

## Quick Start

```bash
npx x-openapi-flow init openapi.yaml
npx x-openapi-flow apply openapi.yaml
```

Optional checks:

```bash
npx x-openapi-flow validate openapi.yaml --profile strict
npx x-openapi-flow graph openapi.yaml
```

## CLI Commands

```bash
x-openapi-flow validate <openapi-file> [--format pretty|json] [--profile core|relaxed|strict] [--strict-quality] [--config path]
x-openapi-flow init [openapi-file] [--flows path]
x-openapi-flow apply [openapi-file] [--flows path] [--out path]
x-openapi-flow graph <openapi-file> [--format mermaid|json]
x-openapi-flow doctor [--config path]
```

## Sidecar Workflow

`init` always works on an existing OpenAPI file in your repository.
`init` creates/synchronizes `{context}-openapi-flow.(json|yaml)` as a persistent sidecar for your `x-openapi-flow` data.
When `{context}.flow.(json|yaml)` does not exist yet, `init` also generates it automatically (same merge result as `apply`).
When `{context}.flow.(json|yaml)` already exists, `init` asks in interactive mode whether to recreate it; if confirmed, it creates a backup as `{context}.flow.(json|yaml).backup-N` before regenerating.
In non-interactive mode, `init` fails if flow output already exists and suggests using `apply` to update it.
Use `apply` to inject sidecar flows back into regenerated OpenAPI files.
If no OpenAPI/Swagger file exists yet, generate one first with your framework's official OpenAPI/Swagger tooling.

### Recommended Sequence

```bash
x-openapi-flow init openapi.yaml
# edit {context}-openapi-flow.(json|yaml)
x-openapi-flow apply openapi.yaml
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

- There is no Swagger UI-based automated test in this repo today (tests are CLI-only).
- For UI interpretation of `x-openapi-flow`, use `showExtensions: true` plus the plugin at `lib/swagger-ui/x-openapi-flow-plugin.js`.
- A ready HTML example is available at `examples/swagger-ui/index.html`.
- The plugin renders a global **Flow Overview** (Mermaid image) near the top of the docs, plus operation-level flow cards.

![Swagger UI integration result](../docs/assets/swagger-ui-integration-result-v2.svg)

### Graph Output Example

`x-openapi-flow graph` includes transition guidance labels in Mermaid output when present (`next_operation_id`, `prerequisite_operation_ids`).
The `graph` command accepts both full OpenAPI files and sidecar files (`{context}-openapi-flow.(json|yaml)`).

![Guided graph example](../docs/assets/graph-order-guided.svg)

## Repository and Documentation

- Repository: https://github.com/tiago-marques/x-openapi-flow
- Full guide and changelog are available in the root repository.
