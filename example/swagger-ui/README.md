# Swagger UI Example

Use this project to create and test `x-openapi-flow` output in a local Swagger UI app.

## What this project covers

- Build `swagger.flow.json` from `swagger.json`.
- Validate and inspect flow-enriched OpenAPI.
- Render the result in Swagger UI for visual/manual checks.

## File roles (`.x` vs `.flow`)

- `swagger.x.*`: sidecar source of lifecycle metadata (the authoring/editing file).
- `swagger.flow.*`: generated OpenAPI output with `x-openapi-flow` merged into operations.

In short:

- edit `.x`
- generate `.flow` with `apply`
- validate/use `.flow`

## Key files

- `swagger.json`: base OpenAPI input.
- `swagger.x.json`: sidecar created by `init`.
- `examples/swagger.x.yaml`: sidecar example with full extension coverage.
- `examples/swagger.x.json`: JSON version of the full sidecar example.
- `swagger.flow.json` (generated): merged OpenAPI + flow data used by the UI.

## Setup

```bash
cd /workspaces/x-flow/example/swagger-ui
npm install
```

## Create and validate flow output

```bash
npm run init
npm run diff
npm run apply
npm run validate
```

`npm run apply` now prefers local sidecars (`swagger.x.yaml|yml|json`) and falls back to `examples/swagger.x.yaml|json` when a local sidecar is not present.

Optional checks:

```bash
npm run lint
npm run graph
npm run doctor
```

You can also apply sidecar examples directly:

```bash
npm run apply:yaml-example
npm run apply:json-example
```

## Test in Swagger UI

```bash
npm start
```

Open http://localhost:3000/docs.

The server loads `swagger.flow.json` when available, otherwise falls back to `swagger.json`.
To force a specific file:

```bash
SWAGGER_SPEC_FILE=swagger.json npm start
```

## Development note

This example depends on local `x-openapi-flow` (`file:../../x-openapi-flow`). Re-run `npm install` after CLI changes.
