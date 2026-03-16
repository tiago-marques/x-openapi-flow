# Insomnia Example

This folder isolates the Insomnia workflow from the UI examples.

## Files

- `swagger.json`: base OpenAPI spec input.
- `swagger.backup.json`: backup copy of the base spec.
- `examples/swagger.x.yaml`: sidecar example with `x-openapi-flow` definitions.
- `x-openapi-flow.insomnia.json` (generated): flow-oriented workspace export.

## Run workflow

```bash
cd /workspaces/x-flow/example/insomnia
npm install
npm run apply
npm run validate
npm run generate
```

## Equivalent direct command

```bash
cd /workspaces/x-flow
npx x-openapi-flow generate-insomnia example/insomnia/swagger.flow.json --output example/insomnia/x-openapi-flow.insomnia.json
```

Import the generated JSON file into Insomnia as a request collection.
