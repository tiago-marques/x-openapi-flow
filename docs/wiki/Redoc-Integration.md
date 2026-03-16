# Redoc Integration

## Goal

Render `x-openapi-flow` lifecycle panels directly alongside Redoc documentation, showing per-resource state diagrams and journey summaries before the standard API reference.

## How it works

Unlike Swagger UI (which accepts a plugin at startup), Redoc does not expose a public plugin API. The integration uses a **generated static package** approach:

1. `x-openapi-flow generate-redoc` reads your OpenAPI file.
2. It builds the intermediate flow model (`flow-model.json`).
3. It copies your spec and the `x-openapi-flow-redoc-plugin.js` panel script into an output folder.
4. It generates a self-contained `index.html` that mounts the flow panel above the Redoc viewer.

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

## What the flow panel shows

The panel is injected above the Redoc viewer via `#x-openapi-flow-panel`. It renders:

- A **state diagram** (Mermaid) per resource lifecycle.
- **Journey summaries** — ordered chains of operations from initial to terminal state.
- Per-operation metadata: current state, prerequisites, next operations.

## Relevant files

| File | Purpose |
|---|---|
| `flow-spec/adapters/ui/redoc/x-openapi-flow-redoc-plugin.js` | Browser-side panel renderer (no external dependencies). |
| `flow-spec/adapters/ui/redoc-adapter.js` | Node.js generator that builds the output package. |

## Tip

Regenerate the package whenever your OpenAPI file changes:

```bash
x-openapi-flow apply openapi.yaml
x-openapi-flow generate-redoc openapi.yaml --output ./redoc-flow
```

## Related

- [Swagger UI Integration](Swagger-UI-Integration.md) — plugin-based integration for Swagger UI.
- [Adapters Architecture](Adapters-Architecture.md) — how the Redoc adapter fits into the adapter layer.
- [CLI Reference](CLI-Reference.md) — `generate-redoc` flags and examples.
