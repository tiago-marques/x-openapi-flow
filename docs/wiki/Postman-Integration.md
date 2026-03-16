# Postman Integration

## Goal

Generate a flow-aware Postman collection from your OpenAPI + `x-openapi-flow` spec. Requests are grouped by resource lifecycle and ordered as **journeys** — chains of operations from initial to terminal state — so you can run them in sequence without manually figuring out the right call order.

## Generate the collection

```bash
x-openapi-flow generate-postman openapi.yaml --output ./x-openapi-flow.postman_collection.json
```

With pre-request and test scripts enabled (default):

```bash
x-openapi-flow generate-postman openapi.yaml --output ./collection.json --with-scripts
```

Without scripts (static requests only):

```bash
x-openapi-flow generate-postman openapi.yaml --output ./collection.json --with-scripts false
```

## Collection structure

```
x-openapi-flow Lifecycle Collection
├── Orders Lifecycle
│   ├── Journey 1
│   │   ├── createOrder
│   │   ├── confirmOrder
│   │   └── shipOrder
│   └── Journey 2
│       └── ...
└── Payments Lifecycle
    └── Journey 1
        └── ...
```

Each resource gets a **folder**. Within it, each lifecycle path through the state graph becomes a **Journey sub-folder** with requests in execution order.

## Collection variables

| Variable | Default | Purpose |
|---|---|---|
| `baseUrl` | `http://localhost:3000` | Base URL for all requests. Change before running. |
| `flowExecutedOps` | `[]` | Tracks which operationIds have been executed (used by lifecycle scripts). |

## Lifecycle scripts (`--with-scripts`)

When scripts are enabled, each request gets two Postman scripts injected automatically:

**Pre-request script** — checks that all prerequisite operations (from `x-openapi-flow.prerequisite_operation_ids`) have already been executed. Throws if any are missing:

```js
const required = ["createOrder"];
const executed = JSON.parse(pm.collectionVariables.get("flowExecutedOps") || "[]");
const missing = required.filter((id) => !executed.includes(id));
if (missing.length > 0) {
  throw new Error("Missing prerequisites for confirmOrder: " + missing.join(", "));
}
```

**Test script** — records the operation as executed and captures the response `id` into a collection variable:

```js
const payload = pm.response.json ? pm.response.json() : {};
if (payload && payload.id) pm.collectionVariables.set("orderId", payload.id);
const executed = JSON.parse(pm.collectionVariables.get("flowExecutedOps") || "[]");
if (!executed.includes("confirmOrder")) executed.push("confirmOrder");
pm.collectionVariables.set("flowExecutedOps", JSON.stringify(executed));
```

## Import into Postman

1. Open Postman → **Import**.
2. Select the generated `.json` file.
3. Update the `baseUrl` collection variable to point to your running server.
4. Run journeys in order using the **Collection Runner**.

## Relevant files

| File | Purpose |
|---|---|
| `x-openapi-flow/adapters/collections/postman-adapter.js` | Generator that builds the collection JSON. |
| `x-openapi-flow/adapters/shared/helpers.js` | Lifecycle sequence walker and URL template helpers. |

## Tip

Regenerate the collection after any change to your flows:

```bash
x-openapi-flow apply openapi.yaml
x-openapi-flow generate-postman openapi.yaml --output ./collection.json
```

## Related

- [Insomnia Integration](Insomnia-Integration.md) — equivalent workspace export for Insomnia.
- [Adapters Architecture](Adapters-Architecture.md) — how the collections adapter fits into the adapter layer.
- [CLI Reference](CLI-Reference.md) — `generate-postman` flags and examples.
