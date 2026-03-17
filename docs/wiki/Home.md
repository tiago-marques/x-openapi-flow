# x-openapi-flow Wiki

`x-openapi-flow` is a CLI to validate and maintain resource lifecycle flows in OpenAPI using the `x-openapi-flow` vendor extension.

## What problem it solves

Real APIs change often, and lifecycle state transitions usually stay implicit.
With `x-openapi-flow`, current states and transitions become explicit per operation, with automated validation.

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
npx x-openapi-flow validate openapi.yaml --profile strict
```

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
