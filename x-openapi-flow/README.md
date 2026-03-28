<!-- Auto-generated from /README.md via scripts/sync-package-readme.js. Do not edit directly. -->

# OpenAPI describes APIs. x-openapi-flow turns them into executable workflows — for developers and AI agents.

## Define your API workflows in openapi.x.json and execute them without writing custom clients or orchestration logic.

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
> npx x-openapi-flow init

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
    "id": "create-order",
    "current_state": "created",
    "description": "Creates an order and starts the lifecycle",
    "transitions": [
      {
        "trigger_type": "synchronous",
        "condition": "Payment is confirmed",
        "target_state": "paid",
        "next_operation_id": "payOrder",
        "prerequisite_operation_ids": ["createOrder"],
        "propagated_field_refs": [
          "createOrder:response.201.body.order_id"
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

### 5-Minute Demo: Real Runtime Block (E-commerce Orders)

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

## Documentation and Guides

Get the most out of x-openapi-flow with detailed guides, examples, and integration instructions:

- **Adoption Guide** – [docs/wiki/getting-started/Adoption-Playbook.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/getting-started/Adoption-Playbook.md)  
  Learn how to introduce x-openapi-flow into your API workflow efficiently

- **Troubleshooting** – [docs/wiki/reference/Troubleshooting.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/reference/Troubleshooting.md)  
  Quick solutions to common issues and validation errors

- **Real Examples** – [docs/wiki/engineering/Real-Examples.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/engineering/Real-Examples.md)  
  Explore real OpenAPI specs enhanced with lifecycle metadata

- **Integrations**:  
  - **Swagger UI** – [docs/wiki/integrations/Swagger-UI-Integration.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/integrations/Swagger-UI-Integration.md)  
    See flow-aware panels in Swagger UI  
  - **Redoc** – [docs/wiki/integrations/Redoc-Integration.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/integrations/Redoc-Integration.md)  
    Generate lifecycle diagrams in Redoc documentation  
  - **Postman** – [docs/wiki/integrations/Postman-Integration.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/integrations/Postman-Integration.md)  
    Organize collections according to valid transitions  
  - **Insomnia** – [docs/wiki/integrations/Insomnia-Integration.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/integrations/Insomnia-Integration.md)  
    Pre-configure requests according to lifecycle flows

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

- **Version History** – [CHANGELOG.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/CHANGELOG.md)  
  Review the full version history and past updates

- **Release Notes** – [docs/wiki/releases/RELEASE_NOTES_v1.4.0.md](https://github.com/tiago-marques/x-openapi-flow/blob/main/docs/wiki/releases/RELEASE_NOTES_v1.4.0.md)  
  See detailed notes for the latest release, including new features and fixes

## Documentation Language Policy

To ensure clarity and accessibility for the global developer community, **all project documentation should be written in English**. This helps contributors, users, and AI agents understand and use x-openapi-flow consistently.
