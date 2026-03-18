# Runtime Guard (Express + Fastify)

`x-openapi-flow` runtime guard enforces lifecycle transitions at request time.

This is independent from CLI validation and protects production APIs even when CI checks are bypassed.

## What it enforces

For each incoming request:

1. Resolve operation (`operationId` or method + route)
2. Resolve resource id (`params.id` by default or custom resolver)
3. Read current persisted state (`getCurrentState` callback)
4. Allow only if current state can legally reach the operation state
5. Reject invalid transitions with explicit `409` error payload

## Import

```js
const {
  createRuntimeFlowGuard,
  createExpressFlowGuard,
  createFastifyFlowGuard,
} = require("x-openapi-flow/lib/runtime-guard");
```

## Express

```js
const express = require("express");
const { createExpressFlowGuard } = require("x-openapi-flow/lib/runtime-guard");
const openapi = require("./openapi.flow.json");

const app = express();

app.use(
  createExpressFlowGuard({
    openapi,
    async getCurrentState({ resourceId }) {
      if (!resourceId) return null;
      return paymentStore.getState(resourceId);
    },
    resolveResourceId: ({ params }) => params.id || null,
  })
);
```

## Fastify

```js
const fastify = require("fastify")();
const { createFastifyFlowGuard } = require("x-openapi-flow/lib/runtime-guard");
const openapi = require("./openapi.flow.json");

fastify.addHook(
  "preHandler",
  createFastifyFlowGuard({
    openapi,
    async getCurrentState({ resourceId }) {
      if (!resourceId) return null;
      return paymentStore.getState(resourceId);
    },
    resolveResourceId: ({ params }) => params.id || null,
  })
);
```

## Generic core guard

Use this when you need framework-neutral enforcement:

```js
const { createRuntimeFlowGuard } = require("x-openapi-flow/lib/runtime-guard");

const guard = createRuntimeFlowGuard({
  openapi,
  async getCurrentState({ resourceId }) {
    if (!resourceId) return null;
    return paymentStore.getState(resourceId);
  },
});

await guard.enforce({
  method: "POST",
  path: "/payments/pay_123/capture",
  params: { id: "pay_123" },
});
```

## Error contract

Invalid transition returns `409` and payload:

```json
{
  "error": {
    "code": "INVALID_STATE_TRANSITION",
    "message": "Blocked invalid transition for operation 'capturePayment'. Current state 'CREATED' cannot transition to this operation.",
    "operation_id": "capturePayment",
    "current_state": "CREATED",
    "allowed_from_states": ["AUTHORIZED"],
    "resource_id": "pay_123"
  }
}
```

Other runtime guard errors:

- `MISSING_STATE_RESOLVER` (500)
- `MISSING_RESOURCE_ID` (400)
- `UNKNOWN_OPERATION` (500)

## Notes

- Runtime guard is read-only against your state store. Persist transitions in your own service logic.
- Keep OpenAPI + `x-openapi-flow` metadata updated; guard behavior depends on the spec.
- You can allow unknown operations with `allowUnknownOperations: true` if rollout needs to be incremental.
