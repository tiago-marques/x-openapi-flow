# Release Notes v1.6.1

Date: 2026-04-01

## Highlights

### Automatic Swagger UI & Redoc detection on `init`

Running `x-openapi-flow init` in a project that already has Swagger UI or Redoc installed now requires zero extra steps:

- **Swagger UI** (`swagger-ui-express`, `swagger-ui-dist`, `@fastify/swagger-ui`, `koa-swagger-ui`, `fastify-swagger-ui`, `express-swagger-ui`) — the flow plugin is automatically copied to the working directory as `x-openapi-flow-plugin.js` and the CLI prints the one-line wiring instruction (`customJs: '/x-openapi-flow-plugin.js'`).
- **Redoc** (`redoc`, `redoc-express`, `redoc-express-middleware`, `express-redoc-html`, `@redocly/redoc`) — a hint to run `x-openapi-flow generate-redoc` is printed so the static flow UI package is created in one step.
- `--dry-run` reports both detections without writing any files.

### React compatibility fix in the Swagger UI plugin

The plugin (`x-openapi-flow-plugin.js`) now resolves React from within the Swagger UI bundle itself (`window.SwaggerUIBundle.React`) rather than requiring it as a global variable in the host project. This eliminates the `React is not defined` error that appeared in projects that do not expose React globally. `window.React` is still used as a fallback for setups that bundle it separately. If neither source is available the plugin degrades gracefully by returning an empty object.

## Validation

- Package version bumped from `1.6.0` to `1.6.1`.
- Package README synchronized from the repository root README before release.
- All existing tests pass. New tests added for:
  - `init` auto-installs the Swagger UI plugin when `swagger-ui-express` is present.
  - `init` prints the Redoc hint when `redoc` is present.
  - `init --dry-run` reports both detections without writing files.
  - `init` emits no UI hints when neither package is present.
  - `XOpenApiFlowPlugin` resolves React from `SwaggerUIBundle.React`.
  - `XOpenApiFlowPlugin` resolves React from `window.React` as fallback.
  - `XOpenApiFlowPlugin` returns `{}` when React is unavailable.
- Release prepared for publication to npm and GitHub Packages via GitHub Release automation.
