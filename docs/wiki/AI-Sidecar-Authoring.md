# AI Sidecar Authoring

This page explains how to use AI assistants (including GitHub Copilot) to populate sidecar files with `x-openapi-flow` data safely.

## Why this matters

The most complex part of adoption is not generating OpenAPI; it is authoring high-quality lifecycle transitions and references in `{context}-openapi-flow.(json|yaml)`.

## Source of truth

- API shape: OpenAPI file (`openapi.yaml|json` / `swagger.yaml|json`)
- Lifecycle metadata: sidecar (`{context}-openapi-flow.(json|yaml)`)

## Use the LLM guide

Use the repository guide at `llm.txt` as prompt context for your assistant.

It includes:

- Required `x-openapi-flow` fields
- Transition authoring heuristics
- Field reference format rules
- Validation quality checklist

## Recommended workflow

```bash
npx x-openapi-flow init openapi.yaml
# ask AI to fill {context}-openapi-flow.(json|yaml) using llm.txt
npx x-openapi-flow apply openapi.yaml
npx x-openapi-flow validate openapi.yaml --profile strict
```

## Prompt template (copy/paste)

```text
Use llm.txt from this repository as authoring rules.
Read my OpenAPI file and populate {context}-openapi-flow.yaml only.
Do not change endpoint paths/methods.
Generate x-openapi-flow for each operationId with coherent states/transitions,
including next_operation_id, prerequisite_field_refs, and propagated_field_refs when applicable.
```

## Good sidecar quality signals

- Single coherent lifecycle progression
- Stable and meaningful `id`/`current_state`
- Valid `operationId` references
- Valid request/response field refs
- No duplicate transitions

