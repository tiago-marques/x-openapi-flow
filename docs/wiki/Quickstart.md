# Quickstart

## 1) Initialize sidecar

With your existing OpenAPI file:

```bash
npx x-openapi-flow init openapi.yaml
```

This creates/synchronizes `{context}-openapi-flow.(json|yaml)`.

## 2) Edit flows

Edit the sidecar and fill `x-openapi-flow` blocks per operation.

For full sidecar contract details (all fields, required/optional, examples), see:

- [Sidecar Contract](Sidecar-Contract)

## 3) Apply to OpenAPI

```bash
npx x-openapi-flow apply openapi.yaml
```

## 4) Optional validate

```bash
npx x-openapi-flow validate openapi.yaml --profile strict
```

## 5) Optional graph

```bash
npx x-openapi-flow graph openapi.yaml --format mermaid
```

## Complete examples

For complete real-world scenarios (valid OpenAPI + multiple operations), see:

- [Real-World Complete Examples](Real-Examples)
