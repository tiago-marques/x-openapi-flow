# Quickstart

Start with the shortest guided path, then move to full sidecar workflow.

## 0) Fast guided onboarding (recommended)

Generate a runnable demo project automatically:

```bash
npx x-openapi-flow quickstart
cd x-openapi-flow-quickstart
npm install
npm start
```

Optional runtime scaffold:

```bash
npx x-openapi-flow quickstart --runtime fastify
```

Validate runtime block immediately:

```bash
curl -s -X POST http://localhost:3110/orders
curl -i -X POST http://localhost:3110/orders/<id>/ship
```

Expected: `409 INVALID_STATE_TRANSITION`.

You can use `openapi.flow.json` directly at first. The sidecar file can be learned later.

---

Use this flow as the default day-to-day workflow once you're ready:

- edit `{context}.x.(json|yaml)` (sidecar source)
- generate `{context}.flow.(json|yaml)` with `apply`
- validate and use the `.flow` file in docs, tests, and integrations

## 1) Initialize sidecar

With your existing OpenAPI source file:

```bash
npx x-openapi-flow init
# non-interactive recreate when .flow already exists:
npx x-openapi-flow init --force
# preview sidecar/flow changes without writing files:
npx x-openapi-flow init --dry-run
```

This creates/synchronizes `{context}.x.(json|yaml)`.

## 2) Edit flows

Edit the sidecar and fill `x-openapi-flow` blocks per operation.

For full sidecar contract details (all fields, required/optional, examples), see:

- [Sidecar Contract](../reference/Sidecar-Contract.md)

## 3) Preview changes with diff

```bash
# human-friendly summary
npx x-openapi-flow diff openapi.yaml --format pretty

# machine-readable output
npx x-openapi-flow diff openapi.yaml --format json
```

In `pretty`, changed operations include `Changed details` with field-level paths.
In `json`, these details are under `diff.changedOperationDetails`.

## 4) Apply to OpenAPI

```bash
npx x-openapi-flow apply openapi.yaml --out openapi.flow.yaml
```

## 5) Optional validate

```bash
npx x-openapi-flow validate openapi.flow.yaml --profile strict --strict-quality
```

## 6) Optional lint

```bash
npx x-openapi-flow lint openapi.flow.yaml
```

## 7) Optional graph

```bash
npx x-openapi-flow graph openapi.flow.yaml --format mermaid
```

## Complete examples

For complete real-world scenarios (valid OpenAPI + multiple operations), see:

- [Real-World Complete Examples](../engineering/Real-Examples.md)

For rollout strategy and CI/PR policy, see:

- [Adoption Playbook](Adoption-Playbook.md)

For common issues and fixes, see:

- [Troubleshooting](../reference/Troubleshooting.md)
