"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { loadApi, extractFlows } = require("../../lib/validator");
const { buildIntermediateModel } = require("../../lib/sdk-generator");

function buildRawFlowByOperationId(api) {
  const map = new Map();
  for (const entry of extractFlows(api)) {
    if (entry.operation_id) {
      map.set(entry.operation_id, entry.flow);
    }
  }
  return map;
}

function buildOperationContract(operation, rawFlowByOperationId) {
  const rawFlow = operation.hasFlow ? rawFlowByOperationId.get(operation.operationId) : null;

  const contract = {
    method: operation.httpMethod.toUpperCase(),
    path: operation.path,
  };

  if (operation.pathParams.length > 0) {
    contract.path_params = operation.pathParams;
  }

  if (!operation.hasFlow) {
    contract.tracked = false;
    return contract;
  }

  contract.current_state = operation.currentState;
  if (rawFlow && rawFlow.terminal) {
    contract.terminal = true;
  }
  if (rawFlow && rawFlow.description) {
    contract.description = rawFlow.description;
  }
  if (rawFlow && rawFlow.idempotency) {
    contract.idempotency = rawFlow.idempotency;
  }

  contract.prerequisite_operation_ids = operation.prerequisites || [];

  const transitions = (rawFlow && Array.isArray(rawFlow.transitions)) ? rawFlow.transitions : [];
  contract.transitions = transitions.map((transition) => ({ ...transition }));

  return contract;
}

function buildLlmFlowsDocument(api, model, apiPath) {
  const rawFlowByOperationId = buildRawFlowByOperationId(api);

  const resources = {};
  const entryPoints = [];

  for (const resourceModel of model.resources) {
    const operations = {};

    for (const operation of resourceModel.operations) {
      operations[operation.operationId] = buildOperationContract(operation, rawFlowByOperationId);

      if (operation.hasFlow && (operation.prerequisites || []).length === 0) {
        entryPoints.push(operation.operationId);
      }
    }

    resources[resourceModel.resourcePlural] = {
      initial_states: resourceModel.graph.initialStates,
      terminal_states: resourceModel.graph.terminalStates,
      operations,
    };
  }

  return {
    generator: "x-openapi-flow",
    purpose:
      "Machine-oriented flow contract for coding agents implementing an integration against this API. " +
      "Not intended as human-readable documentation — pair it with the base OpenAPI file for request/response schemas.",
    source: apiPath,
    entry_points: [...new Set(entryPoints)].sort(),
    resources,
  };
}

function exportLlmFlows(options) {
  const apiPath = path.resolve(options.apiPath);
  const format = options.format || "yaml";

  if (!["yaml", "json"].includes(format)) {
    throw new Error(`Unsupported llm flow format '${format}'. Use 'yaml' or 'json'.`);
  }

  const defaultFileName = format === "json" ? "api-flows.llm.json" : "api-flows.llm.yaml";
  const outputPath = path.resolve(options.outputPath || path.join(process.cwd(), defaultFileName));

  const api = loadApi(apiPath);
  const model = buildIntermediateModel(api);

  if (model.resources.length === 0) {
    throw new Error("No x-openapi-flow operations found. Add x-openapi-flow metadata before exporting llm flows.");
  }

  const document = buildLlmFlowsDocument(api, model, apiPath);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const content = format === "json"
    ? `${JSON.stringify(document, null, 2)}\n`
    : yaml.dump(document, { noRefs: true, lineWidth: -1 });

  fs.writeFileSync(outputPath, content, "utf8");

  return {
    outputPath,
    format,
    resources: model.resources.length,
    flowCount: model.flowCount,
    entryPoints: document.entry_points.length,
  };
}

module.exports = { exportLlmFlows };
