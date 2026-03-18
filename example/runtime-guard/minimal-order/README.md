# Minimal Runtime Block Demo (Orders)

This is the fastest official demo of runtime enforcement.

Goal: prove that an invalid transition is blocked in runtime in less than 5 minutes.

Lifecycle:

- createOrder -> state CREATED
- payOrder -> state PAID
- shipOrder -> state SHIPPED
- Invalid path: shipOrder from CREATED (must be blocked with 409)

## 1) Start the demo

```bash
cd /workspaces/x-flow/example/runtime-guard/minimal-order
npm install
npm start
```

Server: http://localhost:3110

## 2) Create an order

### curl

```bash
curl -s -X POST http://localhost:3110/orders
```

### HTTPie

```bash
http POST :3110/orders
```

Copy the returned id, for example: ord_123

## 3) Try invalid transition (ship before pay)

### curl

```bash
curl -i -X POST http://localhost:3110/orders/<id>/ship
```

### HTTPie

```bash
http -v POST :3110/orders/<id>/ship
```

Expected: 409 with error code INVALID_STATE_TRANSITION.

Example payload:

```json
{
  "error": {
    "code": "INVALID_STATE_TRANSITION",
    "message": "Blocked invalid transition for operation 'shipOrder'. Current state 'CREATED' cannot transition to this operation.",
    "operation_id": "shipOrder",
    "current_state": "CREATED",
    "allowed_from_states": ["PAID"],
    "resource_id": "ord_123"
  }
}
```

## 4) Execute valid path

### curl

```bash
curl -s -X POST http://localhost:3110/orders/<id>/pay
curl -s -X POST http://localhost:3110/orders/<id>/ship
```

### HTTPie

```bash
http POST :3110/orders/<id>/pay
http POST :3110/orders/<id>/ship
```

Now shipping is accepted because state is PAID first.
