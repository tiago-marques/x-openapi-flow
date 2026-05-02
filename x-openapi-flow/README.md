<!-- Auto-generated from /README.md via scripts/sync-package-readme.js. Do not edit directly. -->

# OpenAPI describes APIs. x-openapi-flow turns them into executable workflows — for developers and AI agents.

## Define your API workflows in openapi.x.json and execute them without writing custom clients or orchestration logic

![x-openapi-flow logo](https://raw.githubusercontent.com/tiago-marques/x-openapi-flow/main/docs/assets/x-openapi-flow-logo.svg)

[![npm version](https://img.shields.io/npm/v/x-openapi-flow?label=npm%20version)](https://www.npmjs.com/package/x-openapi-flow)
[![npm downloads](https://img.shields.io/npm/dm/x-openapi-flow?label=npm%20downloads)](https://www.npmjs.com/package/x-openapi-flow)
![npm total downloads](https://img.shields.io/npm/dt/x-openapi-flow?style=flat-square)
![node](https://img.shields.io/badge/node-%3E%3D18-339933)
![license](https://img.shields.io/npm/l/x-openapi-flow)
[![CI](https://github.com/tiago-marques/x-openapi-flow/actions/workflows/x-openapi-flow-validate.yml/badge.svg)](https://github.com/tiago-marques/x-openapi-flow/actions/workflows/x-openapi-flow-validate.yml)
[![open issues](https://img.shields.io/github/issues/tiago-marques/x-openapi-flow)](https://github.com/tiago-marques/x-openapi-flow/issues)
[![last commit](https://img.shields.io/github/last-commit/tiago-marques/x-openapi-flow)](https://github.com/tiago-marques/x-openapi-flow/commits/main)
![copilot ready](https://img.shields.io/badge/Copilot-Ready-00BFA5?logo=githubcopilot&logoColor=white)
> 🚀 2,100+ downloads in the first 3 weeks!

## ⚡ Get started in seconds
```
npx x-openapi-flow init --suggest-transitions
```

### This generates an openapi.x.json file where you can declaratively define how your API should be executed — not just described.

> See your API lifecycle come alive from your OpenAPI spec, with one simple command

> Validate, document, and generate flow-aware SDKs automatically.

![x-openapi-flow in action](https://raw.githubusercontent.com/tiago-marques/x-openapi-flow/main/docs/assets/ezgif.com-animated-gif-maker.gif)

## What is this?

### x-openapi-flow extends your OpenAPI specification with a workflow layer.

> openapi.json → describes your API  
> openapi.x.json → describes how to use it (flows)

### Instead of writing imperative code to orchestrate API calls, you define workflows declaratively and run them anywhere.

`x-openapi-flow` adds a **declarative state machine** to your OpenAPI spec.

Model resource lifecycles, enforce valid transitions, and generate flow-aware artifacts for documentation, SDKs, and automation.

## 🚀 Example

> Define stateful workflows and lifecycle transitions directly inside your OpenAPI operations:

```json
{
  "operationId": "createOrder",
  "x-openapi-flow": {
    "version": "1.0",
    "id": "create-order",
    "current_state": "created",
    "description": "Creates an order and starts the lifecycle",
    "transitions": [
      {
        "transition_id": "order-created-to-paid",
        "trigger_type": "synchronous",
        "condition": "Payment is confirmed",
        "decision_rule": "payOrder:response.200.body.payment_status == 'approved'",
        "target_state": "paid",
        "next_operation_id": "payOrder",
        "operation_role": "mutate",
        "prerequisite_operation_ids": ["createOrder"],
        "evidence_refs": [
          "payOrder:response.200.body.payment_status"
        ],
        "propagated_field_refs": [
          "createOrder:response.201.body.order_id"
        ],
        "failure_paths": [
          {
            "reason": "Payment denied",
            "target_state": "payment_failed",
            "next_operation_id": "getOrder"
          }
        ]
      }
    ]
  }
}
```

This flow defines an order lifecycle directly inside your OpenAPI:

* Starts in the `created` state
* Transitions to `paid` when payment is confirmed
* Supports both synchronous and polling-based transitions
* Propagates data between operations automatically
* Can include explicit decision/evidence and failure-path metadata for AI-guided orchestration

Instead of manually orchestrating API calls, the workflow is fully described alongside your API specification.

## Why This Exists

Building APIs is cheap. Building **complex, multi-step APIs that teams actually use correctly** is hard.  

Teams face recurring problems:

- 📄 **Manual documentation is brittle** – OpenAPI specs are static, often out of sync with real workflows  
- 🤖 **AI agents can hallucinate** – LLMs and code-generating agents may produce invalid calls if workflows are unclear or undocumented  
- 🤯 **Workflows are confusing** – multi-step operations are hard to track for humans and AI agents 
- ⚠️ **Invalid calls slip through** – developers make mistakes because lifecycle rules aren’t enforced  
- ⏱️ **Integration slows down** – SDKs, Postman collections, and docs need constant manual updates  
- 🛡️ **Hard to prevent errors in production** – without explicit lifecycle rules, invalid operations can reach live systems, causing outages or inconsistencies  


x-openapi-flow exists to **solve these pains**: it makes lifecycles explicit, validates transitions automatically, and generates flow-aware docs and SDKs — **so teams move faster, make fewer mistakes, and ship confident integrations**.

## What This Enables

Turn your OpenAPI spec into a single source of truth for API behavior:
- Visualize API lifecycles directly in [Swagger UI](#swagger-ui-demo) and [Redoc](#redoc-demo)
- Validate flows and state transitions in [CI pipelines](#cli-commands)
- Generate [lifecycle diagrams automatically](#mermaid-example) from your OpenAPI spec
- Build [SDKs](#sdk-generation) that understand and respect API workflows
- Export [Postman](#postman-demo) and [Insomnia](#insomnia-demo) collections organized by lifecycle
- Create [AI-ready API contracts](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/engineering/AI-Sidecar-Authoring.md) for agentic integrations

## Quick Start (without OpenAPI file)

## Start in 2 Minutes (Online Playground)

Prefer no local setup? Open the minimal runtime-guard demo directly in your browser:

- StackBlitz: https://stackblitz.com/github/tiago-marques/x-openapi-flow/tree/main/example/runtime-guard/minimal-order
- Codespaces (repo): https://github.com/tiago-marques/x-openapi-flow

Once open, run:

```bash
npm install
npm run start
```

Then in another terminal:

```bash
curl -s -X POST http://localhost:3110/orders
curl -i -X POST http://localhost:3110/orders/<id>/ship
```

Expected: `409 INVALID_STATE_TRANSITION`.

Fastest way to see value (guided scaffold):

```bash
npx x-openapi-flow quickstart
cd x-openapi-flow-quickstart
npm install
npm start
```

Optional runtime:

```bash
npx x-openapi-flow quickstart --runtime fastify
```

Then run:

```bash
curl -s -X POST http://localhost:3110/orders
curl -i -X POST http://localhost:3110/orders/<id>/ship
```

Expected: `409 INVALID_STATE_TRANSITION`.

---
### If you already have an OpenAPI file, use the sidecar workflow:




Initialize flow support in your project:

```bash
npx x-openapi-flow init
# optional: infer suggested transitions using naming heuristics
npx x-openapi-flow init --suggest-transitions
```

After regenerating your OpenAPI file, apply and validate the flow (optional):

```bash
npx x-openapi-flow apply openapi.yaml --out openapi.flow.yaml

npx x-openapi-flow validate openapi.flow.yaml --profile strict --strict-quality
```

This will:

- enrich your OpenAPI spec with flow metadata
- validate lifecycle consistency
- catch invalid transitions early

💡 Tip: run this in CI to enforce API workflow correctness

### Less Verbose DSL for Large Flows

For larger APIs, you can define flow rules by resource (with shared transitions/defaults) and reduce duplication in sidecar files.

See: [Sidecar Contract](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/reference/Sidecar-Contract.md)

### GitHub Action (One-Step CI Validation)

Use the official reusable action to validate lifecycle rules in CI with a single step:

```yaml
- name: Validate OpenAPI flow rules
  uses: tiago-marques/x-openapi-flow@v1
  with:
    openapi-file: openapi.flow.yaml
    profile: strict
    strict-quality: "true"
```

Integration guide: [GitHub-Actions-Integration.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/integrations/GitHub-Actions-Integration.md)

<a id="mermaid-example"></a>
### Real Lifecycle Example

Here’s a real-world payment lifecycle represented in x-openapi-flow:

```
CREATED -> AUTHORIZED -> CAPTURED -> REFUNDED
```

Generate a visual graph of the lifecycle:

```bash
npx x-openapi-flow graph openapi.flow.yaml --format mermaid
```

Resulting diagram:

```mermaid
graph TD
CREATED --> AUTHORIZED
AUTHORIZED --> CAPTURED
CAPTURED --> REFUNDED
```

> This visualization makes your API workflow explicit, easy to communicate, and ready for documentation or demos.

<a id="sdk-generation"></a>
## Generate Flow-Aware SDKs

Create a TypeScript SDK that **respects your API’s lifecycle and transition rules**, following best practices seen in leading companies like **Stripe** and **Adyen**:

- **Orchestrator by model**: each resource exposes methods that enforce valid transitions
- **Chainable API calls**: perform sequences naturally and safely

```bash
npx x-openapi-flow generate-sdk openapi.flow.yaml --lang typescript --output ./sdk
```

Example usage:

```ts
const payment = await sdk.payments.create({ amount: 1000 });
await payment.authorize();
await payment.capture();
```

> This SDK guides developers through valid transition paths, following patterns used by market leaders to ensure safe and intuitive integrations.

## Runtime Enforcement (Express + Fastify)

CI validation is important, but production safety needs request-time enforcement.

`x-openapi-flow` now includes an official runtime guard for Node.js that can block invalid state transitions during request handling.

- Works with **Express** and **Fastify**
- Resolves operations by `operationId` (when available) or by method + route
- Reads current resource state using your own persistence callback
- Blocks invalid transitions with explicit `409` error payloads

Install and use directly in your API server:

```js
const {
  createExpressFlowGuard,
  createFastifyFlowGuard,
} = require("x-openapi-flow/lib/runtime-guard");
```

Express example:

```js
const express = require("express");
const { createExpressFlowGuard } = require("x-openapi-flow/lib/runtime-guard");
const openapi = require("./openapi.flow.json");

const app = express();

app.use(
  createExpressFlowGuard({
    openapi,
    async getCurrentState({ resourceId }) {
      if (!resourceId) return null;
      return paymentStore.getState(resourceId); // your DB/service lookup
    },
    resolveResourceId: ({ params }) => params.id || null,
  })
);
```

Fastify example:

```js
const fastify = require("fastify")();
const { createFastifyFlowGuard } = require("x-openapi-flow/lib/runtime-guard");
const openapi = require("./openapi.flow.json");

fastify.addHook(
  "preHandler",
  createFastifyFlowGuard({
    openapi,
    async getCurrentState({ resourceId }) {
      if (!resourceId) return null;
      return paymentStore.getState(resourceId);
    },
    resolveResourceId: ({ params }) => params.id || null,
  })
);
```

Error payload for blocked transition:

```json
{
  "error": {
    "code": "INVALID_STATE_TRANSITION",
    "message": "Blocked invalid transition for operation 'capturePayment'. Current state 'CREATED' cannot transition to this operation.",
    "operation_id": "capturePayment",
    "current_state": "CREATED",
    "allowed_from_states": ["AUTHORIZED"],
    "resource_id": "pay_123"
  }
}
```

More details: [Runtime Guard](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/reference/Runtime-Guard.md)

### Built-in Persistence Adapters

No need to write your own `getCurrentState` from scratch. x-openapi-flow ships four ready-made adapters:

```js
const {
  MemoryAdapter,   // in-process Map — ideal for tests and single-instance dev
  FileAdapter,     // JSON file on disk — great for demos and local servers
  RedisAdapter,    // ioredis-backed — production-ready, requires: npm install ioredis
  GenericSQLAdapter, // any SQL DB (pg, mysql2, knex…) via query callback
} = require("x-openapi-flow/lib/runtime-guard");

// in-memory (testing / local)
const store = new MemoryAdapter();
app.use(createExpressFlowGuard({ openapi, ...store.forGuard() }));

// persist every transition to Redis
const Redis = require("ioredis");
const redisStore = new RedisAdapter({ client: new Redis(), prefix: "orders:" });
app.use(createExpressFlowGuard({ openapi, ...redisStore.forGuard() }));

// call setState after each successful request to keep the state in sync
app.post("/orders/:id/pay", async (req, res) => {
  await redisStore.setState({ resourceId: req.params.id, state: "paid" });
  res.json({ ok: true });
});
```

**GenericSQLAdapter** example with `pg`:

```js
const { Pool } = require("pg");
const pool = new Pool();
const sqlStore = new GenericSQLAdapter({
  query: (sql, params) => pool.query(sql, params).then(r => r.rows),
  dialect: "pg",
});
await sqlStore.ensureTable(); // CREATE TABLE IF NOT EXISTS xflow_state (…)
app.use(createExpressFlowGuard({ openapi, ...sqlStore.forGuard() }));
```

All adapters implement `getCurrentState`, `setState`, `deleteState` and `forGuard()` — a convenience method that returns the exact shape expected by the guard options.

### Observability Hooks (Metrics/Audit)

You can instrument runtime decisions with `onDecision` to feed Prometheus, logs, or tracing.

```js
const { Counter } = require("prom-client");
const { createExpressFlowGuard } = require("x-openapi-flow/lib/runtime-guard");

const flowDecisions = new Counter({
  name: "xflow_runtime_guard_decisions_total",
  help: "Runtime guard decisions by type and operation",
  labelNames: ["decision", "operation_id"],
});

app.use(
  createExpressFlowGuard({
    openapi,
    ...store.forGuard(),
    onDecision(event) {
      flowDecisions.inc({
        decision: event.decision,
        operation_id: event.operationId || "unknown",
      });
    },
  })
);
```

Common decision values include:
- `allowed_transition`
- `allowed_idempotent_state`
- `allowed_initial_state`
- `denied_invalid_transition`
- `denied_missing_resource_id`
- `denied_unknown_operation`
- `skipped_unknown_operation`


Want to see the value immediately? Use the official minimal demo:

- [example/runtime-guard/minimal-order/README.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/example/runtime-guard/minimal-order/README.md)

Run in under 5 minutes:

```bash
cd example/runtime-guard/minimal-order
npm install
npm start
```

Create an order, then try to ship before payment (must return `409 INVALID_STATE_TRANSITION`):

```bash
curl -s -X POST http://localhost:3110/orders
curl -i -X POST http://localhost:3110/orders/<id>/ship
```

HTTPie equivalent:

```bash
http POST :3110/orders
http -v POST :3110/orders/<id>/ship
```

## Programmatic State Machine Engine

Use a reusable deterministic engine independently of CLI and OpenAPI parsing:

```js
const { createStateMachineEngine } = require("x-openapi-flow/lib/state-machine-engine");

const engine = createStateMachineEngine({
  transitions: [
    { from: "CREATED", action: "confirm", to: "CONFIRMED" },
    { from: "CONFIRMED", action: "ship", to: "SHIPPED" },
  ],
});

engine.canTransition("CREATED", "confirm");
engine.getNextState("CREATED", "confirm");
engine.validateFlow({ startState: "CREATED", actions: ["confirm", "ship"] });
```

More details: [State Machine Engine](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/reference/State-Machine-Engine.md)

### OpenAPI to Engine Adapter

Convert `x-openapi-flow` metadata to a pure engine definition:

```js
const { createStateMachineAdapterModel } = require("x-openapi-flow/lib/openapi-state-machine-adapter");
const { createStateMachineEngine } = require("x-openapi-flow/lib/state-machine-engine");

const model = createStateMachineAdapterModel({ openapiPath: "./openapi.flow.yaml" });
const engine = createStateMachineEngine(model.definition);
```

More details: [OpenAPI State Machine Adapter](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/reference/OpenAPI-State-Machine-Adapter.md)

## Who Benefits Most

x-openapi-flow is ideal for teams and organizations that want **clear, enforceable API workflows**:

- **API-first organizations** – maintain a single source of truth for API behavior  
- **Teams building AI agents** – provide AI-friendly contracts and enforce correct API usage, so agents can safely call endpoints in the right order without guessing or violating workflow rules
- **API platform teams** – ensure consistent lifecycle rules across endpoints  
- **Companies with complex API workflows** – reduce errors and ambiguity in multi-step processes  
- **SDK teams** – generate flow-aware SDKs that guide developers  


## Why x-openapi-flow?

See how **x-openapi-flow extends OpenAPI** to make your API workflows explicit, enforceable, and actionable:

| Capability | OpenAPI | x-openapi-flow |
| --- | --- | --- |
| Endpoint contracts | ✅ Yes | ✅ Yes (fully compatible, extended) |
| Lifecycle states | ❌ No | ✅ Yes – define states for each resource |
| Transition validation | ❌ No | ✅ Yes – catch invalid calls before runtime |
| Flow diagrams | ❌ No | ✅ Yes – generate visual lifecycle graphs |
| Usage guidance (next valid actions) | Limited/manual | ✅ Built-in via lifecycle metadata – guides developers and AI agents |

### How does it compare to OpenAPI Workflows (Arazzo) and AsyncAPI?

| Dimension | x-openapi-flow | OpenAPI Workflows (Arazzo) | AsyncAPI |
| --- | --- | --- | --- |
| **Primary focus** | Resource lifecycle states & runtime enforcement | Multi-step API workflows (orchestration scripts) | Event-driven / async messaging APIs |
| **Lifecycle states** | ✅ Explicit states per resource | ❌ No state model | ❌ No state model |
| **Runtime enforcement** | ✅ Express/Fastify middleware (409 on invalid transitions) | ❌ Spec-only, no runtime guard | ❌ Spec-only |
| **SDK generation** | ✅ TypeScript, Kotlin, Python, Go | ❌ No codegen | Limited |
| **Postman / Insomnia export** | ✅ Built-in adapters | ❌ No | ❌ No |
| **AI agent support** | ✅ MCP sidecar + structured sidecar contract | ❌ No | ❌ No |
| **Breaking change detection** | ✅ `diff --breaking-only --fail-on-breaking` | ❌ No | ❌ No |
| **CI validation** | ✅ CLI + GitHub Action | ❌ No official CLI | Limited |
| **OpenAPI compatibility** | ✅ Sidecar extends existing specs | Separate Arazzo spec | Separate AsyncAPI spec |

**In short:** use x-openapi-flow when you need **enforceable, stateful API lifecycles** that go beyond documentation into runtime safety, SDK generation, and AI-ready contracts. Use Arazzo for scripting multi-step HTTP journeys. Use AsyncAPI for documenting event/message-driven systems.

## Integration Demos

Explore how x-openapi-flow integrates with popular API tools, making lifecycles and flows explicit for documentation and testing.

<a id="swagger-ui-demo"></a>
### Swagger UI – Visualize Flows in Your Docs

```bash
cd example/swagger-ui
npm install
npm run apply
npm start
```

![Swagger UI Flow Lifecycle 1](https://raw.githubusercontent.com/tiago-marques/x-openapi-flow/main/docs/assets/swagger-ui-flow-lifecycle.png)
> Lifecycle panel shows valid states and transitions

![Swagger UI Flow Lifecycle 2](https://raw.githubusercontent.com/tiago-marques/x-openapi-flow/main/docs/assets/swagger-ui-flow-lifecycle-2.png)
> Detailed view of transitions per operation

<a id="redoc-demo"></a>
### Redoc – Flow-Aware Documentation

```bash
cd example/redoc
npm install
npm run apply
npm run generate
```

![Redoc Flow Lifecycle 1](https://raw.githubusercontent.com/tiago-marques/x-openapi-flow/main/docs/assets/redoc-flow-lifecycle.png)
![Redoc Flow Lifecycle 2](https://raw.githubusercontent.com/tiago-marques/x-openapi-flow/main/docs/assets/redoc-flow-lifecycle-2.png)
![Redoc Flow Lifecycle 3](https://raw.githubusercontent.com/tiago-marques/x-openapi-flow/main/docs/assets/redoc-flow-lifecycle-3.png)
> Auto-generated lifecycle diagrams make documentation clear and consistent

<a id="postman-demo"></a>
### Postman – Organized API Collections

```bash
cd example/postman
npm install
npm run apply
npm run generate
```

![Postman Flow Lifecycle 1](https://raw.githubusercontent.com/tiago-marques/x-openapi-flow/main/docs/assets/postman-flow-lifecycle.png)
![Postman Flow Lifecycle 2](https://raw.githubusercontent.com/tiago-marques/x-openapi-flow/main/docs/assets/postman-flow-lifecycle-2.png)
> Collections reflect lifecycle order, reducing integration errors

<a id="insomnia-demo"></a>
### Insomnia – Organized API Collections

```bash
cd example/insomnia
npm install
npm run apply
npm run generate
```

![Insomnia Flow Lifecycle 1](https://raw.githubusercontent.com/tiago-marques/x-openapi-flow/main/docs/assets/insomnia-flow-lifecycle.png)
![Insomnia Flow Lifecycle 2](https://raw.githubusercontent.com/tiago-marques/x-openapi-flow/main/docs/assets/insomnia-flow-lifecycle-2.png)
> Requests are pre-organized according to lifecycle transitions

<a id="cli-commands"></a>
## CLI Reference – Common Commands

Use x-openapi-flow from the command line to **manage, validate, visualize, and generate SDKs/docs for your API workflows**.  

### General

```bash
npx x-openapi-flow help [command]         # show help for a specific command

npx x-openapi-flow --help                 # general help

npx x-openapi-flow version                # show version

npx x-openapi-flow doctor [--config path] # check setup and config

npx x-openapi-flow completion [bash|zsh]  # enable shell autocompletion

npx x-openapi-flow quickstart [--dir path] [--runtime express|fastify] [--force] # scaffold runnable onboarding project
```

### Workflow Management

```bash
# initialize flow support
npx x-openapi-flow init [--flows path] [--force] [--dry-run]   

# apply flows to OpenAPI
npx x-openapi-flow apply [openapi-file] [--flows path] [--out path]  

# validate transitions
npx x-openapi-flow validate <openapi-file> [--profile core|relaxed|strict] [--strict-quality] [--semantic]  

# preview sidecar changes
npx x-openapi-flow diff [openapi-file] [--format pretty|json]

# detect breaking flow changes (use in CI to fail PRs)
npx x-openapi-flow diff [openapi-file] --breaking-only --fail-on-breaking
```

### Visualization & Documentation

```bash
# generate lifecycle diagrams
npx x-openapi-flow graph [openapi-file] [--format mermaid|json]   

# generate Redoc docs
npx x-openapi-flow generate-redoc [openapi-file] [--output path]   

# export flows
npx x-openapi-flow export-doc-flows [openapi-file] [--output path] [--format markdown|json]  
```

### SDK Generation

```bash
# generate flow-aware SDK
npx x-openapi-flow generate-sdk [openapi-file] --lang typescript [--output path] 
```

### Test Generation

```bash
# generate executable flow tests (happy path + invalid transitions)
npx x-openapi-flow generate-flow-tests [openapi-file] [--format jest|vitest|postman] [--output path]

# postman/newman-oriented collection with flow scripts
npx x-openapi-flow generate-flow-tests [openapi-file] --format postman [--output path] [--with-scripts]
```

Full details:  

- [CLI-Reference.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/reference/CLI-Reference.md)  
- [README.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/x-openapi-flow/README.md)

## NestJS Integration

Dedicated package: **x-openapi-flow-nestjs**

```bash
npm install x-openapi-flow x-openapi-flow-nestjs
```

Then import from `x-openapi-flow-nestjs`.

This package wraps the official runtime-guard helpers and exposes a NestJS-first API.

Release automation for this package uses dedicated tags in the format `nestjs-v<version>`
(example: `nestjs-v0.1.0`) so it does not conflict with `x-openapi-flow` tags.

### Option A: Middleware (drop-in)

```ts
// flow-guard.middleware.ts
import { Injectable, NestMiddleware } from "@nestjs/common";
import { createFlowMiddleware, MemoryAdapter } from "x-openapi-flow-nestjs";
import openapi from "./openapi.flow.json";

const store = new MemoryAdapter(); // swap for RedisAdapter or GenericSQLAdapter in production
const guard = createFlowMiddleware({ openapi, ...store.forGuard() });

@Injectable()
export class FlowGuardMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    guard.use(req, res, next);
  }
}

// app.module.ts — apply to specific routes
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(FlowGuardMiddleware).forRoutes("orders");
  }
}
```

### Option B: CanActivate Guard

```ts
// flow.guard.ts
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { createFlowGuard, MemoryAdapter } from "x-openapi-flow-nestjs";
import openapi from "./openapi.flow.json";

const store = new MemoryAdapter();
const flowGuard = createFlowGuard({ openapi, ...store.forGuard() });

@Injectable()
export class FlowGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    return flowGuard.canActivate(context);
  }
}
```

After each successful state-changing request, call `store.setState` to advance the resource:

```ts
@Post(":id/pay")
async pay(@Param("id") id: string) {
  // … business logic …
  await store.setState({ resourceId: id, state: "paid" });
  return { ok: true };
}
```

## Documentation and Guides

Get the most out of x-openapi-flow with detailed guides, examples, and integration instructions:

- **Adoption Guide** – [docs/wiki/getting-started/Adoption-Playbook.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/getting-started/Adoption-Playbook.md)  
  Learn how to introduce x-openapi-flow into your API workflow efficiently

- **Troubleshooting** – [docs/wiki/reference/Troubleshooting.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/reference/Troubleshooting.md)  
  Quick solutions to common issues and validation errors

- **Real Examples** – [docs/wiki/engineering/Real-Examples.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/engineering/Real-Examples.md)  
  Explore real OpenAPI specs enhanced with lifecycle metadata

- **Integrations**:  
  - **GitHub Actions** – [docs/wiki/integrations/GitHub-Actions-Integration.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/integrations/GitHub-Actions-Integration.md)  
    Validate flow rules in CI in one reusable workflow step
  - **Swagger UI** – [docs/wiki/integrations/Swagger-UI-Integration.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/integrations/Swagger-UI-Integration.md)  
    See flow-aware panels in Swagger UI  
  - **Redoc** – [docs/wiki/integrations/Redoc-Integration.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/integrations/Redoc-Integration.md)  
    Generate lifecycle diagrams in Redoc documentation  
  - **Postman** – [docs/wiki/integrations/Postman-Integration.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/integrations/Postman-Integration.md)  
    Organize collections according to valid transitions  
  - **Insomnia** – [docs/wiki/integrations/Insomnia-Integration.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/integrations/Insomnia-Integration.md)  
    Pre-configure requests according to lifecycle flows

## Community and Proof

- **Share your case study** – [docs/wiki/community/Case-Study-Template.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/community/Case-Study-Template.md)
- **Open discussions and ideas** – use GitHub Issues to share adoption blockers, metrics, and integration stories
- **Prove impact with metrics** – track `denied_invalid_transition`, onboarding lead time, and CI catch rate before/after adoption

## Roadmap

We’re actively expanding x-openapi-flow to support multiple platforms and SDKs. Check our progress:

- 🗂 **Roadmap Overview** – [#2](https://github.com/tiago-marques/x-openapi-flow/issues/2)  
  See planned features and high-level goals

- 🐍 **Python SDK MVP** – [#3](https://github.com/tiago-marques/x-openapi-flow/issues/3)  
  Enable Python developers to use flow-aware SDKs

- 🏎 **Go SDK MVP** – [#4](https://github.com/tiago-marques/x-openapi-flow/issues/4)  
  Bring lifecycle-aware SDKs to Go projects

- ☕ **Kotlin SDK MVP** – [#5](https://github.com/tiago-marques/x-openapi-flow/issues/5)  
  Support Android and JVM developers with flow-aware SDKs

## Changelog

Keep track of updates and improvements in x-openapi-flow:

- **Latest Version (v1.7.0)** – [CHANGELOG.md#170---2026-04-02](https://github.com/tiago-marques/x-openapi-flow/blob/main/CHANGELOG.md#170---2026-04-02)  
  See what shipped in the current release

- **Version History** – [CHANGELOG.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/CHANGELOG.md)  
  Review the full version history and past updates

- **Release Notes** – [GitHub Release v1.7.0](https://github.com/tiago-marques/x-openapi-flow/releases/tag/v1.7.0)  
  See detailed notes for the latest release, including new features and fixes

## Documentation Language Policy

To ensure clarity and accessibility for the global developer community, **all project documentation should be written in English**. This helps contributors, users, and AI agents understand and use x-openapi-flow consistently.
