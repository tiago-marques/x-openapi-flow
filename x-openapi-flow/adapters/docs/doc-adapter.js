"use strict";

const fs = require("fs");
const path = require("path");
const { loadApi } = require("../../lib/validator");
const { buildIntermediateModel } = require("../../lib/sdk-generator");
const { toTitleCase, buildLifecycleSequences, enrichModelWithFlowDetails } = require("../shared/helpers");

function buildTransitionDetailLines(nextOperation) {
  const lines = [];

  if (nextOperation.decisionRule) {
    lines.push(`decision: ${nextOperation.decisionRule}`);
  }
  if (Array.isArray(nextOperation.evidenceRefs) && nextOperation.evidenceRefs.length) {
    lines.push(`evidence: ${nextOperation.evidenceRefs.join(", ")}`);
  }
  if (Array.isArray(nextOperation.prerequisiteFieldRefs) && nextOperation.prerequisiteFieldRefs.length) {
    lines.push(`needs fields: ${nextOperation.prerequisiteFieldRefs.join(", ")}`);
  }
  if (Array.isArray(nextOperation.propagatedFieldRefs) && nextOperation.propagatedFieldRefs.length) {
    lines.push(`propagates: ${nextOperation.propagatedFieldRefs.join(", ")}`);
  }
  if (nextOperation.asyncContract && typeof nextOperation.asyncContract === "object") {
    const contract = nextOperation.asyncContract;
    const parts = [];
    if (contract.timeout_ms != null) parts.push(`timeout: ${contract.timeout_ms}ms`);
    if (contract.max_retries != null) parts.push(`max_retries: ${contract.max_retries}`);
    if (contract.backoff) parts.push(`backoff: ${contract.backoff}`);
    if (parts.length) lines.push(parts.join(", "));
  }
  if (nextOperation.compensationOperationId) {
    lines.push(`compensation: ${nextOperation.compensationOperationId}`);
  }
  if (Array.isArray(nextOperation.failurePaths) && nextOperation.failurePaths.length) {
    for (const failurePath of nextOperation.failurePaths) {
      const nextPart = failurePath.next_operation_id ? ` (next: ${failurePath.next_operation_id})` : "";
      lines.push(`on failure -> ${failurePath.target_state}${nextPart} — ${failurePath.reason}`);
    }
  }

  return lines;
}

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

      const transitions = operation.nextOperations || [];
      if (transitions.length > 0) {
        lines.push("- Transitions:");
        for (const transition of transitions) {
          const conditionPart = transition.condition ? ` — ${transition.condition}` : "";
          lines.push(`  - ${transition.triggerType || "-"} → ${transition.targetState || "-"}${conditionPart}`);
          for (const detailLine of buildTransitionDetailLines(transition)) {
            lines.push(`    - ${detailLine}`);
          }
        }
      }
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
  const model = enrichModelWithFlowDetails(buildIntermediateModel(api), api);

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
