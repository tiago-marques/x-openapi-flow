# Insomnia Integration

## Goal

Generate a flow-aware Insomnia workspace export from your OpenAPI + `x-openapi-flow` spec. Requests are grouped by resource lifecycle into **request groups**, with operations ordered according to the lifecycle state graph, so you can execute them in the correct sequence inside Insomnia.

## Generate the workspace

```bash
x-openapi-flow generate-insomnia openapi.yaml --output ./x-openapi-flow.insomnia.json
```

## Workspace structure

The generated file follows the [Insomnia export format v4](https://docs.insomnia.rest/insomnia/import-export-data):

```
x-openapi-flow Workspace  (workspace)
├── Orders Flow           (request_group)
│   ├── createOrder       (request)
│   ├── confirmOrder      (request)
│   └── shipOrder         (request)
└── Payments Flow         (request_group)
    └── ...
```

Each resource gets a **request group**. Requests inside the group are ordered by lifecycle sequence (initial → terminal state). When multiple journey paths exist, operations are deduplicated and listed in topological order.

The generated workspace provides **guided execution order** (grouping, journey order, and flow descriptions), but does not hard-block runtime execution when prerequisites were not called.

## Export format

The output is a standard Insomnia export v4 JSON:

```json
{
  "_type": "export",
  "__export_format": 4,
  "__export_source": "x-openapi-flow",
  "resources": [
    { "_type": "workspace", "name": "x-openapi-flow Workspace", ... },
    { "_type": "request_group", "name": "Orders Flow", ... },
    { "_type": "request", "name": "createOrder", "method": "POST", "url": "{{ base_url }}/orders", ... }
  ]
}
```

## Base URL

Requests use `{{ base_url }}` as the host. After importing, set the `base_url` environment variable in Insomnia to your server address (e.g. `http://localhost:3000`).

## Import into Insomnia

1. Open Insomnia → **File → Import**.
2. Select the generated `.json` file.
3. Import as **Request Collection**.
4. Create or select an environment and set `base_url`.
5. Run requests in order within each request group.

## Relevant files

| File | Purpose |
|---|---|
| `x-openapi-flow/adapters/collections/insomnia-adapter.js` | Generator that builds the workspace export JSON. |
| `x-openapi-flow/adapters/shared/helpers.js` | Lifecycle sequence walker and URL template helpers. |

## Tip

Regenerate whenever your flows change:

```bash
x-openapi-flow apply openapi.yaml
x-openapi-flow generate-insomnia openapi.yaml --output ./workspace.insomnia.json
```

## Related

- [Postman Integration](Postman-Integration.md) — equivalent collection export for Postman, with lifecycle pre-request/test scripts.
- [Adapters Architecture](../engineering/Adapters-Architecture.md) — how the collections adapter fits into the adapter layer.
- [CLI Reference](../reference/CLI-Reference.md) — `generate-insomnia` flags and examples.
