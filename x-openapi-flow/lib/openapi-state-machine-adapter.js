"use strict";

const path = require("path");
const { loadApi } = require("./validator");

const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
];

function normalizePathTemplate(inputPath) {
  if (!inputPath) {
    return "/";
  }

  const withSlashes = String(inputPath).startsWith("/")
    ? String(inputPath)
    : `/${String(inputPath)}`;

  return withSlashes
    .replace(/:([A-Za-z0-9_]+)/g, "{$1}")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "") || "/";
}

function buildPathRegex(pathTemplate) {
  const escaped = normalizePathTemplate(pathTemplate)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\{[^}]+\\\}/g, "[^/]+");

  return new RegExp(`^${escaped}$`);
}

function routeKey(method, pathTemplate) {
  return `${String(method || "").toUpperCase()} ${normalizePathTemplate(pathTemplate)}`;
}

function extractFlowOperationsFromOpenApi(api, options = {}) {
  const methods = Array.isArray(options.httpMethods) && options.httpMethods.length > 0
    ? options.httpMethods
    : HTTP_METHODS;

  const operations = [];
  const paths = (api && api.paths) || {};

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation || !operation["x-openapi-flow"]) {
        continue;
      }

      const flow = operation["x-openapi-flow"];
      const operationId = operation.operationId || `${method}_${pathKey}`;

      operations.push({
        operationId,
        method: method.toUpperCase(),
        pathTemplate: normalizePathTemplate(pathKey),
        routeKey: routeKey(method, pathKey),
        routeRegex: buildPathRegex(pathKey),
        currentState: flow.current_state,
        transitions: Array.isArray(flow.transitions) ? flow.transitions : [],
      });
    }
  }

  return operations;
}

function buildStateMachineDefinitionFromOperations(operations) {
  const byOperationId = new Map(operations.map((operation) => [operation.operationId, operation]));
  const transitions = [];

  for (const source of operations) {
    for (const transition of source.transitions) {
      if (transition.next_operation_id && byOperationId.has(transition.next_operation_id)) {
        const target = byOperationId.get(transition.next_operation_id);
        transitions.push({
          from: source.currentState,
          action: transition.next_operation_id,
          to: target.currentState,
        });
        continue;
      }

      if (!transition.target_state) {
        continue;
      }

      for (const target of operations) {
        if (target.currentState === transition.target_state) {
          transitions.push({
            from: source.currentState,
            action: target.operationId,
            to: target.currentState,
          });
        }
      }
    }
  }

  return {
    transitions,
  };
}

function buildStateMachineDefinitionFromOpenApi(api, options = {}) {
  const operations = extractFlowOperationsFromOpenApi(api, options);
  return buildStateMachineDefinitionFromOperations(operations);
}

function buildStateMachineDefinitionFromOpenApiFile(openapiPath, options = {}) {
  const api = loadApi(path.resolve(openapiPath));
  return buildStateMachineDefinitionFromOpenApi(api, options);
}

function createStateMachineAdapterModel(options = {}) {
  if (!options.openapi && !options.openapiPath) {
    throw new Error("State machine adapter requires 'openapi' object or 'openapiPath'.");
  }

  const api = options.openapiPath
    ? loadApi(path.resolve(options.openapiPath))
    : options.openapi;

  const operations = extractFlowOperationsFromOpenApi(api, options);
  const definition = buildStateMachineDefinitionFromOperations(operations);

  return {
    api,
    operations,
    definition,
  };
}

module.exports = {
  normalizePathTemplate,
  routeKey,
  extractFlowOperationsFromOpenApi,
  buildStateMachineDefinitionFromOperations,
  buildStateMachineDefinitionFromOpenApi,
  buildStateMachineDefinitionFromOpenApiFile,
  createStateMachineAdapterModel,
};
