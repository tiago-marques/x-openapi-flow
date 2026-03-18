# Redoc Example

Use this project to create and test static Redoc documentation from `x-openapi-flow`.

## Preview screenshots

Flow / Lifecycle view rendered with Mermaid overview and lifecycle cards:

![Redoc Flow Lifecycle 1](../../docs/assets/redoc-flow-lifecycle.png)
![Redoc Flow Lifecycle 2](../../docs/assets/redoc-flow-lifecycle-2.png)
![Redoc Flow Lifecycle 3](../../docs/assets/redoc-flow-lifecycle-3.png)

## What this project covers

- Build `openapi.flow.json` from `openapi.json` + sidecar.
- Validate flow-enriched OpenAPI with strict rules.
- Generate static docs in `redoc-flow/`.

## Key files

- `openapi.json`: base OpenAPI input.
- `examples/openapi.x.yaml`: sidecar with `x-openapi-flow` metadata.
- `openapi.flow.json` (generated): merged OpenAPI + flow data.
- `redoc-flow/` (generated): static Redoc package.

## Create flow output

```bash
cd /workspaces/x-flow/example/redoc
npm install
npm run diff
npm run apply
npm run validate
```

## Generate Redoc artifact

```bash
npm run generate
```

## Test Redoc locally

```bash
cd /workspaces/x-flow/example/redoc/redoc-flow
python3 -m http.server 8080
```

Open `http://localhost:8080/index.html` and verify endpoints, Mermaid overview, operation details, and flow metadata rendering.

Use the top menu to switch between `API Reference` and `Flow / Lifecycle`.

Inside `Flow / Lifecycle`, each operation card also exposes shortcuts to the API reference and related next operations.

## Equivalent direct CLI command

```bash
cd /workspaces/x-flow
npx x-openapi-flow generate-redoc example/redoc/openapi.flow.json --output example/redoc/redoc-flow
```
