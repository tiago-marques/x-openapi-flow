# x-openapi-flow Wiki

`x-openapi-flow` is an OpenAPI vendor extension and CLI for modeling, documenting, and validating API resource lifecycle workflows.
It adds explicit state-machine metadata (`x-openapi-flow`) to operations and validates both schema and lifecycle graph consistency.

## What problem it solves

Real APIs change often, and lifecycle state transitions usually stay implicit.
With `x-openapi-flow`, current states and transitions become explicit per operation, so teams can validate lifecycle behavior early and avoid integration regressions.

## Key capabilities

- Schema validation for the `x-openapi-flow` extension
- Graph consistency checks (orphans, reachability, cycles, terminal states)
- Validation profiles (`core`, `relaxed`, `strict`)
- Sidecar workflow for regenerated OpenAPI source files (`init` + `apply`)
- Flow bootstrap with `analyze` (`--merge` and confidence scores in JSON output)
- SDK generation (`generate-sdk` for TypeScript)
- Lifecycle documentation export (`export-doc-flows`)
- Graph export (`mermaid`/`json`)
- Integration adapters for Swagger UI, Redoc, Postman, and Insomnia
- AI-oriented sidecar authoring guidance (`llm.txt`)

## Quick start

```bash
npm install x-openapi-flow
npx x-openapi-flow init
npx x-openapi-flow apply openapi.yaml --out openapi.flow.yaml
npx x-openapi-flow validate openapi.flow.yaml --profile strict --strict-quality
```

Sidecar workflow:

- `{context}.x.(json|yaml)`: sidecar source (author/edit this file)
- `{context}.flow.(json|yaml)`: generated OpenAPI output (validate and use this file)

## Wiki pages

### Getting started

- [Quickstart](getting-started/Quickstart.md)
- [Adoption Playbook](getting-started/Adoption-Playbook.md)

### Reference

- [Sidecar Contract](reference/Sidecar-Contract.md)
- [CLI Reference](reference/CLI-Reference.md)
- [Flow Model](reference/Flow-Model.md)
- [Troubleshooting](reference/Troubleshooting.md)
- [FAQ](reference/FAQ.md)

### Integrations

- [Swagger-UI Integration](integrations/Swagger-UI-Integration.md)
- [Redoc Integration](integrations/Redoc-Integration.md)
- [Postman Integration](integrations/Postman-Integration.md)
- [Insomnia Integration](integrations/Insomnia-Integration.md)

### Engineering

- [Adapters Architecture](engineering/Adapters-Architecture.md)
- [Integration Testing](engineering/Integration-Testing.md)
- [AI Sidecar Authoring](engineering/AI-Sidecar-Authoring.md)
- [Real-World Complete Examples](engineering/Real-Examples.md)

### Releases

- [Release Notes and Checklist](releases/)
