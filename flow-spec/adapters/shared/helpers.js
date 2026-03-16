"use strict";

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

module.exports = { toTitleCase, pathToPostmanUrl, buildLifecycleSequences };
