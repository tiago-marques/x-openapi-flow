# CLI Reference

## `validate`

Validates schema + graph rules + quality checks.

```bash
x-openapi-flow validate <openapi-file> \
  [--format pretty|json] \
  [--profile core|relaxed|strict] \
  [--strict-quality] \
  [--config path]
```

## `init`

Synchronizes OpenAPI with sidecar.

```bash
x-openapi-flow init [openapi-file] [--flows path]
```

- Auto-discovers `openapi.yaml`, `openapi.json`, `swagger.yaml`, etc.
- Creates/synchronizes `x-openapi-flow.flows.yaml`

## `apply`

Applies sidecar data to OpenAPI (useful after regeneration).

```bash
x-openapi-flow apply [openapi-file] [--flows path] [--out path]
```

## `graph`

Generates state graph:

```bash
x-openapi-flow graph <openapi-file> [--format mermaid|json]
```

## `doctor`

Checks environment/configuration:

```bash
x-openapi-flow doctor [--config path]
```
