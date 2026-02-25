# Swagger UI Integration

## Goal

Render `x-openapi-flow` directly in Swagger UI to make per-operation lifecycle state easier to read.

## Ready example in this repository

- `flow-spec/examples/swagger-ui/index.html`
- `flow-spec/lib/swagger-ui/x-openapi-flow-plugin.js`

## Run locally

```bash
cd flow-spec
python3 -m http.server 8080
```

Open:

`http://localhost:8080/examples/swagger-ui/index.html`

## How it works

- `showExtensions: true` keeps vendor extensions visible.
- Custom plugin adds a panel in operation summary with:
  - `version`
  - `current_state`
- Plugin can also render a graph image using:
  - `x-openapi-flow.graph_image_url`, or
  - `window.XOpenApiFlowGraphImageUrl`

## Example result image

![Swagger UI integration result](https://raw.githubusercontent.com/tiago-marques/x-openapi-flow/main/docs/assets/x-openapi-flow-extension.png)

## Tip

After regenerating your OpenAPI file, run `x-openapi-flow apply` before opening Swagger UI.
