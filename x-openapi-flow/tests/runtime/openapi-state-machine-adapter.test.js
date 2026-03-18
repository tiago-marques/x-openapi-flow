"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  extractFlowOperationsFromOpenApi,
  buildStateMachineDefinitionFromOpenApi,
  createStateMachineAdapterModel,
} = require("../../lib/openapi-state-machine-adapter");

const OPENAPI = {
  openapi: "3.0.3",
  info: { title: "Adapter API", version: "1.0.0" },
  paths: {
    "/orders": {
      post: {
        operationId: "createOrder",
        "x-openapi-flow": {
          version: "1.0",
          id: "create-order",
          current_state: "CREATED",
          transitions: [
            {
              target_state: "CONFIRMED",
              trigger_type: "synchronous",
              next_operation_id: "confirmOrder",
            },
          ],
        },
      },
    },
    "/orders/{id}/confirm": {
      post: {
        operationId: "confirmOrder",
        "x-openapi-flow": {
          version: "1.0",
          id: "confirm-order",
          current_state: "CONFIRMED",
          transitions: [],
        },
      },
    },
  },
};

test("adapter extracts flow operations from OpenAPI", () => {
  const operations = extractFlowOperationsFromOpenApi(OPENAPI);

  assert.equal(Array.isArray(operations), true);
  assert.equal(operations.length, 2);
  assert.equal(operations[0].operationId, "createOrder");
  assert.equal(operations[1].operationId, "confirmOrder");
});

test("adapter builds deterministic state machine definition from OpenAPI", () => {
  const definition = buildStateMachineDefinitionFromOpenApi(OPENAPI);

  assert.equal(Array.isArray(definition.transitions), true);
  assert.equal(definition.transitions.length, 1);
  assert.deepEqual(definition.transitions[0], {
    from: "CREATED",
    action: "confirmOrder",
    to: "CONFIRMED",
  });
});

test("adapter creates combined model for programmatic usage", () => {
  const model = createStateMachineAdapterModel({ openapi: OPENAPI });

  assert.equal(Array.isArray(model.operations), true);
  assert.equal(model.operations.length, 2);
  assert.equal(Array.isArray(model.definition.transitions), true);
  assert.equal(model.definition.transitions.length, 1);
});
