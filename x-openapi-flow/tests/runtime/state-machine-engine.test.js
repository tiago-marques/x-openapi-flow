"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createStateMachineEngine,
  validateDefinition,
} = require("../../lib/state-machine-engine");

const DEFINITION = {
  transitions: [
    { from: "CREATED", action: "confirm", to: "CONFIRMED" },
    { from: "CONFIRMED", action: "ship", to: "SHIPPED" },
    { from: "SHIPPED", action: "deliver", to: "DELIVERED" },
  ],
};

test("state machine engine exposes deterministic canTransition/getNextState", () => {
  const engine = createStateMachineEngine(DEFINITION);

  assert.equal(engine.canTransition("CREATED", "confirm"), true);
  assert.equal(engine.canTransition("CREATED", "ship"), false);
  assert.equal(engine.getNextState("CREATED", "confirm"), "CONFIRMED");
  assert.equal(engine.getNextState("CREATED", "ship"), null);
});

test("state machine engine validates complete flow sequence", () => {
  const engine = createStateMachineEngine(DEFINITION);

  const valid = engine.validateFlow({
    startState: "CREATED",
    actions: ["confirm", "ship", "deliver"],
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.finalState, "DELIVERED");

  const invalid = engine.validateFlow({
    startState: "CREATED",
    actions: ["ship"],
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, "INVALID_TRANSITION");
  assert.deepEqual(invalid.error.availableActions, ["confirm"]);
});

test("state machine engine rejects non-deterministic transitions", () => {
  assert.throws(
    () =>
      createStateMachineEngine({
        transitions: [
          { from: "CREATED", action: "confirm", to: "CONFIRMED" },
          { from: "CREATED", action: "confirm", to: "CANCELLED" },
        ],
      }),
    /Non-deterministic transition detected/
  );
});

test("state machine definition validation reports structural issues", () => {
  const invalid = validateDefinition({
    transitions: [{ from: null, action: "a", to: "B" }],
  });

  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors.length > 0, true);
});
