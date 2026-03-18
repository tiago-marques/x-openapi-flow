# OpenAPI State Machine Adapter

This adapter converts OpenAPI + `x-openapi-flow` metadata into a reusable state machine definition.

It is designed for programmatic usage and keeps OpenAPI parsing separate from state machine execution.

## Import

```js
const {
  createStateMachineAdapterModel,
  buildStateMachineDefinitionFromOpenApi,
} = require("x-openapi-flow/lib/openapi-state-machine-adapter");
```

## Build definition directly from OpenAPI object

```js
const definition = buildStateMachineDefinitionFromOpenApi(openapi);
```

Result shape:

```js
{
  transitions: [
    { from: "CREATED", action: "confirmOrder", to: "CONFIRMED" }
  ]
}
```

## Build full adapter model

```js
const model = createStateMachineAdapterModel({ openapi });
```

Model includes:

- `operations`: extracted flow operations with route metadata
- `definition`: deterministic state machine definition
- `api`: source OpenAPI object

## Build from file path

```js
const { buildStateMachineDefinitionFromOpenApiFile } =
  require("x-openapi-flow/lib/openapi-state-machine-adapter");

const definition = buildStateMachineDefinitionFromOpenApiFile("./openapi.flow.yaml");
```

## Typical usage with engine

```js
const {
  createStateMachineAdapterModel,
} = require("x-openapi-flow/lib/openapi-state-machine-adapter");
const { createStateMachineEngine } = require("x-openapi-flow/lib/state-machine-engine");

const model = createStateMachineAdapterModel({ openapiPath: "./openapi.flow.yaml" });
const engine = createStateMachineEngine(model.definition);

engine.canTransition("CREATED", "confirmOrder");
engine.getNextState("CREATED", "confirmOrder");
```
