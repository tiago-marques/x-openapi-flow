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
x-openapi-flow validate openapi.yaml
x-openapi-flow graph openapi.yaml
x-openapi-flow doctor
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
`init` creates/synchronizes `x-openapi-flow.flows.yaml` as a persistent sidecar for your `x-openapi-flow` data.
Use `apply` to inject sidecar flows back into regenerated OpenAPI files.
If no OpenAPI/Swagger file exists yet, generate one first with your framework's official OpenAPI/Swagger tooling.

### Recommended Sequence

```bash
x-openapi-flow init openapi.yaml
# edit x-openapi-flow.flows.yaml
x-openapi-flow apply openapi.yaml
```

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
- For UI interpretation of `x-openapi-flow`, use `showExtensions: true` plus the example plugin at `examples/swagger-ui/x-openapi-flow-plugin.js`.
- A ready HTML example is available at `examples/swagger-ui/index.html`.

![Swagger UI integration result](../docs/assets/swagger-ui-integration-result-v2.svg)

### Graph Output Example

`x-openapi-flow graph` includes transition guidance labels in Mermaid output when present (`next_operation_id`, `prerequisite_operation_ids`).

![Guided graph example](../docs/assets/graph-order-guided.svg)

## Repository and Documentation

- Repository: https://github.com/tiago-marques/x-openapi-flow
- Full guide and changelog are available in the root repository.
