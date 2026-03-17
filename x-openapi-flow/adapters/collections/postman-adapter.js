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

function extractResponseIdKeys(rawOperation) {
  if (!rawOperation || !rawOperation.responses || typeof rawOperation.responses !== "object") {
    return ["id"];
  }

  const keys = new Set(["id"]);
  const successResponse = Object.entries(rawOperation.responses).find(([statusCode]) => /^2\d\d$/.test(String(statusCode)));
  const response = successResponse ? successResponse[1] : null;
  const schema = response
    && response.content
    && response.content["application/json"]
    && response.content["application/json"].schema;

  const properties = schema && schema.properties ? Object.keys(schema.properties) : [];
  properties.forEach((key) => {
    if (key === "id" || /_id$/i.test(key)) {
      keys.add(key);
    }
  });

  return [...keys];
}

function buildPrerequisiteRuleSets(resource) {
  const incomingByTarget = new Map();

  for (const sourceOperation of resource.operations || []) {
    for (const nextOperation of sourceOperation.nextOperations || []) {
      const target = nextOperation && nextOperation.nextOperationId;
      if (!target) continue;

      if (!incomingByTarget.has(target)) {
        incomingByTarget.set(target, []);
      }

      const prereqSet = Array.from(new Set(Array.isArray(nextOperation.prerequisites) ? nextOperation.prerequisites : []));
      incomingByTarget.get(target).push(prereqSet);
    }
  }

  const dedupByTarget = new Map();
  for (const [target, sets] of incomingByTarget.entries()) {
    const unique = new Map();
    for (const set of sets) {
      const key = [...set].sort().join("|");
      if (!unique.has(key)) {
        unique.set(key, set);
      }
    }
    dedupByTarget.set(target, [...unique.values()]);
  }

  return dedupByTarget;
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

function buildPostmanItem(operation, resource, rawOperation) {
  const rawPath = pathToPostmanUrl(operation.path, resource.resourcePropertyName);
  const urlRaw = `{{baseUrl}}${rawPath}`;

  const item = {
    name: operation.operationId,
    request: {
      method: String(operation.httpMethod || "get").toUpperCase(),
      header: [
        {
          key: "Content-Type",
          value: "application/json",
          type: "text",
        },
      ],
      url: {
        raw: urlRaw,
        host: ["{{baseUrl}}"],
        path: rawPath.split("/").filter(Boolean),
      },
    },
    response: [],
  };

  if (["POST", "PUT", "PATCH"].includes(item.request.method)) {
    const bodyExample = extractJsonRequestExample(rawOperation);
    item.request.body = {
      mode: "raw",
      raw: JSON.stringify(bodyExample !== null ? bodyExample : {}, null, 2),
      options: { raw: { language: "json" } },
    };
  }

  return item;
}

function addPostmanScripts(item, operation, resource, ruleSetsByOperation, responseIdKeysByOperation) {
  const ruleSets = JSON.stringify((ruleSetsByOperation.get(operation.operationId) || []));
  const operationId = operation.operationId;
  const idCandidateKey = `${resource.resourcePropertyName}Id`;
  const idCandidateFields = JSON.stringify(responseIdKeysByOperation.get(operationId) || ["id"]);

  item.event = [
    {
      listen: "prerequest",
      script: {
        type: "text/javascript",
        exec: [
          `const ruleSets = ${ruleSets};`,
          "const executed = JSON.parse(pm.collectionVariables.get('flowExecutedOps') || '[]');",
          "if (ruleSets.length > 0) {",
          "  const isSatisfied = ruleSets.some((required) => required.every((operationId) => executed.includes(operationId)));",
          "  if (!isSatisfied) {",
          "    const expected = ruleSets.map((set) => set.join(' + ')).join(' OR ');",
          `    throw new Error('Missing prerequisites for ${operationId}. Expected one of: ' + expected);`,
          "  }",
          "}",
        ],
      },
    },
    {
      listen: "test",
      script: {
        type: "text/javascript",
        exec: [
          "let payload = {};",
          "try { payload = pm.response.json(); } catch (_err) { payload = {}; }",
          `const idFields = ${idCandidateFields};`,
          "const discovered = idFields.find((field) => payload && payload[field] !== undefined && payload[field] !== null);",
          `if (discovered) pm.collectionVariables.set('${idCandidateKey}', String(payload[discovered]));`,
          "const executed = JSON.parse(pm.collectionVariables.get('flowExecutedOps') || '[]');",
          `if (!executed.includes('${operationId}')) executed.push('${operationId}');`,
          "pm.collectionVariables.set('flowExecutedOps', JSON.stringify(executed));",
        ],
      },
    },
  ];
}

function generatePostmanCollection(options) {
  const apiPath = path.resolve(options.apiPath);
  const outputPath = path.resolve(options.outputPath || path.join(process.cwd(), "x-openapi-flow.postman_collection.json"));
  const withScripts = options.withScripts !== false;

  const api = loadApi(apiPath);
  const model = buildIntermediateModel(api);
  const operationMapById = getOperationMapById(api);

  const collection = {
    info: {
      name: "x-openapi-flow Lifecycle Collection",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      description: `Generated from ${apiPath}`,
    },
    item: [],
    variable: [
      { key: "baseUrl", value: "http://localhost:3000" },
      { key: "flowExecutedOps", value: "[]" },
    ],
  };

  for (const resource of model.resources) {
    const sequences = buildLifecycleSequences(resource);
    const ruleSetsByOperation = buildPrerequisiteRuleSets(resource);
    const responseIdKeysByOperation = new Map(
      resource.operations.map((operation) => [
        operation.operationId,
        extractResponseIdKeys(operationMapById.get(operation.operationId)),
      ])
    );
    const folder = {
      name: `${toTitleCase(resource.resourcePlural || resource.resource)} Lifecycle`,
      item: [],
    };

    if (sequences.length === 0) {
      const fallbackItems = resource.operations
        .filter((operation) => operation.hasFlow)
        .map((operation) => {
          const item = buildPostmanItem(operation, resource, operationMapById.get(operation.operationId));
          if (withScripts) {
            addPostmanScripts(item, operation, resource, ruleSetsByOperation, responseIdKeysByOperation);
          }
          return item;
        });
      folder.item.push(...fallbackItems);
    } else {
      sequences.forEach((sequence, index) => {
        const journey = {
          name: buildJourneyName(sequence, index),
          item: sequence.map((operation) => {
            const item = buildPostmanItem(operation, resource, operationMapById.get(operation.operationId));
            if (withScripts) {
              addPostmanScripts(item, operation, resource, ruleSetsByOperation, responseIdKeysByOperation);
            }
            return item;
          }),
        };
        folder.item.push(journey);
      });
    }

    collection.item.push(folder);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(collection, null, 2)}\n`, "utf8");

  return {
    outputPath,
    resources: model.resources.length,
    flowCount: model.flowCount,
    withScripts,
  };
}

module.exports = { generatePostmanCollection };
