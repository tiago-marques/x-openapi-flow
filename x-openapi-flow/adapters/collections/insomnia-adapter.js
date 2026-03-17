"use strict";

const fs = require("fs");
const path = require("path");
const { loadApi } = require("../../lib/validator");
const { buildIntermediateModel } = require("../../lib/sdk-generator");
const { toTitleCase, pathToPostmanUrl, buildLifecycleSequences } = require("../shared/helpers");

function getOperationMapById(api) {
  const map = new Map();
  const paths = (api && api.paths) || {};

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(pathItem || {})) {
      if (!operation || typeof operation !== "object") continue;
      if (!operation.operationId) continue;
      map.set(operation.operationId, {
        ...operation,
        __path: pathKey,
        __method: String(method || "get").toLowerCase(),
      });
    }
  }

  return map;
}

function buildExampleFromSchema(schema) {
  if (!schema || typeof schema !== "object") return {};

  if (Object.prototype.hasOwnProperty.call(schema, "example")) {
    return schema.example;
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum[0];
  }

  if (schema.default !== undefined) {
    return schema.default;
  }

  const type = schema.type;
  if (type === "string") {
    if (schema.format === "date-time") return "2026-01-01T00:00:00Z";
    if (schema.format === "date") return "2026-01-01";
    if (schema.format === "email") return "user@example.com";
    return "string";
  }
  if (type === "number" || type === "integer") return 0;
  if (type === "boolean") return false;
  if (type === "array") {
    const itemExample = buildExampleFromSchema(schema.items || {});
    return itemExample === undefined ? [] : [itemExample];
  }

  const properties = schema.properties || {};
  const required = Array.isArray(schema.required) ? schema.required : Object.keys(properties);
  const payload = {};
  for (const key of required) {
    if (!properties[key]) continue;
    payload[key] = buildExampleFromSchema(properties[key]);
  }

  if (Object.keys(payload).length === 0) {
    for (const [key, propertySchema] of Object.entries(properties)) {
      payload[key] = buildExampleFromSchema(propertySchema);
    }
  }

  return payload;
}

function extractJsonRequestExample(rawOperation) {
  if (!rawOperation || !rawOperation.requestBody || !rawOperation.requestBody.content) {
    return null;
  }

  const jsonContent = rawOperation.requestBody.content["application/json"];
  if (!jsonContent) return null;

  if (jsonContent.example !== undefined) {
    return jsonContent.example;
  }

  if (jsonContent.examples && typeof jsonContent.examples === "object") {
    const firstExample = Object.values(jsonContent.examples)[0];
    if (firstExample && typeof firstExample === "object" && firstExample.value !== undefined) {
      return firstExample.value;
    }
  }

  if (jsonContent.schema) {
    return buildExampleFromSchema(jsonContent.schema);
  }

  return null;
}

function buildJourneyName(sequence, index) {
  if (!Array.isArray(sequence) || sequence.length === 0) {
    return `Journey ${index + 1}`;
  }

  if (sequence.length === 1) {
    return `Journey ${index + 1}: ${sequence[0].operationId}`;
  }

  const first = sequence[0].operationId;
  const last = sequence[sequence.length - 1].operationId;
  return `Journey ${index + 1}: ${first} -> ${last}`;
}

function buildFlowDescription(operation) {
  const lines = [];

  if (operation.currentState) {
    lines.push(`Current state: ${operation.currentState}`);
  }

  if (Array.isArray(operation.prerequisites) && operation.prerequisites.length > 0) {
    lines.push(`Prerequisites: ${operation.prerequisites.join(", ")}`);
  }

  if (Array.isArray(operation.nextOperations) && operation.nextOperations.length > 0) {
    const transitions = operation.nextOperations
      .map((next) => {
        const parts = [];
        if (next.targetState) parts.push(`state ${next.targetState}`);
        if (next.nextOperationId) parts.push(`op ${next.nextOperationId}`);
        if (next.triggerType) parts.push(`trigger ${next.triggerType}`);
        return parts.join(" | ");
      })
      .filter(Boolean);
    if (transitions.length > 0) {
      lines.push(`Next: ${transitions.join(" ; ")}`);
    }
  }

  return lines.join("\n");
}

