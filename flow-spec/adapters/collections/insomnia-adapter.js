"use strict";

const fs = require("fs");
const path = require("path");
const { loadApi } = require("../../lib/validator");
const { buildIntermediateModel } = require("../../lib/sdk-generator");
const { toTitleCase, pathToPostmanUrl, buildLifecycleSequences } = require("../shared/helpers");

function generateInsomniaWorkspace(options) {
  const apiPath = path.resolve(options.apiPath);
  const outputPath = path.resolve(options.outputPath || path.join(process.cwd(), "x-openapi-flow.insomnia.json"));

  const api = loadApi(apiPath);
  const model = buildIntermediateModel(api);

  const workspaceId = "wrk_x_openapi_flow";
  const resources = [
    {
      _id: workspaceId,
      _type: "workspace",
      name: "x-openapi-flow Workspace",
      description: `Generated from ${apiPath}`,
      scope: "collection",
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
    const operations = sequences.length > 0
      ? Array.from(new Map(sequences.flat().map((op) => [op.operationId, op])).values())
      : resource.operations.filter((operation) => operation.hasFlow);

    operations.forEach((operation, index) => {
      const requestId = `req_${resource.resourcePropertyName}_${index + 1}`;
      resources.push({
        _id: requestId,
        _type: "request",
        parentId: groupId,
        name: operation.operationId,
        method: String(operation.httpMethod || "get").toUpperCase(),
        url: `{{ base_url }}${pathToPostmanUrl(operation.path, resource.resourcePropertyName)}`,
        body: {},
      });
    });
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
