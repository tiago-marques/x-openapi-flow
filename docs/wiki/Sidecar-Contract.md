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
      idempotency:
        header: Idempotency-Key
        required: true
      transitions:
        - target_state: PAID
          trigger_type: synchronous
          condition: Payment approved
          next_operation_id: payOrder
          prerequisite_operation_ids:
            - createOrder
          prerequisite_field_refs:
            - createOrder:request.body.customer_id
          propagated_field_refs:
            - createOrder:response.201.body.order_id
```

## Document fields

- `version` (optional, string)
  - Sidecar contract version. Current default: `"1.0"`.
- `operations` (optional, array)
  - List of operation entries that carry `x-openapi-flow` metadata.

## Operation entry fields

- `operationId` (recommended, string)
  - Used to map the sidecar entry to an OpenAPI operation.
- `x-openapi-flow` (required to apply, object)
  - Extension payload injected into the target operation.
- `key` (optional, legacy string)
  - Backward-compatible fallback key used in older sidecars.

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
