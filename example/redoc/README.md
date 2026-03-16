# Redoc Example

Use this project to create and test static Redoc documentation from `x-openapi-flow`.

## What this project covers

- Build `swagger.flow.json` from `swagger.json` + sidecar.
- Validate flow-enriched OpenAPI with strict rules.
- Generate static docs in `redoc-flow/`.

## Key files

- `swagger.json`: base OpenAPI input.
- `examples/swagger.x.yaml`: sidecar with `x-openapi-flow` metadata.
- `swagger.flow.json` (generated): merged OpenAPI + flow data.
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

Open `http://localhost:8080/index.html` and verify endpoints, operation details, and flow metadata rendering.

## Equivalent direct CLI command

```bash
cd /workspaces/x-flow
npx x-openapi-flow generate-redoc example/redoc/swagger.flow.json --output example/redoc/redoc-flow
```
