# Runtime Guard Example - Express + JSON Persistence

This example demonstrates request-time transition enforcement with Express middleware and simple file persistence.

Flow:

- createOrder sets state CREATED
- payOrder sets state PAID
- shipOrder requires current state PAID
- invalid ship from CREATED is blocked with 409 INVALID_STATE_TRANSITION

Persistence:

- order states are stored in `data/orders.json`
- data survives process restarts

## Setup

```bash
cd /workspaces/x-flow/example/runtime-guard/express-persistence
npm install
npm start
```

Server runs at http://localhost:3120.

## Invalid transition demo (blocked)

```bash
curl -s -X POST http://localhost:3120/orders
curl -i -X POST http://localhost:3120/orders/<id>/ship
```

Expected: 409 with error code `INVALID_STATE_TRANSITION`.

## Valid path

```bash
curl -s -X POST http://localhost:3120/orders/<id>/pay
curl -s -X POST http://localhost:3120/orders/<id>/ship
```

## Restart safety check

1. Create and pay an order.
2. Stop and start server again.
3. Run `GET /orders/<id>`.

State remains persisted in `data/orders.json`.
