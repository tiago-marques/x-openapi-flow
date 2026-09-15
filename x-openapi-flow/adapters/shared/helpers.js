"use strict";

const { extractFlows } = require("../../lib/validator");

/**
 * Maps operationId -> the full authored x-openapi-flow object as it appears in
 * the OpenAPI source, unlike buildIntermediateModel()'s per-operation
 * nextOperations entries (shared with the SDK generator), which only keep
 * targetState/triggerType/nextOperationId/prerequisites for codegen and drop
 * condition/decision_rule/evidence_refs/field_refs/failure_paths/async_contract.
 */
function buildRawFlowByOperationId(api) {
  const map = new Map();
  for (const entry of extractFlows(api)) {
    if (entry.operation_id) {
      map.set(entry.operation_id, entry.flow);
    }
  }
  return map;
}

function toTitleCase(value) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function pathToPostmanUrl(pathTemplate, resourceKey) {
  const variablePrefix = resourceKey || "resource";
  return String(pathTemplate || "")
    .replace(/\{([^}]+)\}/g, (_full, name) => `{{${variablePrefix}${toTitleCase(name).replace(/\s+/g, "")}}}`);
}

function buildLifecycleSequences(resource) {
  const flowOperations = resource.operations.filter((operation) => operation.hasFlow);
  if (flowOperations.length === 0) {
    return [];
  }

  const byId = new Map(flowOperations.map((operation) => [operation.operationId, operation]));
  const indegree = new Map(flowOperations.map((operation) => [operation.operationId, 0]));

  for (const operation of flowOperations) {
    for (const next of operation.nextOperations || []) {
      if (next.nextOperationId && indegree.has(next.nextOperationId)) {
        indegree.set(next.nextOperationId, indegree.get(next.nextOperationId) + 1);
      }
    }
  }

  const starts = flowOperations
    .filter((operation) => indegree.get(operation.operationId) === 0)
    .map((operation) => operation.operationId);

  const roots = starts.length > 0 ? starts : [flowOperations[0].operationId];
  const sequences = [];

  function walk(operationId, trail, seen) {
    if (!byId.has(operationId) || seen.has(operationId)) {
      sequences.push(trail.slice());
      return;
    }

    const current = byId.get(operationId);
    trail.push(current);

    const nextIds = (current.nextOperations || [])
      .map((next) => next.nextOperationId)
      .filter((nextId) => nextId && byId.has(nextId));

    if (nextIds.length === 0) {
      sequences.push(trail.slice());
      trail.pop();
      return;
    }

    const nextSeen = new Set(seen);
    nextSeen.add(operationId);
    for (const nextId of nextIds) {
      walk(nextId, trail, nextSeen);
    }
    trail.pop();
  }

  for (const root of roots) {
    walk(root, [], new Set());
  }

  const dedup = new Map();
  for (const sequence of sequences) {
    if (!sequence || sequence.length === 0) continue;
    const key = sequence.map((operation) => operation.operationId).join("->");
    if (!dedup.has(key)) {
      dedup.set(key, sequence);
    }
  }

  return [...dedup.values()];
}

/**
 * buildIntermediateModel() (shared with the SDK generator) only keeps the fields
 * needed for codegen on each nextOperations entry: targetState, triggerType,
 * nextOperationId, prerequisites. Enrich a local copy of the model with the rest
 * of each authored transition — condition, decision_rule, evidence_refs, field
 * refs, failure_paths, async_contract, compensation_operation_id — so doc/UI
 * generators can render them without touching the shared model other
 * generators (SDK, docs) depend on.
 */
function enrichModelWithFlowDetails(model, api) {
  const rawFlowByOperationId = buildRawFlowByOperationId(api);

  for (const resource of model.resources) {
    for (const operation of resource.operations) {
      if (!operation.hasFlow) continue;

      const rawFlow = rawFlowByOperationId.get(operation.operationId);
      const rawTransitions = (rawFlow && Array.isArray(rawFlow.transitions)) ? rawFlow.transitions.slice() : [];

      operation.nextOperations = (operation.nextOperations || []).map((nextOperation) => {
        const matchIndex = rawTransitions.findIndex((transition) =>
          (transition.target_state || null) === (nextOperation.targetState || null)
          && (transition.next_operation_id || null) === (nextOperation.nextOperationId || null)
        );
        const rawTransition = matchIndex >= 0 ? rawTransitions.splice(matchIndex, 1)[0] : null;

        return {
          ...nextOperation,
          condition: rawTransition ? rawTransition.condition : undefined,
          decisionRule: rawTransition ? rawTransition.decision_rule : undefined,
          evidenceRefs: rawTransition ? rawTransition.evidence_refs : undefined,
          prerequisiteFieldRefs: rawTransition ? rawTransition.prerequisite_field_refs : undefined,
          propagatedFieldRefs: rawTransition ? rawTransition.propagated_field_refs : undefined,
          failurePaths: rawTransition ? rawTransition.failure_paths : undefined,
          compensationOperationId: rawTransition ? rawTransition.compensation_operation_id : undefined,
          asyncContract: rawTransition ? rawTransition.async_contract : undefined,
        };
      });
    }
  }

  return model;
}

module.exports = {
  toTitleCase,
  pathToPostmanUrl,
  buildLifecycleSequences,
  buildRawFlowByOperationId,
  enrichModelWithFlowDetails,
};
