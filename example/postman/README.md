# Postman Example

This folder isolates the Postman workflow from the UI examples.

## Files

- `swagger.json`: base OpenAPI spec input.
- `swagger.backup.json`: backup copy of the base spec.
- `examples/swagger.x.yaml`: sidecar example with `x-openapi-flow` definitions.
- `x-openapi-flow.postman_collection.json` (generated): flow-oriented collection.

## Run workflow

```bash
cd /workspaces/x-flow/example/postman
npm install
npm run apply
npm run validate
npm run generate
```

## Equivalent direct command

```bash
cd /workspaces/x-flow
npx x-openapi-flow generate-postman example/postman/swagger.flow.json --output example/postman/x-openapi-flow.postman_collection.json --with-scripts
```

Import the generated collection into Postman and set `baseUrl`.
