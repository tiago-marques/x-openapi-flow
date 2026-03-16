# x-openapi-flow Examples

Examples are now organized by integration focus:

- `openapi-swagger-ui/`: local app centered on OpenAPI spec + Swagger UI.
- `redoc/`: Redoc-focused example using `generate-redoc` output.
- `postman/`: Postman-focused example using `generate-postman` output.
- `insomnia/`: Insomnia-focused example using `generate-insomnia` output.

This separation keeps each workflow focused and avoids mixing UI/export concerns in one folder.

## Common workflow

Each example folder follows the same baseline flow:

1. Start with `swagger.json` (base OpenAPI without extension data).
2. Apply sidecar from `examples/swagger.x.yaml` into `swagger.flow.json`.
3. Generate focus-specific output:
	- Swagger UI docs app
	- Redoc package
	- Postman collection
	- Insomnia workspace export

Run commands inside each folder using its local `package.json` scripts.