function createInsomniaRequest(requestId, parentId, operation, resource, rawOperation) {
  const request = {
    _id: requestId,
    _type: "request",
    parentId,
    name: operation.operationId,
    method: String(operation.httpMethod || "get").toUpperCase(),
    url: `{{ base_url }}${pathToPostmanUrl(operation.path, resource.resourcePropertyName)}`,
    headers: [],
    body: {},
  };

  const description = buildFlowDescription(operation);
  if (description) {
    request.description = description;
  }

  if (["POST", "PUT", "PATCH"].includes(request.method)) {
    request.headers.push({ name: "Content-Type", value: "application/json" });
    const bodyExample = extractJsonRequestExample(rawOperation);
    request.body = {
      mimeType: "application/json",
      text: JSON.stringify(bodyExample !== null ? bodyExample : {}, null, 2),
    };
  }

  return request;
}

function generateInsomniaWorkspace(options) {
  const apiPath = path.resolve(options.apiPath);
  const outputPath = path.resolve(options.outputPath || path.join(process.cwd(), "x-openapi-flow.insomnia.json"));

  const api = loadApi(apiPath);
  const model = buildIntermediateModel(api);
  const operationMapById = getOperationMapById(api);

  const workspaceId = "wrk_x_openapi_flow";
  const environmentId = "env_x_openapi_flow_base";
  const resources = [
    {
      _id: workspaceId,
      _type: "workspace",
      name: "x-openapi-flow Workspace",
      description: `Generated from ${apiPath}`,
      scope: "collection",
    },
    {
      _id: environmentId,
      _type: "environment",
      parentId: workspaceId,
      name: "Base Environment",
      data: {
        base_url: "http://localhost:3000",
      },
    },
  ];

  for (const resource of model.resources) {
    const groupId = `fld_${resource.resourcePropertyName}`;
    resources.push({
      _id: groupId,
      _type: "request_group",
      parentId: workspaceId,
      name: `${toTitleCase(resource.resourcePlural || resource.resource)} Flow`,
    });

    const sequences = buildLifecycleSequences(resource);
    if (sequences.length > 0) {
      sequences.forEach((sequence, sequenceIndex) => {
        const journeyId = `fld_${resource.resourcePropertyName}_journey_${sequenceIndex + 1}`;
        resources.push({
          _id: journeyId,
          _type: "request_group",
          parentId: groupId,
          name: buildJourneyName(sequence, sequenceIndex),
        });

        sequence.forEach((operation, operationIndex) => {
          const requestId = `req_${resource.resourcePropertyName}_${sequenceIndex + 1}_${operationIndex + 1}`;
          resources.push(
            createInsomniaRequest(
              requestId,
              journeyId,
              operation,
              resource,
              operationMapById.get(operation.operationId)
            )
          );
        });
      });
    } else {
      const operations = resource.operations.filter((operation) => operation.hasFlow);
      operations.forEach((operation, index) => {
        const requestId = `req_${resource.resourcePropertyName}_${index + 1}`;
        resources.push(
          createInsomniaRequest(
            requestId,
            groupId,
            operation,
            resource,
            operationMapById.get(operation.operationId)
          )
        );
      });
    }
  }

  const exportPayload = {
    _type: "export",
    __export_format: 4,
    __export_date: new Date().toISOString(),
    __export_source: "x-openapi-flow",
    resources,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(exportPayload, null, 2)}\n`, "utf8");

  return {
    outputPath,
    resources: model.resources.length,
    flowCount: model.flowCount,
  };
}

module.exports = { generateInsomniaWorkspace };
