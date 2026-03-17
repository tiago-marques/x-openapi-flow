# Redoc Integration

## Goal

Render `x-openapi-flow` lifecycle data in a dedicated section of the generated ReDoc bundle, with menu navigation between the standard API reference and the lifecycle view.

## How it works

Unlike Swagger UI (which accepts a plugin at startup), Redoc does not expose a public plugin API. The integration uses a **generated static package** approach:

1. `x-openapi-flow generate-redoc` reads your OpenAPI file.
2. It builds the intermediate flow model (`flow-model.json`).
3. It copies your spec and the `x-openapi-flow-redoc-plugin.js` panel script into an output folder.
4. It generates a self-contained `index.html` with a small navigation shell that switches between `API Reference` and `Flow / Lifecycle`.

## Generate the Redoc package

```bash
x-openapi-flow generate-redoc openapi.yaml --output ./redoc-flow
```

Output folder contents:

```
redoc-flow/
├── index.html                       ← open this in a browser
├── openapi.yaml                     ← your spec (copied)
├── flow-model.json                  ← intermediate lifecycle model
└── x-openapi-flow-redoc-plugin.js  ← flow panel renderer script
```

## Run locally

```bash
cd redoc-flow
python3 -m http.server 8080
```

Open:

`http://localhost:8080/index.html`

## What the flow section shows

The generated package exposes a dedicated `Flow / Lifecycle` view, rendered into `#x-openapi-flow-panel`. It shows:

- A **Mermaid overview graph** for all operation transitions.
- Per-endpoint lifecycle cards with current state, prerequisites, next operations, and operation-level graph text.
- Action links to jump between lifecycle cards and open the matching endpoint in the API Reference view.

## Relevant files

| File | Purpose |
|---|---|
| `x-openapi-flow/adapters/ui/redoc/x-openapi-flow-redoc-plugin.js` | Browser-side lifecycle renderer and view switch handler. |
| `x-openapi-flow/adapters/ui/redoc-adapter.js` | Node.js generator that builds the navigation shell and output package. |

## Tip

Regenerate the package whenever your OpenAPI file changes:

```bash
x-openapi-flow apply openapi.yaml
x-openapi-flow generate-redoc openapi.yaml --output ./redoc-flow
```

## Related

- [Swagger UI Integration](Swagger-UI-Integration.md) — plugin-based integration for Swagger UI.
- [Adapters Architecture](../engineering/Adapters-Architecture.md) — how the Redoc adapter fits into the adapter layer.
- [CLI Reference](../reference/CLI-Reference.md) — `generate-redoc` flags and examples.
