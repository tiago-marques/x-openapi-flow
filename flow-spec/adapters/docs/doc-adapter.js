"use strict";

const fs = require("fs");
const path = require("path");
const { loadApi } = require("../../lib/validator");
const { buildIntermediateModel } = require("../../lib/sdk-generator");
const { toTitleCase, buildLifecycleSequences } = require("../shared/helpers");

function buildResourceMermaid(resource) {
  const flowOperations = resource.operations.filter((operation) => operation.hasFlow);
  const lines = ["stateDiagram-v2", "  direction LR"];

  const states = new Set(flowOperations.map((operation) => operation.currentState).filter(Boolean));
  for (const state of [...states].sort()) {
    lines.push(`  state ${state}`);
  }

  const edgeSet = new Set();
  for (const operation of flowOperations) {
    for (const next of operation.nextOperations || []) {
      const targetOperation = flowOperations.find((candidate) => candidate.operationId === next.nextOperationId);
      const targetState = next.targetState || (targetOperation && targetOperation.currentState);
      if (!targetState || !operation.currentState) continue;

      const label = next.nextOperationId
        ? `${operation.methodName} -> ${next.nextOperationId}`
        : operation.methodName;
      const edgeKey = `${operation.currentState}::${targetState}::${label}`;
      if (edgeSet.has(edgeKey)) continue;
      edgeSet.add(edgeKey);
      lines.push(`  ${operation.currentState} --> ${targetState}: ${label}`);
    }
  }

  return lines.join("\n");
}

function buildDocFlowsMarkdown(model, sourcePath) {
  const lines = [];
  lines.push("# API Flows");
  lines.push("");
  lines.push(`Source: ${sourcePath}`);
  lines.push("");
  lines.push("This page is generated from x-openapi-flow metadata.");
  lines.push("");

  for (const resource of model.resources) {
    const displayName = toTitleCase(resource.resourcePlural || resource.resource);
    lines.push(`## ${displayName} Lifecycle`);
    lines.push("");
    lines.push("### Flow / Lifecycle");
    lines.push("");
    lines.push("```mermaid");
    lines.push(buildResourceMermaid(resource));
    lines.push("```");
    lines.push("");

    const sequences = buildLifecycleSequences(resource);
    if (sequences.length > 0) {
      lines.push("### Journeys");
      lines.push("");
      sequences.forEach((sequence, index) => {
        const label = sequence.map((operation) => operation.methodName).join(" -> ");
        lines.push(`- Journey ${index + 1}: ${label}`);
      });
      lines.push("");
    }

    lines.push("### Operations");
    lines.push("");
    for (const operation of resource.operations.filter((item) => item.hasFlow)) {
      lines.push(`#### ${operation.operationId}`);
      lines.push(`- Endpoint: ${operation.httpMethod.toUpperCase()} ${operation.path}`);
      lines.push(`- Current state: ${operation.currentState || "-"}`);
      const prereqs = operation.prerequisites && operation.prerequisites.length > 0
        ? operation.prerequisites.join(", ")
        : "-";
      lines.push(`- Prerequisites: ${prereqs}`);

      const nextOps = (operation.nextOperations || [])
        .map((next) => next.nextOperationId)
        .filter(Boolean);
      lines.push(`- Next operations: ${nextOps.length > 0 ? nextOps.join(", ") : "-"}`);
      lines.push("");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function exportDocFlows(options) {
  const apiPath = path.resolve(options.apiPath);
  const outputPath = path.resolve(options.outputPath || path.join(process.cwd(), "api-flows.md"));
  const format = options.format || "markdown";

  if (!["markdown", "json"].includes(format)) {
    throw new Error(`Unsupported doc flow format '${format}'. Use 'markdown' or 'json'.`);
  }

  const api = loadApi(apiPath);
  const model = buildIntermediateModel(api);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  if (format === "json") {
    fs.writeFileSync(outputPath, `${JSON.stringify(model, null, 2)}\n`, "utf8");
  } else {
    fs.writeFileSync(outputPath, buildDocFlowsMarkdown(model, apiPath), "utf8");
  }

  return {
    outputPath,
    format,
    resources: model.resources.length,
    flowCount: model.flowCount,
  };
}

module.exports = { exportDocFlows };
