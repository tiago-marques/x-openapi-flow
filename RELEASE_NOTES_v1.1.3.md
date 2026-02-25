# x-openapi-flow v1.1.3

## Summary

This release improves developer workflow guidance and enriches graph output using transition-level API operation references.

## Highlights

- Added optional transition guidance fields:
  - `next_operation_id`
  - `prerequisite_operation_ids`
- Mermaid graph output now includes guidance labels when those fields are provided.
- Validator checks operationId references and reports invalid references in quality checks.
- README and Wiki updated with clearer developer UX and complete real-world examples.

## Compatibility

- New transition fields are optional.
- Existing `x-openapi-flow` payloads continue to work unchanged.

## Quick verify

```bash
cd flow-spec
npm test
node bin/x-openapi-flow.js graph examples/order-api.yaml
```
