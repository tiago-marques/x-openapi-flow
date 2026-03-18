# Insomnia Example

Use this project to create and test an Insomnia export from `x-openapi-flow`.

## What this project covers

- Build `openapi.flow.json` from `openapi.json` + sidecar.
- Validate flow-enriched OpenAPI with strict rules.
- Generate `x-openapi-flow.insomnia.json` for Insomnia import.

## Key files

- `openapi.json`: base OpenAPI input.
- `examples/openapi.x.yaml`: sidecar with `x-openapi-flow` metadata.
- `openapi.flow.json` (generated): merged OpenAPI + flow data.
- `x-openapi-flow.insomnia.json` (generated): Insomnia export.

## Create flow output

```bash
cd /workspaces/x-flow/example/insomnia
npm install
npm run diff
npm run apply
npm run validate
```

## Generate Insomnia artifact

```bash
npm run generate
```

## Test in Insomnia

1. Open Insomnia.
2. Import `x-openapi-flow.insomnia.json` from this folder.
3. Inspect requests and flow transitions generated from sidecar data.
4. Run sample requests against your target API environment.

## Equivalent direct CLI command

```bash
cd /workspaces/x-flow
npx x-openapi-flow generate-insomnia example/insomnia/openapi.flow.json --output example/insomnia/x-openapi-flow.insomnia.json
```
