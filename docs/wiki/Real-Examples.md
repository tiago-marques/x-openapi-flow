# Real-World Complete Examples

This page provides complete and realistic OpenAPI examples with `x-openapi-flow`.

## 1) Payments (authorization -> capture)

```yaml
openapi: "3.0.3"
info:
  title: Payment API
  version: "1.0.0"
paths:
  /payments:
    post:
      operationId: createPayment
      x-openapi-flow:
        version: "1.0"
        id: create-payment-flow
        current_state: AUTHORIZED
        transitions:
          - target_state: CAPTURED
            trigger_type: synchronous
            next_operation_id: capturePayment
            prerequisite_field_refs:
              - createPayment:response.201.body.id
            propagated_field_refs:
              - createPayment:request.body.amount
              - createPayment:request.body.currency
      responses:
        "201":
          description: Created

  /payments/{id}/capture:
    post:
      operationId: capturePayment
      x-openapi-flow:
        version: "1.0"
        id: capture-payment-flow
        current_state: CAPTURED
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Captured
```

## 2) Orders (creation -> confirmation -> shipping -> delivery)

```yaml
openapi: "3.0.3"
info:
  title: Order API
  version: "1.0.0"
paths:
  /orders:
    post:
      operationId: createOrder
      x-openapi-flow:
        version: "1.0"
        id: create-order-flow
        current_state: CREATED
        transitions:
          - target_state: CONFIRMED
            trigger_type: synchronous
            next_operation_id: confirmOrder
          - target_state: CANCELLED
            trigger_type: synchronous
            next_operation_id: cancelOrder
      responses:
        "201":
          description: Created

  /orders/{id}/confirm:
    post:
      operationId: confirmOrder
      x-openapi-flow:
        version: "1.0"
        id: confirm-order-flow
        current_state: CONFIRMED
        transitions:
          - target_state: SHIPPED
            trigger_type: webhook
            next_operation_id: shipOrder
            prerequisite_operation_ids:
              - createOrder
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Confirmed

  /orders/{id}/ship:
    post:
      operationId: shipOrder
      x-openapi-flow:
        version: "1.0"
        id: ship-order-flow
        current_state: SHIPPED
        transitions:
          - target_state: DELIVERED
            trigger_type: webhook
            next_operation_id: deliverOrder
            prerequisite_operation_ids:
              - confirmOrder
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Shipped

  /orders/{id}/deliver:
    post:
      operationId: deliverOrder
      x-openapi-flow:
        version: "1.0"
        id: deliver-order-flow
        current_state: DELIVERED
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Delivered
```

## 3) SaaS Subscriptions (trial -> active -> suspended -> cancelled)

```yaml
openapi: "3.0.3"
info:
  title: Subscription API
  version: "1.0.0"
paths:
  /subscriptions:
    post:
      operationId: createSubscription
      x-openapi-flow:
        version: "1.0"
        id: create-subscription-flow
        current_state: TRIAL
        transitions:
          - target_state: ACTIVE
            trigger_type: synchronous
            next_operation_id: activateSubscription
          - target_state: CANCELLED
            trigger_type: synchronous
            next_operation_id: cancelSubscription
      responses:
        "201":
          description: Created

  /subscriptions/{id}/activate:
    post:
      operationId: activateSubscription
      x-openapi-flow:
        version: "1.0"
        id: activate-subscription-flow
        current_state: ACTIVE
        transitions:
          - target_state: SUSPENDED
            trigger_type: webhook
            next_operation_id: suspendSubscription
          - target_state: CANCELLED
            trigger_type: synchronous
            next_operation_id: cancelSubscription
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Active

  /subscriptions/{id}/suspend:
    post:
      operationId: suspendSubscription
      x-openapi-flow:
        version: "1.0"
        id: suspend-subscription-flow
        current_state: SUSPENDED
        transitions:
          - target_state: ACTIVE
            trigger_type: synchronous
            next_operation_id: activateSubscription
          - target_state: CANCELLED
            trigger_type: synchronous
            next_operation_id: cancelSubscription
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Suspended

  /subscriptions/{id}/cancel:
    post:
      operationId: cancelSubscription
      x-openapi-flow:
        version: "1.0"
        id: cancel-subscription-flow
        current_state: CANCELLED
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Cancelled
```

## How to validate any example

```bash
npx x-openapi-flow validate openapi.yaml --profile strict
```

## Mermaid graph example

![Guided graph example](https://raw.githubusercontent.com/tiago-marques/x-openapi-flow/main/docs/assets/graph-order-guided.svg)
