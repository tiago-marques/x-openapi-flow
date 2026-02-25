# Adoption Playbook

This playbook helps teams adopt `x-openapi-flow` with minimal disruption.

## 1) Local rollout (single service)

1. Generate or refresh your OpenAPI source file (`openapi.yaml` or `swagger.yaml`).
2. Initialize sidecar:

```bash
npx x-openapi-flow init
```

3. Author lifecycle metadata in `{context}.x.(json|yaml)`.
4. Preview and apply changes:

```bash
npx x-openapi-flow diff openapi.yaml --format pretty
npx x-openapi-flow apply openapi.yaml
```

5. Validate before commit:

```bash
npx x-openapi-flow validate openapi.yaml --profile strict
npx x-openapi-flow lint openapi.yaml
```

## 2) CI rollout (quality gates)

Recommended CI sequence:

```bash
npx x-openapi-flow diff openapi.yaml --format json
npx x-openapi-flow apply openapi.yaml --out /tmp/openapi.flow.yaml
npx x-openapi-flow validate /tmp/openapi.flow.yaml --profile strict --strict-quality
npx x-openapi-flow lint /tmp/openapi.flow.yaml --format json
```

Typical policy:

- `diff`: fails when sidecar drift is detected.
- `validate`: enforces schema + graph consistency.
- `lint`: enforces semantic modeling quality.

## 3) PR checks and review policy

For pull requests touching API behavior:

- Require changes in both OpenAPI source and sidecar when lifecycle changes.
- Require `validate` and `lint` jobs to pass.
- Review `diff --format json` output for changed operations and field-level details.
- Prefer small, operation-focused PRs (one lifecycle change per PR when possible).

## 4) Team enablement checklist

- Document ownership of sidecar files (`{context}.x.*`).
- Add `x-openapi-flow` commands to service README.
- Add CI gate to block drift (`diff`).
- Train reviewers to check transitions (`target_state`, `next_operation_id`, prerequisites).
- Keep examples updated for your main domains (orders, payments, refunds).

## 5) First-week success criteria

- No manual edits in generated `.flow` artifacts.
- No drift between OpenAPI and sidecar in main branch.
- All PRs with lifecycle updates pass `validate` + `lint`.
- New team members can execute init → diff → apply → validate in under 10 minutes.
