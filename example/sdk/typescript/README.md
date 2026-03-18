# SDK Example (TypeScript)

Use this project to create and test a flow-aware TypeScript SDK from `x-openapi-flow`.

## What this project covers

- Build `openapi.flow.json` from `openapi.json` + sidecar.
- Validate flow-enriched OpenAPI with strict rules.
- Generate a TypeScript SDK in `sdk/`.
- Compile and run a minimal sample from `src/sample.ts`.

## Key files

- `openapi.json`: base OpenAPI input.
- `examples/openapi.x.yaml`: sidecar with `x-openapi-flow` metadata.
- `openapi.flow.json` (generated): merged OpenAPI + flow data.
- `sdk/` (generated): flow-aware TypeScript SDK.
- `src/sample.ts`: minimal SDK consumption example.

## Create flow output

```bash
cd /workspaces/x-flow/example/sdk/typescript
npm install
npm run diff
npm run apply
npm run validate
```

## Generate SDK artifact

```bash
npm run generate
```

## Build and run sample

```bash
npm run run:sample
```

If your API is not running at `http://localhost:3000`, update the URL in `src/sample.ts`.

## Equivalent direct CLI command

```bash
cd /workspaces/x-flow
npx x-openapi-flow generate-sdk example/sdk/typescript/openapi.flow.json --lang typescript --output example/sdk/typescript/sdk
```
