# Redoc Example

This folder isolates the Redoc workflow from the other examples.

## Files

- `swagger.json`: base OpenAPI spec input.
- `swagger.backup.json`: backup copy of the base spec.
- `examples/swagger.x.yaml`: sidecar example with `x-openapi-flow` definitions.
- `redoc-flow/` (generated): output package from `generate-redoc`.

## Run workflow

```bash
cd /workspaces/x-flow/example/redoc
npm install
npm run apply
npm run validate
npm run generate
```

## Equivalent direct command

```bash
cd /workspaces/x-flow
npx x-openapi-flow generate-redoc example/redoc/swagger.flow.json --output example/redoc/redoc-flow
```

## Serve locally

```bash
cd /workspaces/x-flow/example/redoc/redoc-flow
python3 -m http.server 8080
```

Open `http://localhost:8080/index.html`.
