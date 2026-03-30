# Flow Model (`x-openapi-flow`)

Each operation may have a block like this:

```yaml
x-openapi-flow:
  version: "1.0"
  id: create-order-flow
  current_state: CREATED
  terminal: false
  transitions:
    - transition_id: order-created-to-confirmed
      from_state: CREATED
      target_state: CONFIRMED
      trigger_type: synchronous
      decision_rule: confirmOrder:response.200.body.status == 'confirmed'
      operation_role: mutate
      transition_priority: 10
      next_operation_id: confirmOrder
      prerequisite_operation_ids:
        - createOrder
      prerequisite_field_refs:
        - createOrder:response.201.body.id
      propagated_field_refs:
        - createOrder:request.body.customer_id
      evidence_refs:
        - confirmOrder:response.200.body.status
      failure_paths:
        - reason: Order rejected
          target_state: REJECTED
          next_operation_id: getOrder
      compensation_operation_id: cancelOrder
      async_contract:
        timeout_ms: 60000
        max_retries: 3
        backoff: exponential
```

## Core fields

- `version`: contract version (current: `1.0`)
- `id`: unique step identifier
- `current_state`: state represented by the operation
- `transitions[]`: allowed transitions from the current state
- `transitions[].next_operation_id` (optional): operationId usually called next
- `transitions[].prerequisite_operation_ids` (optional): operationIds expected before a transition
- `transitions[].prerequisite_field_refs` (optional): required field references before transition
- `transitions[].propagated_field_refs` (optional): field references reused in downstream flows

AI clarity optional fields (v1.1 draft):

- `terminal`: explicitly marks a terminal operation
- `transitions[].transition_id`: stable transition identifier for deterministic reasoning
- `transitions[].from_state`: explicit transition source state
- `transitions[].decision_rule`: machine-readable transition condition
- `transitions[].operation_role`: role hint (`mutate`, `read`, `callback`, `async-worker`)
- `transitions[].transition_priority`: tie-break when multiple transitions are valid
- `transitions[].evidence_refs`: fields that prove transition completion
- `transitions[].failure_paths[]`: explicit non-happy-path transitions
- `transitions[].compensation_operation_id`: rollback/compensation operationId
- `transitions[].async_contract`: timeout/retry/backoff metadata for async transitions

Field reference format:

- `operationId:request.body.field`
- `operationId:request.path.paramName`
- `operationId:response.<status>.body.field`

## Validated rules (summary)

- Required schema fields
- Orphan states
- Initial and terminal states
- Unreachable states
- Cycles
- Duplicate transitions
- States without path to a terminal state

## Profiles

- `core`: schema + orphan checks
- `relaxed`: advanced checks as warnings
- `strict`: advanced checks as errors

## See also

- [Sidecar Contract](Sidecar-Contract.md)

## Mermaid Graph with Operation Guidance

When you run `x-openapi-flow graph`, Mermaid edges include labels from:

- `next_operation_id`
- `prerequisite_operation_ids`

![Guided graph example](https://raw.githubusercontent.com/tiago-marques/x-openapi-flow/main/docs/assets/x-openapi-flow-overview.png)
