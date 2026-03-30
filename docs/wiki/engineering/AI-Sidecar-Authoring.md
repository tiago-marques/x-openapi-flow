# AI Sidecar Authoring

This page explains how to use AI assistants (including GitHub Copilot) to populate sidecar files with `x-openapi-flow` data safely.

## Why this matters

The most complex part of adoption is not generating OpenAPI; it is authoring high-quality lifecycle transitions and references in `{context}.x.(json|yaml)`.

Good AI assistance can accelerate this step. Bad AI assistance usually creates subtle problems: invented `operationId`s, invalid field refs, duplicated transitions, and lifecycle graphs that do not reflect the real API behavior.

## Source of truth

- API shape: OpenAPI file (`openapi.yaml|json` / `swagger.yaml|json`)
- Lifecycle metadata: sidecar (`{context}.x.(json|yaml)`)

Keep these responsibilities separate:

- The base OpenAPI file defines paths, methods, schemas, and operationIds.
- The sidecar defines lifecycle meaning, transitions, prerequisites, and propagated values.
- The generated `.flow` file is the merged output used by docs, SDKs, tests, and adapters.

## Use the LLM guide

Use the repository guide at [llm.txt](../../../llm.txt) as prompt context for your assistant.

It includes:

- Required `x-openapi-flow` fields
- Transition authoring heuristics
- Field reference format rules
- Validation quality checklist

For full schema details, see [Sidecar Contract](../reference/Sidecar-Contract.md).

For the default human workflow around sidecar editing, see [Quickstart](../getting-started/Quickstart.md).

## When AI is a good fit

AI is useful when:

- your OpenAPI already has stable `operationId`s
- resource lifecycles are known by the team, but not yet encoded
- request/response schemas already expose the identifiers needed across steps
- you want a first draft that a human reviewer will validate

AI is a poor fit when:

- the API lifecycle is still being designed
- multiple teams disagree about valid state transitions
- your OpenAPI is incomplete or missing operationIds
- the assistant is allowed to modify the base OpenAPI instead of only the sidecar

## Recommended workflow

```bash
npx x-openapi-flow init
# ask AI to fill {context}.x.(json|yaml) using llm.txt
npx x-openapi-flow diff openapi.yaml --flows openapi.x.yaml --format pretty
npx x-openapi-flow apply openapi.yaml --flows openapi.x.yaml --out openapi.flow.yaml
npx x-openapi-flow validate openapi.flow.yaml --profile strict --strict-quality
npx x-openapi-flow lint openapi.flow.yaml
```

For larger specs, you can optionally bootstrap the sidecar before asking AI to refine it:

```bash
npx x-openapi-flow analyze openapi.yaml --out openapi.x.yaml --merge --flows openapi.x.yaml
```

Recommended review loop:

1. Run `init` once to create or sync the sidecar.
2. Ask the assistant to edit only `{context}.x.(json|yaml)`.
3. Run `diff` to see which operations changed.
4. Run `apply` to generate the merged `.flow` file.
5. Run `validate` and `lint` to catch structural and graph-quality issues.
6. Review the generated flow manually before merging.

## What the assistant should produce

At minimum, each operation entry should contain:

- `operationId`
- `x-openapi-flow.version`
- `x-openapi-flow.id`
- `x-openapi-flow.current_state`
- `x-openapi-flow.transitions`

When available, the assistant should also infer:

- `description`
- `idempotency`
- `next_operation_id`
- `prerequisite_operation_ids`
- `prerequisite_field_refs`
- `propagated_field_refs`

For stronger AI determinism (v1.1 draft, optional), the assistant should add when justified:

- `terminal`
- `transition_id`
- `from_state`
- `decision_rule`
- `operation_role`
- `transition_priority`
- `evidence_refs`
- `failure_paths`
- `compensation_operation_id`
- `async_contract`

## Field reference quick rules

Use references that can be verified from the OpenAPI source:

- `operationId:request.body.field`
- `operationId:request.path.paramName`
- `operationId:response.<status>.body.field`

Examples:

- `createOrder:request.body.customer_id`
- `payOrder:request.path.id`
- `createOrder:response.201.body.order_id`
- `getOrder:response.200.body.status`

Do not invent fields that do not exist in the request or response schemas.

## Example sidecar entry

The example below is representative of the sidecars used in the repository examples:

```yaml
version: "1.0"
operations:
  - operationId: createOrder
    x-openapi-flow:
      version: "1.0"
      id: create-order
      current_state: created
      description: Creates an order and opens the lifecycle in CREATED
      terminal: false
      idempotency:
        header: Idempotency-Key
        required: true
      transitions:
        - transition_id: order-created-to-paid
          from_state: created
          trigger_type: synchronous
          condition: Payment is confirmed
          decision_rule: payOrder:response.200.body.payment_status == 'approved'
          target_state: paid
          next_operation_id: payOrder
          operation_role: mutate
          transition_priority: 10
          prerequisite_operation_ids:
            - createOrder
          prerequisite_field_refs:
            - createOrder:request.body.customer_id
            - createOrder:request.body.amount
          propagated_field_refs:
            - createOrder:response.201.body.order_id
            - createOrder:response.201.body.status
          evidence_refs:
            - payOrder:response.200.body.payment_status
          failure_paths:
            - reason: Payment denied
              target_state: payment_failed
              next_operation_id: getOrder
          compensation_operation_id: cancelOrder
          async_contract:
            timeout_ms: 120000
            max_retries: 5
            backoff: exponential
```

What this example shows:

