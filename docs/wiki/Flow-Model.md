# Flow Model (`x-openapi-flow`)

Each operation may have a block like this:

```yaml
x-openapi-flow:
  version: "1.0"
  id: create-order-flow
  current_state: CREATED
  transitions:
    - target_state: CONFIRMED
      trigger_type: synchronous
      next_operation_id: confirmOrder
      prerequisite_operation_ids:
        - createOrder
      prerequisite_field_refs:
        - createOrder:response.201.body.id
      propagated_field_refs:
        - createOrder:request.body.customer_id
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

- [Sidecar Contract](Sidecar-Contract)

## Mermaid Graph with Operation Guidance

When you run `x-openapi-flow graph`, Mermaid edges include labels from:

- `next_operation_id`
- `prerequisite_operation_ids`

![Guided graph example](https://raw.githubusercontent.com/tiago-marques/x-openapi-flow/main/docs/assets/x-openapi-flow-overview.png)
