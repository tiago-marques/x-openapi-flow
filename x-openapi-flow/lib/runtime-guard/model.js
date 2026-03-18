"use strict";

const { createStateMachineAdapterModel, normalizePathTemplate, routeKey } = require("../openapi-state-machine-adapter");
const { createStateMachineEngine } = require("../state-machine-engine");

function buildPathRegex(pathTemplate) {
  const escaped = normalizePathTemplate(pathTemplate)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\{[^}]+\\\}/g, "[^/]+");

  return new RegExp(`^${escaped}$`);
}

function indexOperations(operations) {
  const byOperationId = new Map();
  const byRouteKey = new Map();

  for (const operation of operations) {
    const indexed = {
      ...operation,
      incomingFromStates: new Set(),
    };

    byOperationId.set(indexed.operationId, indexed);
    byRouteKey.set(indexed.routeKey, indexed);
  }

  // Build incoming transition map. Priority for explicit next_operation_id.
  const machineTransitions = [];

  for (const source of operations) {
    for (const transition of source.transitions) {
      if (transition.next_operation_id && byOperationId.has(transition.next_operation_id)) {
        const targetByOperation = byOperationId.get(transition.next_operation_id);
        targetByOperation.incomingFromStates.add(source.currentState);

        machineTransitions.push({
          from: source.currentState,
          action: transition.next_operation_id,
          to: targetByOperation.currentState,
        });
        continue;
      }

      // Fallback for flows without next_operation_id: map by target_state -> current_state.
      if (!transition.target_state) {
        continue;
      }

      for (const target of byOperationId.values()) {
        if (target.currentState === transition.target_state) {
          target.incomingFromStates.add(source.currentState);

          machineTransitions.push({
            from: source.currentState,
            action: target.operationId,
            to: target.currentState,
          });
        }
      }
    }
  }

  const stateMachine = createStateMachineEngine({
    transitions: machineTransitions,
  });

  return {
    operations: [...byOperationId.values()],
    byOperationId,
    byRouteKey,
    stateMachine,
  };
}

function loadRuntimeModel(options) {
  const model = createStateMachineAdapterModel(options || {});
  return indexOperations(model.operations);
}

module.exports = {
  loadRuntimeModel,
  normalizePathTemplate,
  routeKey,
};