- the sidecar entry is anchored to a real OpenAPI `operationId`
- `current_state` describes the state represented by the operation
- transitions describe how the lifecycle moves forward
- field refs identify what data must exist and what data is carried into the next step
- `next_operation_id` points to the operation a developer or agent will likely call next
- `decision_rule` and `evidence_refs` reduce ambiguous transition decisions
- `failure_paths` and `compensation_operation_id` make non-happy paths explicit
- `operation_role` and `transition_priority` improve deterministic step ordering

## How to think about transitions

When asking AI to author transitions, instruct it to reason in this order:

1. What state does this operation represent or create?
2. What business event moves the resource to the next state?
3. Is that event synchronous, polling-based, or webhook-driven?
4. Which operation is typically called after this one?
5. Which identifiers or status fields must be present before the transition is valid?
6. Which identifiers need to be propagated forward to keep later calls grounded?
7. If multiple transitions are possible, what priority resolves ties deterministically?
8. Which fields prove the transition happened (evidence), and what are the explicit failure paths?

This usually produces better results than asking for "all flows" in one generic prompt.

## Prompt template (copy/paste)

```text
Use llm.txt from this repository as authoring rules.
Read my OpenAPI file and populate {context}.x.yaml only.
Do not change endpoint paths/methods.
Generate x-openapi-flow for each operationId with coherent states/transitions,
including next_operation_id, prerequisite_field_refs, and propagated_field_refs when applicable.
When ambiguity exists, add transition_id, decision_rule, evidence_refs, and transition_priority.
```

## Prompt patterns that work well

Use narrower prompts when the assistant starts hallucinating or overgeneralizing.

### Prompt for first draft

```text
Use llm.txt from this repository as strict authoring rules.
Read openapi.yaml and populate openapi.x.yaml only.
Do not edit paths, methods, schemas, or operationIds in the base OpenAPI.
For each operationId, add x-openapi-flow with version, id, current_state, description, and transitions.
Only use field refs that exist in the OpenAPI request/response schemas.
If a transition is uncertain, leave it minimal rather than inventing data.
When multiple transitions can fire, set transition_priority and a decision_rule to remove ambiguity.
```

### Prompt for refinement pass

```text
Review my existing openapi.x.yaml.
Keep valid entries unchanged.
Fix only invalid or weak lifecycle metadata.
Verify next_operation_id values point to real operationIds.
Verify prerequisite_field_refs and propagated_field_refs point to real request/response fields.
Remove duplicate transitions and improve descriptions where needed.
Ensure transition_id is stable and evidence_refs exist for critical transitions.
```

### Prompt for a single resource

```text
Focus only on the payment lifecycle.
Read operationIds related to payment creation, authorization, capture, refund, and status lookup.
Populate only those sidecar entries.
Do not modify unrelated operations.
```

## Human review checklist

Review every AI-authored sidecar with the following checks:

- Every `operationId` exists in the base OpenAPI.
- `id` values are stable and meaningful.
- `current_state` values reflect real business states, not HTTP verbs.
- Every `next_operation_id` points to a real next step.
- Field refs map to real request or response fields.
- No transition duplicates the same `target_state` and `trigger_type` without purpose.
- Critical transitions have stable `transition_id` and verifiable `evidence_refs`.
- Competing transitions are disambiguated with `decision_rule` and `transition_priority`.
- Terminal operations intentionally have `transitions: []`.
- Polling transitions use read-model or status endpoints rather than mutating operations.
- Webhook transitions represent external callbacks, not normal synchronous requests.

## Common AI mistakes

### Inventing operationIds

Bad:

```yaml
next_operation_id: capturePayment
```

If `capturePayment` does not exist in the OpenAPI, this is wrong even if it sounds reasonable.

### Reusing the same field ref everywhere

Bad:

```yaml
propagated_field_refs:
  - createOrder:response.200.body.id
```

Only use that ref if the schema actually returns `id` in `response.200.body`.

### Treating read operations as lifecycle mutations

Bad pattern:

- assigning a new business state to a read-only `get*` operation without clear justification

Better pattern:

- use `get*` operations to observe a status during polling transitions

### Encoding HTTP details instead of business meaning

Weak:

```yaml
current_state: POSTED
```

Better:

```yaml
current_state: AUTHORIZED
```

State names should describe lifecycle meaning, not transport details.

## Good sidecar quality signals

- Single coherent lifecycle progression
- Stable and meaningful `id`/`current_state`
- Valid `operationId` references
- Valid request/response field refs
- No duplicate transitions

Additional strong signals:

- At least one clear terminal path exists for the graph.
- Transition conditions are short and business-oriented.
- Polling and webhook transitions are used intentionally, not as fillers.
- The merged `.flow` file is clean under both `validate` and `lint`.

## Validation commands to run every time

```bash
npx x-openapi-flow diff openapi.yaml --flows openapi.x.yaml --format pretty
npx x-openapi-flow apply openapi.yaml --flows openapi.x.yaml --out openapi.flow.yaml
npx x-openapi-flow validate openapi.flow.yaml --profile strict --strict-quality
npx x-openapi-flow lint openapi.flow.yaml
```

If you need machine-readable diagnostics in CI:

```bash
npx x-openapi-flow validate openapi.flow.yaml --format json
npx x-openapi-flow lint openapi.flow.yaml --format json
```

## Related docs

- [Quickstart](../getting-started/Quickstart.md)
- [Adoption Playbook](../getting-started/Adoption-Playbook.md)
- [Sidecar Contract](../reference/Sidecar-Contract.md)
- [Troubleshooting](../reference/Troubleshooting.md)
- [llm.txt](../../../llm.txt)

