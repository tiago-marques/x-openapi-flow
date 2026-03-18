# Runtime Guard Example - Fastify

This example demonstrates request-time transition enforcement with Fastify preHandler hook.

Flow:

- createPayment sets state AUTHORIZED
- capturePayment requires current state AUTHORIZED
- invalid capture is blocked with 409 INVALID_STATE_TRANSITION

## Setup

- cd /workspaces/x-flow/example/runtime-guard/fastify
- npm install
- npm run apply
- npm run validate
- npm start

Server runs at http://localhost:3102.

## Happy path

Create payment:

curl -s -X POST http://localhost:3102/payments \
  -H "content-type: application/json" \
  -d '{"amount":1000,"currency":"USD"}'

Capture payment using returned id:

curl -s -X POST http://localhost:3102/payments/<id>/capture

## Invalid transition demo (blocked)

1. Create a payment and copy the returned id.

2. Force invalid state:

curl -s -X POST http://localhost:3102/debug/payments/<id>/state \
  -H "content-type: application/json" \
  -d '{"state":"CREATED"}'

3. Try capture:

curl -i -X POST http://localhost:3102/payments/<id>/capture

Expected blocked payload:

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

## Files

- openapi.json: base OpenAPI
- examples/openapi.x.yaml: sidecar metadata
- openapi.flow.json: flow-enriched OpenAPI used by runtime guard
- server.js: Fastify API with runtime guard preHandler
