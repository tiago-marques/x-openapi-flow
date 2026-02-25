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
```

## Core fields

- `version`: contract version (current: `1.0`)
- `id`: unique step identifier
- `current_state`: state represented by the operation
- `transitions[]`: allowed transitions from the current state

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
