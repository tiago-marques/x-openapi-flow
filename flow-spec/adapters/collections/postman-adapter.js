"use strict";

const fs = require("fs");
const path = require("path");
const { loadApi } = require("../../lib/validator");
const { buildIntermediateModel } = require("../../lib/sdk-generator");
const { toTitleCase, pathToPostmanUrl, buildLifecycleSequences } = require("../shared/helpers");

function buildPostmanItem(operation, resource) {
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
    item.request.body = {
      mode: "raw",
      raw: "{}",
      options: { raw: { language: "json" } },
    };
  }

  return item;
}

function addPostmanScripts(item, operation, resource) {
  const prereqs = JSON.stringify(operation.prerequisites || []);
  const operationId = operation.operationId;
  const idCandidateKey = `${resource.resourcePropertyName}Id`;

  item.event = [
    {
      listen: "prerequest",
      script: {
        type: "text/javascript",
        exec: [
          `const required = ${prereqs};`,
          "const executed = JSON.parse(pm.collectionVariables.get('flowExecutedOps') || '[]');",
          "const missing = required.filter((operationId) => !executed.includes(operationId));",
          "if (missing.length > 0) {",
          `  throw new Error('Missing prerequisites for ${operationId}: ' + missing.join(', '));`,
          "}",
        ],
      },
    },
    {
      listen: "test",
      script: {
        type: "text/javascript",
        exec: [
          "const payload = pm.response.json ? pm.response.json() : {};",
          `if (payload && payload.id) pm.collectionVariables.set('${idCandidateKey}', payload.id);`,
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
    const folder = {
      name: `${toTitleCase(resource.resourcePlural || resource.resource)} Lifecycle`,
      item: [],
    };

    if (sequences.length === 0) {
      const fallbackItems = resource.operations
        .filter((operation) => operation.hasFlow)
        .map((operation) => {
          const item = buildPostmanItem(operation, resource);
          if (withScripts) addPostmanScripts(item, operation, resource);
          return item;
        });
      folder.item.push(...fallbackItems);
    } else {
      sequences.forEach((sequence, index) => {
        const journey = {
          name: `Journey ${index + 1}`,
          item: sequence.map((operation) => {
            const item = buildPostmanItem(operation, resource);
            if (withScripts) addPostmanScripts(item, operation, resource);
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
