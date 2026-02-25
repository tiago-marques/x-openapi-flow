# x-openapi-flow Wiki

`x-openapi-flow` is a CLI to validate and maintain resource lifecycle flows in OpenAPI using the `x-openapi-flow` vendor extension.

## What problem it solves

Real APIs change often, and lifecycle state transitions usually stay implicit.
With `x-openapi-flow`, current states and transitions become explicit per operation, with automated validation.

## Key capabilities

- Schema validation for the `x-openapi-flow` extension
- Graph consistency checks (orphans, reachability, cycles, terminal states)
- Validation profiles (`core`, `relaxed`, `strict`)
- Sidecar workflow for regenerated OpenAPI files (`init` + `apply`)
- Graph export (`mermaid`/`json`)
- Swagger UI integration example
- AI-oriented sidecar authoring guidance (`llm.txt`)

## Quick start

```bash
npm install x-openapi-flow
npx x-openapi-flow init openapi.yaml
npx x-openapi-flow validate openapi.yaml --profile strict
```

## Wiki pages

- [Quickstart](Quickstart)
- [CLI Reference](CLI-Reference)
- [Flow Model](Flow-Model)
- [AI Sidecar Authoring](AI-Sidecar-Authoring)
- [Real-World Complete Examples](Real-Examples)
- [Swagger-UI Integration](Swagger-UI-Integration)
- [FAQ](FAQ)
