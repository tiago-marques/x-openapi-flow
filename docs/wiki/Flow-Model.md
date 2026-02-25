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
```

## Core fields

- `version`: contract version (current: `1.0`)
- `id`: unique step identifier
- `current_state`: state represented by the operation
- `transitions[]`: allowed transitions from the current state
- `transitions[].next_operation_id` (optional): operationId usually called next
- `transitions[].prerequisite_operation_ids` (optional): operationIds expected before a transition

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

## Mermaid Graph with Operation Guidance

When you run `x-openapi-flow graph`, Mermaid edges include labels from:

- `next_operation_id`
- `prerequisite_operation_ids`

![Guided graph example](https://raw.githubusercontent.com/tiago-marques/x-openapi-flow/main/docs/assets/graph-order-guided.svg)
