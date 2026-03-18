# State Machine Engine API

`x-openapi-flow` now provides a reusable, deterministic state machine core for programmatic use.

This engine is independent from OpenAPI parsing and can be used in backends, tests, SDKs, and custom adapters.

## Import

```js
const { createStateMachineEngine } = require("x-openapi-flow/lib/state-machine-engine");
```

## Definition format

```js
const definition = {
  transitions: [
    { from: "CREATED", action: "confirm", to: "CONFIRMED" },
    { from: "CONFIRMED", action: "ship", to: "SHIPPED" },
  ],
};
```

## Create engine

```js
const engine = createStateMachineEngine(definition);
```

## Core methods

### canTransition(currentState, action)

Returns `true` if the transition exists.

```js
engine.canTransition("CREATED", "confirm"); // true
engine.canTransition("CREATED", "ship"); // false
```

### getNextState(currentState, action)

Returns the next state or `null` when transition is invalid.

```js
engine.getNextState("CREATED", "confirm"); // "CONFIRMED"
engine.getNextState("CREATED", "ship"); // null
```

### validateFlow({ startState, actions })

Validates a full sequence deterministically.

```js
const result = engine.validateFlow({
  startState: "CREATED",
  actions: ["confirm", "ship"],
});

// { ok: true, finalState: "SHIPPED" }
```

For invalid flow:

```js
// {
//   ok: false,
//   error: {
//     code: "INVALID_TRANSITION",
//     state: "CREATED",
//     action: "ship",
//     availableActions: ["confirm"]
//   }
// }
```

### getAvailableActions(currentState)

Returns sorted actions available from a state.

```js
engine.getAvailableActions("CREATED"); // ["confirm"]
```

### getStates() and getTransitions()

Returns deterministic, sorted snapshots of state machine data.

## Determinism guarantee

The engine rejects non-deterministic definitions (same `from` + `action` leading to different `to`).

## Validation helpers

```js
const { validateDefinition } = require("x-openapi-flow/lib/state-machine-engine");
const result = validateDefinition(definition);
```
