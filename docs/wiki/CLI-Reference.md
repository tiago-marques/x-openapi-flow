# CLI Reference

## `validate`

Valida schema + regras de grafo + qualidade.

```bash
x-openapi-flow validate <openapi-file> \
  [--format pretty|json] \
  [--profile core|relaxed|strict] \
  [--strict-quality] \
  [--config path]
```

## `init`

Sincroniza OpenAPI com sidecar.

```bash
x-openapi-flow init [openapi-file] [--flows path]
```

- Auto-descobre `openapi.yaml`, `openapi.json`, `swagger.yaml`, etc.
- Cria/sincroniza `x-openapi-flow.flows.yaml`

## `apply`

Aplica o sidecar no OpenAPI (útil após regeneração).

```bash
x-openapi-flow apply [openapi-file] [--flows path] [--out path]
```

## `graph`

Gera grafo de estados:

```bash
x-openapi-flow graph <openapi-file> [--format mermaid|json]
```

## `doctor`

Checa ambiente/configuração:

```bash
x-openapi-flow doctor [--config path]
```
