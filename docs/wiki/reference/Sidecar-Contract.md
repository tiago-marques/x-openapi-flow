# Sidecar Contract

This page defines the complete structure of the sidecar file used by `x-openapi-flow`.

## Top-level structure

```yaml
version: "1.0"
operations:
  - operationId: createOrder
    x-openapi-flow:
      version: "1.0"
      id: create-order
      current_state: CREATED
      description: Creates an order and starts the lifecycle
      terminal: false
      idempotency:
        header: Idempotency-Key
        required: true
      transitions:
        - transition_id: order-created-to-paid
          from_state: CREATED
          target_state: PAID
          trigger_type: synchronous
          condition: Payment approved
          decision_rule: payOrder:response.200.body.payment_status == 'approved'
          operation_role: mutate
          transition_priority: 10
          next_operation_id: payOrder
          prerequisite_operation_ids:
            - createOrder
          prerequisite_field_refs:
            - createOrder:request.body.customer_id
          propagated_field_refs:
            - createOrder:response.201.body.order_id
          evidence_refs:
            - payOrder:response.200.body.payment_status
          failure_paths:
            - reason: Payment denied
              target_state: PAYMENT_FAILED
              next_operation_id: getOrder
          compensation_operation_id: cancelOrder
          async_contract:
            timeout_ms: 120000
            max_retries: 5
            backoff: exponential
```

## Resource-oriented DSL (less repetition)

You can also define flows by resource and let `x-openapi-flow` expand them into per-operation `x-openapi-flow` payloads during `apply`/`diff`.

```yaml
version: "1.0"
resources:
  - name: orders
    defaults:
      flow:
        version: "1.0"
        id_prefix: order
      transition:
        trigger_type: synchronous
    states:
      created: CREATED
      paid: PAID
      shipped: SHIPPED
    transitions:
      - from: created
        to: paid
        next_operation_id: payOrder
      - from: paid
        to: shipped
        next_operation_id: shipOrder
    operations:
      - operationId: createOrder
        state: created
      - operationId: payOrder
        state: paid
      - operationId: shipOrder
        state: shipped
```

How expansion works:

- `operations[].state` (or `current_state`) uses aliases from `states`.
- Resource-level `transitions` are inherited by operations sharing the same state.
- `defaults.flow` is merged into each generated `x-openapi-flow` object.
- `defaults.transition` is merged into generated transitions.
- Operation-level `transitions` overrides inherited transitions when explicitly provided.

## Document fields

- `version` (optional, string)
  - Sidecar contract version. Current default: `"1.0"`.
- `operations` (optional, array)
  - List of operation entries that carry `x-openapi-flow` metadata.
- `resources` (optional, array)
  - Resource-oriented DSL block that expands into operation entries (useful to reduce duplication in larger flows).

## Operation entry fields

- `operationId` (recommended, string)
  - Used to map the sidecar entry to an OpenAPI operation.
- `x-openapi-flow` (required to apply, object)
  - Extension payload injected into the target operation.
- `key` (optional, legacy string)
  - Backward-compatible fallback key used in older sidecars.

Resource DSL operation fields (`resources[].operations[]`):

- `operationId` (required, string)
- `state` or `current_state` (required, string)
- `transitions` (optional, array)
  - Overrides inherited resource transitions for that operation.
- `id`, `description`, `idempotency` (optional)
  - Mapped to generated `x-openapi-flow` fields.
- `x-openapi-flow` (optional object)
  - Advanced override merged after defaults.

## x-openapi-flow fields

Required:

- `version` (string)
  - Contract version of the extension. Current value: `"1.0"`.
- `id` (string)
  - Unique identifier for the flow step.
- `current_state` (string)
  - Lifecycle state represented by the operation.

Optional:

- `description` (string)
  - Human-readable explanation for this flow step.
- `idempotency` (object)
  - `header` (required, string): idempotency key header name.
  - `required` (optional, boolean): whether header is mandatory.
- `transitions` (array)
  - List of transitions from `current_state`.
- `terminal` (boolean)
  - Explicitly marks this operation as terminal in the lifecycle.

## Transition fields

Required:

- `target_state` (string)
- `trigger_type` (string enum)
  - Allowed values: `synchronous`, `webhook`, `polling`

Optional:

- `condition` (string)
- `next_operation_id` (string)
- `prerequisite_operation_ids` (array of strings)
- `prerequisite_field_refs` (array of strings)
- `propagated_field_refs` (array of strings)

## AI clarity fields (v1.1 draft, optional)

The fields below are optional and backward compatible. They are intended to improve deterministic orchestration for AI agents.

- `transition_id` (string)
  - Stable transition identifier for traceability, graph reasoning, and test mapping.
- `from_state` (string)
  - Explicit source state when transitions are authored independently from `current_state`.
- `decision_rule` (string)
  - Machine-readable decision condition used to evaluate transition eligibility.
- `operation_role` (string enum)
  - Suggested values: `mutate`, `read`, `callback`, `async-worker`.
- `transition_priority` (number)
  - Tie-breaker when multiple transitions are valid at the same time.
- `compensation_operation_id` (string)
  - Operation used to compensate/rollback failed distributed steps.
- `evidence_refs` (array of strings)
  - Field references that prove a transition happened.
- `failure_paths` (array)
  - Explicit non-happy-path outcomes:
    - `reason` (string)
    - `target_state` (string)
    - `next_operation_id` (optional string)
- `async_contract` (object)
  - Runtime expectations for async transitions:
    - `timeout_ms` (number)
    - `max_retries` (number)
    - `backoff` (string: `fixed` or `exponential`)

## Field reference format

Use one of the following formats:

- `operationId:request.body.field`
- `operationId:request.path.paramName`
- `operationId:response.<status>.body.field`

Examples:

- `createOrder:request.body.customer_id`
- `payOrder:request.path.id`
- `createOrder:response.201.body.order_id`

## Notes

- Keep your base OpenAPI file clean, and store lifecycle metadata in sidecar.
- Run `init` to create/sync sidecar and `apply` to inject flows into regenerated OpenAPI.
- The sidecar can be JSON or YAML.
- The v1.1 draft fields above are optional guidance metadata for AI/runtime orchestration and can coexist with current `1.0` payloads.
