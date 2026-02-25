# Quickstart

## 1) Install

```bash
npm install x-openapi-flow
```

or run directly with `npx`:

```bash
npx x-openapi-flow --help
```

## 2) Initialize sidecar

With your existing OpenAPI file:

```bash
npx x-openapi-flow init openapi.yaml
```

This creates/synchronizes `x-openapi-flow.flows.yaml`.

## 3) Edit flows

Edit the sidecar and fill `x-openapi-flow` blocks per operation.

## 4) Re-apply after regenerating OpenAPI

```bash
npx x-openapi-flow apply openapi.yaml
```

## 5) Validate

```bash
npx x-openapi-flow validate openapi.yaml --profile strict
```

## 6) Visualize graph

```bash
npx x-openapi-flow graph openapi.yaml --format mermaid
```

## Complete examples

For complete real-world scenarios (valid OpenAPI + multiple operations), see:

- [Real-World Complete Examples](Real-Examples)
