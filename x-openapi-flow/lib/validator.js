"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const Ajv = require("ajv");
const { CODES, buildIssue } = require("./error-codes");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const SCHEMA_PATH = path.join(__dirname, "..", "schema", "flow-schema.json");
const DEFAULT_API_PATH = path.join(
  __dirname,
  "..",
  "examples",
  "payment-api.yaml"
);

// ---------------------------------------------------------------------------
// Load & compile schema
// ---------------------------------------------------------------------------
const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load an OAS document from a YAML file.
 * @param {string} filePath - Absolute or relative path to the YAML file.
 * @returns {object} Parsed OAS document.
 */
function loadApi(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return yaml.load(content);
}

/**
 * Extract every x-openapi-flow object found in the `paths` section of an OAS document.
 * @param {object} api - Parsed OAS document.
 * @returns {{ endpoint: string, operation_id?: string, flow: object }[]}
 */
function extractFlows(api) {
  const entries = [];
  const paths = (api && api.paths) || {};

  for (const [pathKey, pathItem] of Object.entries(paths)) {
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
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (operation && operation["x-openapi-flow"]) {
        entries.push({
          endpoint: `${method.toUpperCase()} ${pathKey}`,
          operation_id: operation.operationId,
          flow: operation["x-openapi-flow"],
        });
      }
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate all x-openapi-flow objects against the JSON Schema.
 * @param {{ endpoint: string, flow: object }[]} flows
 * @returns {{ endpoint: string, errors: object[] }[]} Array of validation failures.
 */
function validateFlows(flows) {
  const failures = [];

  for (const { endpoint, flow } of flows) {
    const valid = validate(flow);
    if (!valid) {
      failures.push({ endpoint, errors: validate.errors });
    }
  }

  return failures;
}

/**
 * Build human-friendly fix suggestions from AJV errors.
 * @param {object[]} errors
 * @returns {string[]}
 */
function suggestFixes(errors = []) {
  const suggestions = new Set();

  for (const err of errors) {
    if (err.keyword === "required" && err.params && err.params.missingProperty) {
      const missing = err.params.missingProperty;
      if (missing === "version") {
        suggestions.add("Add `version: \"1.0\"` to the x-openapi-flow object.");
      } else if (missing === "id") {
        suggestions.add("Add a unique `id` to the x-openapi-flow object.");
      } else if (missing === "current_state") {
        suggestions.add("Add `current_state` to describe the operation state.");
      } else {
        suggestions.add(`Add required property \`${missing}\` in x-openapi-flow.`);
      }
    }

    if (err.keyword === "enum" && err.instancePath.endsWith("/version")) {
      suggestions.add("Use supported x-openapi-flow version: `\"1.0\"`.");
    }

    if (err.keyword === "additionalProperties" && err.params && err.params.additionalProperty) {
      suggestions.add(
        `Remove unsupported property \`${err.params.additionalProperty}\` from x-openapi-flow payload.`
      );
    }
  }

  return [...suggestions];
}

function defaultResult(pathValue, ok = true) {
  return {
    ok,
    path: pathValue,
    profile: "strict",
    flowCount: 0,
    schemaFailures: [],
    orphans: [],
    graphChecks: {
      initial_states: [],
      terminal_states: [],
      unreachable_states: [],
      cycle: { has_cycle: false },
    },
    qualityChecks: {
      multiple_initial_states: [],
      duplicate_transitions: [],
      duplicate_operation_ids: [],
      non_terminating_states: [],
      invalid_operation_references: [],
      invalid_field_references: [],
      semantic_warnings: [],
      warnings: [],
    },
  };
}

function getOperationsById(api) {
  const operationsById = new Map();
  const paths = (api && api.paths) || {};
  const methods = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation || !operation.operationId) {
        continue;
      }

      operationsById.set(operation.operationId, {
        operation,
        path_item: pathItem,
        path_key: pathKey,
        endpoint: `${method.toUpperCase()} ${pathKey}`,
      });
    }
  }

  return operationsById;
}

function detectDuplicateOperationIds(api) {
  const operationsById = new Map();
  const duplicates = [];
  const paths = (api && api.paths) || {};
  const methods = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation || !operation.operationId) {
        continue;
      }

      const endpoint = `${method.toUpperCase()} ${pathKey}`;
      if (!operationsById.has(operation.operationId)) {
        operationsById.set(operation.operationId, [endpoint]);
        continue;
      }

      operationsById.get(operation.operationId).push(endpoint);
    }
  }

  for (const [operationId, endpoints] of operationsById.entries()) {
    if (endpoints.length > 1) {
      duplicates.push({
        operation_id: operationId,
        endpoints: endpoints.sort(),
      });
    }
  }

  return duplicates.sort((a, b) => a.operation_id.localeCompare(b.operation_id));
}

/**
 * Detect invalid operationId references declared in transitions.
 * @param {Map<string, { operation: object, endpoint: string }>} operationsById
 * @param {{ endpoint: string, operation_id?: string, flow: object }[]} flows
 * @returns {{ type: string, operation_id: string, declared_in: string }[]}
 */
function detectInvalidOperationReferences(operationsById, flows) {
  const knownOperationIds = new Set(operationsById.keys());

  const invalidReferences = [];

  for (const { endpoint, flow } of flows) {
    const transitions = flow.transitions || [];

    for (const transition of transitions) {
      if (transition.next_operation_id && !knownOperationIds.has(transition.next_operation_id)) {
        invalidReferences.push({
          type: "next_operation_id",
          operation_id: transition.next_operation_id,
          declared_in: endpoint,
        });
      }

      const prerequisites = Array.isArray(transition.prerequisite_operation_ids)
        ? transition.prerequisite_operation_ids
        : [];

      for (const prerequisiteOperationId of prerequisites) {
        if (!knownOperationIds.has(prerequisiteOperationId)) {
          invalidReferences.push({
            type: "prerequisite_operation_ids",
            operation_id: prerequisiteOperationId,
            declared_in: endpoint,
          });
        }
      }
    }
  }

  return invalidReferences;
}

function parseFieldReference(refValue) {
  if (typeof refValue !== "string") {
    return null;
  }

  const match = refValue.match(/^([^:]+):(request\.(body|path)|response\.(\d{3}|default)\.body)\.(.+)$/);
  if (!match) {
    return null;
  }

  const operationId = match[1];
  const scope = match[2];
  const responseCode = match[4];
  const fieldPath = match[5];

  return {
    operation_id: operationId,
    scope,
    response_code: responseCode,
    field_path: fieldPath,
  };
}

function resolveSchema(api, schema, depth = 0) {
  if (!schema || typeof schema !== "object") {
    return null;
  }

  if (depth > 10) {
    return null;
  }

  if (schema.$ref && typeof schema.$ref === "string") {
    const ref = schema.$ref;
    if (!ref.startsWith("#/")) {
      return null;
    }

    const tokens = ref.slice(2).split("/");
    let target = api;
    for (const token of tokens) {
      if (!target || typeof target !== "object") {
        return null;
      }
      target = target[token];
    }

    return resolveSchema(api, target, depth + 1);
  }

  return schema;
}

function hasFieldPath(api, schema, pathTokens) {
  const resolved = resolveSchema(api, schema);
  if (!resolved) {
    return false;
  }

  if (pathTokens.length === 0) {
    return true;
  }

  const [currentToken, ...rest] = pathTokens;

  if (Array.isArray(resolved.anyOf)) {
    return resolved.anyOf.some((item) => hasFieldPath(api, item, pathTokens));
  }
  if (Array.isArray(resolved.oneOf)) {
    return resolved.oneOf.some((item) => hasFieldPath(api, item, pathTokens));
  }
  if (Array.isArray(resolved.allOf)) {
    return resolved.allOf.some((item) => hasFieldPath(api, item, pathTokens));
  }

  if (resolved.type === "array" && resolved.items) {
    return hasFieldPath(api, resolved.items, pathTokens);
  }

  if (resolved.properties && typeof resolved.properties === "object") {
    if (!(currentToken in resolved.properties)) {
      return false;
    }
    return hasFieldPath(api, resolved.properties[currentToken], rest);
  }

  if (resolved.additionalProperties && typeof resolved.additionalProperties === "object") {
    return hasFieldPath(api, resolved.additionalProperties, rest);
  }

  return false;
}

function resolveFieldReferenceSchema(api, operationsById, parsedRef) {
  const operationInfo = operationsById.get(parsedRef.operation_id);
  if (!operationInfo) {
    return { error: "operation_not_found" };
  }

  const operation = operationInfo.operation;
  if (parsedRef.scope === "request.body") {
    const requestSchema = operation.requestBody
      && operation.requestBody.content
      && operation.requestBody.content["application/json"]
      && operation.requestBody.content["application/json"].schema;

    if (!requestSchema) {
      return { error: "request_schema_not_found" };
    }

    return { schema: requestSchema };
  }

  if (parsedRef.scope === "request.path") {
    const pathLevelParams = Array.isArray(operationInfo.path_item && operationInfo.path_item.parameters)
      ? operationInfo.path_item.parameters
      : [];
    const operationLevelParams = Array.isArray(operation.parameters)
      ? operation.parameters
      : [];

    const allParams = [...pathLevelParams, ...operationLevelParams].filter(
      (param) => param && typeof param === "object" && param.in === "path" && param.name
    );

    if (!allParams.length) {
      return { error: "path_parameters_not_found" };
    }

    const pathSchema = {
      type: "object",
      properties: {},
    };

    for (const param of allParams) {
      pathSchema.properties[param.name] = param.schema || { type: "string" };
    }

    return { schema: pathSchema };
  }

  const responseCode = parsedRef.response_code;
  const responseSchema = operation.responses
    && operation.responses[responseCode]
    && operation.responses[responseCode].content
    && operation.responses[responseCode].content["application/json"]
    && operation.responses[responseCode].content["application/json"].schema;

  if (!responseSchema) {
    return { error: "response_schema_not_found" };
  }

  return { schema: responseSchema };
}

function detectInvalidFieldReferences(api, operationsById, flows) {
  const invalidFieldReferences = [];

  for (const { endpoint, flow } of flows) {
    const transitions = flow.transitions || [];

    for (const transition of transitions) {
      const referenceGroups = [
        {
          type: "prerequisite_field_refs",
          refs: Array.isArray(transition.prerequisite_field_refs)
            ? transition.prerequisite_field_refs
            : [],
        },
        {
          type: "propagated_field_refs",
          refs: Array.isArray(transition.propagated_field_refs)
            ? transition.propagated_field_refs
            : [],
        },
      ];

      for (const group of referenceGroups) {
        for (const refValue of group.refs) {
          const parsedRef = parseFieldReference(refValue);
          if (!parsedRef) {
            invalidFieldReferences.push({
              type: group.type,
              reference: refValue,
              reason: "invalid_format",
              declared_in: endpoint,
            });
            continue;
          }

          const resolvedSchema = resolveFieldReferenceSchema(api, operationsById, parsedRef);
          if (resolvedSchema.error) {
            invalidFieldReferences.push({
              type: group.type,
              reference: refValue,
              reason: resolvedSchema.error,
              declared_in: endpoint,
            });
            continue;
          }

          const pathTokens = parsedRef.field_path.split(".").filter(Boolean);
          if (!hasFieldPath(api, resolvedSchema.schema, pathTokens)) {
            invalidFieldReferences.push({
              type: group.type,
              reference: refValue,
              reason: "field_not_found",
              declared_in: endpoint,
            });
          }
        }
      }
    }
  }

  return invalidFieldReferences;
}

/**
 * Verify that every target_state referenced in transitions corresponds to a
 * current_state defined in at least one endpoint of the same API.
 *
 * An "orphan state" is a target_state that has no matching current_state
 * anywhere in the API, meaning the lifecycle graph has a dangling edge.
 *
 * @param {{ endpoint: string, flow: object }[]} flows
 * @returns {{ target_state: string, declared_in: string }[]} Orphan states.
 */
function detectOrphanStates(flows) {
  // Collect every current_state declared across all endpoints.
  const knownStates = new Set(flows.map(({ flow }) => flow.current_state));

  const orphans = [];

  for (const { endpoint, flow } of flows) {
    const transitions = flow.transitions || [];
    for (const transition of transitions) {
      if (
        transition.target_state &&
        !knownStates.has(transition.target_state)
      ) {
        orphans.push({
          target_state: transition.target_state,
          declared_in: endpoint,
        });
      }
    }
  }

  return orphans;
}

/**
 * Build a directed graph from current_state -> target_state transitions.
 * @param {{ endpoint: string, flow: object }[]} flows
 * @returns {{ nodes: Set<string>, adjacency: Map<string, Set<string>>, indegree: Map<string, number>, outdegree: Map<string, number> }}
 */
function buildStateGraph(flows) {
  const nodes = new Set();
  const adjacency = new Map();
  const indegree = new Map();
  const outdegree = new Map();

  function ensureNode(state) {
    if (!nodes.has(state)) {
      nodes.add(state);
      adjacency.set(state, new Set());
      indegree.set(state, 0);
      outdegree.set(state, 0);
    }
  }

  for (const { flow } of flows) {
    ensureNode(flow.current_state);

    const transitions = flow.transitions || [];
    for (const transition of transitions) {
      if (!transition.target_state) {
        continue;
      }

      ensureNode(transition.target_state);

      const neighbors = adjacency.get(flow.current_state);
      if (!neighbors.has(transition.target_state)) {
        neighbors.add(transition.target_state);
        outdegree.set(flow.current_state, outdegree.get(flow.current_state) + 1);
        indegree.set(transition.target_state, indegree.get(transition.target_state) + 1);
      }
    }
  }

  return { nodes, adjacency, indegree, outdegree };
}

/**
 * Detect states that are unreachable from any initial state.
 * Initial states are those with indegree 0.
 * @param {{ nodes: Set<string>, adjacency: Map<string, Set<string>>, indegree: Map<string, number> }} graph
 * @returns {{ initial_states: string[], unreachable_states: string[] }}
 */
function detectUnreachableStates(graph) {
  const initialStates = [...graph.nodes].filter(
    (state) => graph.indegree.get(state) === 0
  );

  if (initialStates.length === 0) {
    return { initial_states: [], unreachable_states: [...graph.nodes] };
  }

  const visited = new Set();
  const stack = [...initialStates];

  while (stack.length > 0) {
    const current = stack.pop();
    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    const neighbors = graph.adjacency.get(current) || new Set();
    for (const next of neighbors) {
      if (!visited.has(next)) {
        stack.push(next);
      }
    }
  }

  const unreachableStates = [...graph.nodes].filter((state) => !visited.has(state));

  return {
    initial_states: initialStates,
    unreachable_states: unreachableStates,
  };
}

/**
 * Detect at least one directed cycle in the state graph.
 * @param {{ nodes: Set<string>, adjacency: Map<string, Set<string>> }} graph
 * @returns {{ has_cycle: boolean, cycle_path?: string[] }}
 */
function detectCycle(graph) {
  const visited = new Set();
  const inStack = new Set();
  const pathStack = [];

  function dfs(state) {
    visited.add(state);
    inStack.add(state);
    pathStack.push(state);

    const neighbors = graph.adjacency.get(state) || new Set();
    for (const next of neighbors) {
      if (!visited.has(next)) {
        const cycle = dfs(next);
        if (cycle) {
          return cycle;
        }
      } else if (inStack.has(next)) {
        const cycleStartIndex = pathStack.lastIndexOf(next);
        const cyclePath = pathStack.slice(cycleStartIndex).concat(next);
        return cyclePath;
      }
    }

    pathStack.pop();
    inStack.delete(state);
    return null;
  }

  for (const state of graph.nodes) {
    if (!visited.has(state)) {
      const cyclePath = dfs(state);
      if (cyclePath) {
        return { has_cycle: true, cycle_path: cyclePath };
      }
    }
  }

  return { has_cycle: false };
}

/**
 * Detect duplicate transitions with same source, target and trigger_type.
 * @param {{ endpoint: string, flow: object }[]} flows
 * @returns {{ from: string, to: string, trigger_type: string, count: number, declared_in: string[] }[]}
 */
function detectDuplicateTransitions(flows) {
  const transitionMap = new Map();

  for (const { endpoint, flow } of flows) {
    const source = flow.current_state;
    const transitions = flow.transitions || [];

    for (const transition of transitions) {
      const target = transition.target_state;
      const triggerType = transition.trigger_type;

      if (!target || !triggerType) {
        continue;
      }

      const key = `${source}::${target}::${triggerType}`;
      if (!transitionMap.has(key)) {
        transitionMap.set(key, {
          from: source,
          to: target,
          trigger_type: triggerType,
          count: 0,
          declared_in: [],
        });
      }

      const entry = transitionMap.get(key);
      entry.count += 1;
      entry.declared_in.push(endpoint);
    }
  }

  return [...transitionMap.values()].filter((entry) => entry.count > 1);
}

/**
 * Detect states that cannot reach any terminal state.
 * @param {{ nodes: Set<string>, adjacency: Map<string, Set<string>>, outdegree: Map<string, number> }} graph
 * @returns {{ terminal_states: string[], non_terminating_states: string[] }}
 */
function detectTerminalCoverage(graph) {
  const terminalStates = [...graph.nodes].filter(
    (state) => graph.outdegree.get(state) === 0
  );

  if (terminalStates.length === 0) {
    return {
      terminal_states: [],
      non_terminating_states: [...graph.nodes],
    };
  }

  const reverseAdjacency = new Map();
  for (const state of graph.nodes) {
    reverseAdjacency.set(state, new Set());
  }

  for (const [from, targets] of graph.adjacency.entries()) {
    for (const to of targets) {
      reverseAdjacency.get(to).add(from);
    }
  }

  const canReachTerminal = new Set();
  const stack = [...terminalStates];

  while (stack.length > 0) {
    const current = stack.pop();
    if (canReachTerminal.has(current)) {
      continue;
    }

    canReachTerminal.add(current);

    const previousStates = reverseAdjacency.get(current) || new Set();
    for (const previous of previousStates) {
      if (!canReachTerminal.has(previous)) {
        stack.push(previous);
      }
    }
  }

  const nonTerminatingStates = [...graph.nodes].filter(
    (state) => !canReachTerminal.has(state)
  );

  return {
    terminal_states: terminalStates,
    non_terminating_states: nonTerminatingStates,
  };
}

function detectStateNamingStyle(state) {
  if (/^[A-Z][A-Z0-9_]*$/.test(state)) {
    return "upper_snake";
  }
  if (/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(state)) {
    return "kebab_case";
  }
  if (/^[a-z][a-zA-Z0-9]*$/.test(state)) {
    return "camelCase";
  }
  if (/^[A-Z][a-zA-Z0-9]*$/.test(state)) {
    return "PascalCase";
  }
  return "other";
}

function canonicalizeStateName(state) {
  return String(state || "")
    .toLowerCase()
    .replace(/[_\-\s]+/g, "");
}

function detectSemanticModelingWarnings(flows) {
  const warnings = [];
  const states = [...new Set(flows.map(({ flow }) => String(flow.current_state)).filter(Boolean))];

  if (states.length > 0) {
    const styleSet = new Set(states.map((state) => detectStateNamingStyle(state)));
    if (styleSet.size > 1) {
      warnings.push(
        `Semantic: inconsistent state naming styles detected (${[...styleSet].sort().join(", ")}).`
      );
    }

    const byCanonical = new Map();
    for (const state of states) {
      const key = canonicalizeStateName(state);
      if (!byCanonical.has(key)) {
        byCanonical.set(key, new Set());
      }
      byCanonical.get(key).add(state);
    }

    for (const variants of byCanonical.values()) {
      if (variants.size > 1) {
        warnings.push(
          `Semantic: ambiguous state variants found (${[...variants].sort().join(", ")}).`
        );
      }
    }
  }

  const transitionSignature = new Map();
  for (const { flow } of flows) {
    const from = String(flow.current_state || "");
    const transitions = Array.isArray(flow.transitions) ? flow.transitions : [];

    for (const transition of transitions) {
      if (!transition || !transition.next_operation_id) {
        continue;
      }

      const key = `${from}::${transition.next_operation_id}`;
      if (!transitionSignature.has(key)) {
        transitionSignature.set(key, new Set());
      }
      transitionSignature.get(key).add(String(transition.target_state || ""));
    }
  }

  for (const [signature, targetStates] of transitionSignature.entries()) {
    if (targetStates.size > 1) {
      const [signatureFrom, signatureOperation] = signature.split("::");
      warnings.push(
        `Semantic: ambiguous transition mapping from state '${signatureFrom}' to next_operation_id '${signatureOperation}' with multiple target states (${[...targetStates].sort().join(", ")}).`
      );
    }
  }

  return [...new Set(warnings)];
}

function getTransitionSourceState(flow, transition) {
  if (transition && typeof transition.from_state === "string" && transition.from_state.trim()) {
    return transition.from_state.trim();
  }

  return String((flow && flow.current_state) || "").trim();
}

function detectTransitionDeterminismIssues(flows) {
  const decisionRuleIssues = [];
  const evidenceRefIssues = [];
  const transitionPriorityIssues = [];

  const groupedBySource = new Map();

  for (const { endpoint, flow } of flows) {
    const transitions = Array.isArray(flow && flow.transitions) ? flow.transitions : [];

    for (let index = 0; index < transitions.length; index += 1) {
      const transition = transitions[index];
      if (!transition || typeof transition !== "object") {
        continue;
      }

      const sourceState = getTransitionSourceState(flow, transition);
      if (!groupedBySource.has(sourceState)) {
        groupedBySource.set(sourceState, []);
      }

      groupedBySource.get(sourceState).push({
        endpoint,
        source_state: sourceState,
        transition,
        transition_index: index,
      });

      const decisionRule = typeof transition.decision_rule === "string"
        ? transition.decision_rule.trim()
        : "";

      if (decisionRule.length > 0) {
        const evidenceRefs = Array.isArray(transition.evidence_refs)
          ? transition.evidence_refs.filter((entry) => typeof entry === "string" && entry.trim())
          : [];

        if (evidenceRefs.length === 0) {
          evidenceRefIssues.push({
            endpoint,
            source_state: sourceState,
            target_state: transition.target_state || null,
            transition_id: transition.transition_id || null,
            transition_index: index,
            decision_rule: decisionRule,
          });
        }
      }
    }
  }

  for (const entries of groupedBySource.values()) {
    if (entries.length <= 1) {
      continue;
    }

    const priorityGroups = new Map();

    for (const entry of entries) {
      const decisionRule = typeof entry.transition.decision_rule === "string"
        ? entry.transition.decision_rule.trim()
        : "";

      if (!decisionRule) {
        decisionRuleIssues.push({
          endpoint: entry.endpoint,
          source_state: entry.source_state,
          target_state: entry.transition.target_state || null,
          transition_id: entry.transition.transition_id || null,
          transition_index: entry.transition_index,
        });
      }

      const hasPriority = Number.isFinite(entry.transition.transition_priority);
      if (!hasPriority) {
        transitionPriorityIssues.push({
          endpoint: entry.endpoint,
          source_state: entry.source_state,
          target_state: entry.transition.target_state || null,
          transition_id: entry.transition.transition_id || null,
          transition_index: entry.transition_index,
          reason: "missing_priority",
        });
        continue;
      }

      const priority = entry.transition.transition_priority;
      if (!priorityGroups.has(priority)) {
        priorityGroups.set(priority, []);
      }
      priorityGroups.get(priority).push(entry);
    }

    for (const [priority, collidingEntries] of priorityGroups.entries()) {
      if (collidingEntries.length <= 1) {
        continue;
      }

      for (const collidingEntry of collidingEntries) {
        transitionPriorityIssues.push({
          endpoint: collidingEntry.endpoint,
          source_state: collidingEntry.source_state,
          target_state: collidingEntry.transition.target_state || null,
          transition_id: collidingEntry.transition.transition_id || null,
          transition_index: collidingEntry.transition_index,
          reason: "duplicate_priority",
          priority,
        });
      }
    }
  }

  return {
    decision_rule_clarity: decisionRuleIssues,
    evidence_refs_for_decisions: evidenceRefIssues,
    transition_priority_determinism: transitionPriorityIssues,
  };
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

/**
 * Run all validations against an OAS file and print results.
 * @param {string} [apiPath] - Path to the OAS YAML file (defaults to payment-api.yaml).
 * @param {{ output?: "pretty" | "json", strictQuality?: boolean, profile?: "core" | "relaxed" | "strict", semantic?: boolean }} [options]
 * @returns {{ ok: boolean, path: string, flowCount: number, schemaFailures: object[], orphans: object[], graphChecks: object }}
 */
function run(apiPath, options = {}) {
  const output = options.output || "pretty";
  const strictQuality = options.strictQuality === true;
  const semantic = options.semantic === true;
  const profile = options.profile || "strict";
  const profiles = {
    core: { runAdvanced: false, failAdvanced: false, runQuality: false },
    relaxed: { runAdvanced: true, failAdvanced: false, runQuality: true },
    strict: { runAdvanced: true, failAdvanced: true, runQuality: true },
  };
  const profileConfig = profiles[profile];
  const resolvedPath = apiPath
    ? path.resolve(apiPath)
    : DEFAULT_API_PATH;

  if (!profileConfig) {
    const invalidProfileResult = defaultResult(resolvedPath, false);
    invalidProfileResult.error = `Invalid profile '${profile}'. Use core, relaxed, or strict.`;
    if (output === "json") {
      console.log(JSON.stringify(invalidProfileResult, null, 2));
    } else {
      console.error(`ERROR: ${invalidProfileResult.error}`);
    }
    return invalidProfileResult;
  }

  if (output === "pretty") {
    console.log(`\nValidating: ${resolvedPath}`);
    console.log(`Profile: ${profile}\n`);
  }

  // 1. Load API
  let api;
  try {
    api = loadApi(resolvedPath);
  } catch (err) {
    if (output === "json") {
      const result = defaultResult(resolvedPath, false);
      result.profile = profile;
      result.error = `Could not load API file — ${err.message}`;
      console.log(JSON.stringify(result, null, 2));
      return result;
    }

    console.error(`ERROR: Could not load API file — ${err.message}`);
    const result = defaultResult(resolvedPath, false);
    result.profile = profile;
    result.error = `Could not load API file — ${err.message}`;
    return result;
  }

  // 2. Extract x-openapi-flow objects
  const flows = extractFlows(api);

  if (flows.length === 0) {
    const result = defaultResult(resolvedPath, true);
    result.profile = profile;

    if (output === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.warn("WARNING: No x-openapi-flow extensions found in the API paths.");
    }

    return result;
  }

  if (output === "pretty") {
    console.log(`Found ${flows.length} x-openapi-flow definition(s).\n`);
  }

  let hasErrors = false;

  // 3. Schema validation
  const schemaFailures = validateFlows(flows);
  if (schemaFailures.length > 0) {
    hasErrors = true;
  }

  if (output === "pretty") {
    if (schemaFailures.length === 0) {
      console.log("✔  Schema validation passed for all x-openapi-flow definitions.");
    } else {
      console.error("✘  Schema validation FAILED:");
      for (const { endpoint, errors } of schemaFailures) {
        console.error(`   [${endpoint}]`);
        for (const err of errors) {
          console.error(`     - ${err.instancePath || "(root)"}: ${err.message}`);
        }
        const fixes = suggestFixes(errors);
        if (fixes.length > 0) {
          console.error("     Suggested fixes:");
          for (const fix of fixes) {
            console.error(`       * ${fix}`);
          }
        }
      }
    }
  }

  // 4. Orphan state detection
  const orphans = detectOrphanStates(flows);
  if (orphans.length > 0) {
    hasErrors = true;
  }

  if (output === "pretty") {
    if (orphans.length === 0) {
      console.log("✔  Graph validation passed — no orphan states detected.");
    } else {
      console.error("✘  Graph validation FAILED — orphan state(s) detected:");
      for (const { target_state, declared_in } of orphans) {
        console.error(
          `   target_state "${target_state}" (declared in ${declared_in}) has no matching current_state in any endpoint.`
        );
      }
    }
  }

  // 5. Advanced graph checks
  const operationsById = getOperationsById(api);
  const graph = buildStateGraph(flows);
  const initialStates = [...graph.nodes].filter(
    (state) => graph.indegree.get(state) === 0
  );
  const terminalStates = [...graph.nodes].filter(
    (state) => graph.outdegree.get(state) === 0
  );
  const reachability = detectUnreachableStates(graph);
  const cycle = detectCycle(graph);
  const duplicateTransitions = detectDuplicateTransitions(flows);
  const duplicateOperationIds = detectDuplicateOperationIds(api);
  const terminalCoverage = detectTerminalCoverage(graph);
  const invalidOperationReferences = detectInvalidOperationReferences(operationsById, flows);
  const invalidFieldReferences = detectInvalidFieldReferences(api, operationsById, flows);
  const multipleInitialStates = initialStates.length > 1 ? initialStates : [];

  if (profileConfig.runAdvanced) {
    if (profileConfig.failAdvanced && (initialStates.length === 0 || terminalStates.length === 0)) {
      hasErrors = true;
    }

    if (profileConfig.failAdvanced && reachability.unreachable_states.length > 0) {
      hasErrors = true;
    }

    if (profileConfig.failAdvanced && cycle.has_cycle) {
      hasErrors = true;
    }
  }

  const qualityWarnings = [];
  const semanticWarnings = semantic ? detectSemanticModelingWarnings(flows) : [];

  if (profileConfig.runQuality && multipleInitialStates.length > 0) {
    qualityWarnings.push(
      `Multiple initial states detected: ${multipleInitialStates.join(", ")}`
    );
  }

  if (profileConfig.runQuality && duplicateTransitions.length > 0) {
    qualityWarnings.push(
      `Duplicate transitions detected: ${duplicateTransitions.length}`
    );
  }

  if (profileConfig.runQuality && duplicateOperationIds.length > 0) {
    qualityWarnings.push(
      `Duplicate operationIds detected: ${duplicateOperationIds.map((entry) => entry.operation_id).join(", ")}`
    );
  }

  if (profileConfig.runQuality && terminalCoverage.non_terminating_states.length > 0) {
    qualityWarnings.push(
      `States without path to terminal: ${terminalCoverage.non_terminating_states.join(", ")}`
    );
  }

  if (profileConfig.runQuality && invalidOperationReferences.length > 0) {
    const invalidOperationIds = [
      ...new Set(invalidOperationReferences.map((item) => item.operation_id)),
    ];
    qualityWarnings.push(
      `Transition operation references not found: ${invalidOperationIds.join(", ")}`
    );
  }

  if (profileConfig.runQuality && invalidFieldReferences.length > 0) {
    qualityWarnings.push(
      `Transition field references not found/invalid: ${invalidFieldReferences.length}`
    );
  }

  if (profileConfig.runQuality && semanticWarnings.length > 0) {
    qualityWarnings.push(...semanticWarnings);
  }

  if (strictQuality && qualityWarnings.length > 0) {
    hasErrors = true;
  }

  if (output === "pretty") {
    if (profileConfig.runAdvanced) {
      if (initialStates.length === 0) {
        if (profileConfig.failAdvanced) {
          console.error("✘  Graph validation FAILED — no initial state detected (indegree = 0).");
        } else {
          console.warn("⚠  Graph warning — no initial state detected (indegree = 0).");
        }
      }

      if (terminalStates.length === 0) {
        if (profileConfig.failAdvanced) {
          console.error("✘  Graph validation FAILED — no terminal state detected (outdegree = 0).");
        } else {
          console.warn("⚠  Graph warning — no terminal state detected (outdegree = 0).");
        }
      }

      if (reachability.unreachable_states.length > 0) {
        if (profileConfig.failAdvanced) {
          console.error(
            `✘  Graph validation FAILED — unreachable state(s): ${reachability.unreachable_states.join(", ")}`
          );
        } else {
          console.warn(
            `⚠  Graph warning — unreachable state(s): ${reachability.unreachable_states.join(", ")}`
          );
        }
      }

      if (cycle.has_cycle) {
        if (profileConfig.failAdvanced) {
          console.error(
            `✘  Graph validation FAILED — cycle detected: ${cycle.cycle_path.join(" -> ")}`
          );
        } else {
          console.warn(
            `⚠  Graph warning — cycle detected: ${cycle.cycle_path.join(" -> ")}`
          );
        }
      }

      if (
        initialStates.length > 0 &&
        terminalStates.length > 0 &&
        reachability.unreachable_states.length === 0 &&
        !cycle.has_cycle
      ) {
        console.log("✔  Advanced graph checks passed (initial, terminal, reachability, acyclic).");
      }
    }

    if (profileConfig.runQuality) {
      if (qualityWarnings.length === 0) {
        console.log("✔  Quality checks passed (single initial, no duplicate transitions, terminal coverage).");
      } else {
        for (const warning of qualityWarnings) {
          if (strictQuality) {
            console.error(`✘  Quality check FAILED (strict): ${warning}`);
          } else {
            console.warn(`⚠  Quality warning: ${warning}`);
          }
        }
      }
    }
  }

  const result = {
    ok: !hasErrors,
    path: resolvedPath,
    profile,
    flowCount: flows.length,
    schemaFailures,
    orphans,
    graphChecks: {
      initial_states: initialStates,
      terminal_states: terminalStates,
      unreachable_states: reachability.unreachable_states,
      cycle,
    },
    qualityChecks: {
      multiple_initial_states: multipleInitialStates,
      duplicate_transitions: duplicateTransitions,
      duplicate_operation_ids: duplicateOperationIds,
      non_terminating_states: terminalCoverage.non_terminating_states,
      invalid_operation_references: invalidOperationReferences,
      invalid_field_references: invalidFieldReferences,
      semantic_warnings: semanticWarnings,
      warnings: qualityWarnings,
    },
  };

  // Attach structured issues list to JSON output
  result.issues = buildStructuredIssues(result);

  if (output === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("");
    if (hasErrors) {
      console.error("Validation finished with errors.");
      const failureSummary = buildValidateFailureSummary(result, {
        profile,
        strictQuality,
      });
      if (failureSummary.length > 0) {
        console.error("\nFailure summary:");
        failureSummary.forEach((line) => {
          console.error(` - ${line}`);
        });
      }

      const remediationHints = buildValidateRemediationHints(result, {
        strictQuality,
        profile,
        semantic,
        ci: isCiEnvironment(),
      });
      if (remediationHints.length > 0) {
        console.error("\nActionable next steps:");
        remediationHints.forEach((hint) => {
          console.error(` - ${hint}`);
        });
      }

      const suggestedCommands = buildValidateSuggestedCommands(resolvedPath, {
        profile,
        strictQuality,
        semantic,
        ci: isCiEnvironment(),
      });
      if (suggestedCommands.length > 0) {
        console.error("\nSuggested commands:");
        suggestedCommands.forEach((line) => {
          console.error(` - ${line}`);
        });
      }
    } else {
      console.log("All validations passed ✔");
    }
  }

  return result;
}

function buildValidateRemediationHints(result, context = {}) {
  const hints = [];
  const strictQualityEnabled = context.strictQuality === true;
  const profile = context.profile || "strict";
  const inCi = context.ci === true;

  if (profile === "core") {
    hints.push("Profile core is optimized for fast baseline checks. Use --profile strict before release to enforce graph correctness.");
  } else if (profile === "relaxed") {
    hints.push("Profile relaxed is ideal during modeling. Promote to --profile strict in CI when lifecycle design stabilizes.");
  } else {
    hints.push("Profile strict enforces graph soundness (initial/terminal/reachability/cycle checks). Keep it as the default release gate.");
  }

  if ((result.schemaFailures || []).length > 0) {
    hints.push("Fix schema violations first using the suggested fixes shown per endpoint.");
    hints.push("Use --format json to inspect structured issues[] with machine-readable codes and suggestions.");
  }

  if ((result.orphans || []).length > 0) {
    hints.push("Ensure every transition target_state exists as a current_state in at least one operation.");
  }

  if (profile === "strict") {
    if ((result.graphChecks.initial_states || []).length === 0) {
      hints.push("Add at least one entry state (a flow state with indegree 0).");
    }

    if ((result.graphChecks.terminal_states || []).length === 0) {
      hints.push("Add at least one terminal state (a flow state with no outgoing transitions).");
    }

    if ((result.graphChecks.unreachable_states || []).length > 0) {
      hints.push("Connect unreachable states to the main lifecycle path or remove stale transitions.");
    }

    if (result.graphChecks.cycle && result.graphChecks.cycle.has_cycle) {
      hints.push("Break lifecycle cycles or validate under --profile relaxed if cycles are intentional.");
    }
  }

  const qc = result.qualityChecks || {};
  if ((qc.invalid_operation_references || []).length > 0) {
    hints.push("Fix operation references: every next_operation_id/prerequisite_operation_ids must match an existing OpenAPI operationId.");
  }

  if ((qc.invalid_field_references || []).length > 0) {
    hints.push("Fix field references: each <operationId>:request/response path must exist in declared request/response schemas.");
  }

  if ((qc.duplicate_operation_ids || []).length > 0) {
    hints.push("Use unique operationId values across the whole API document.");
  }

  if ((qc.duplicate_transitions || []).length > 0) {
    hints.push("Remove duplicated transitions that share from_state + next_operation_id + target_state.");
  }

  if ((qc.non_terminating_states || []).length > 0) {
    hints.push("Ensure each state has a path to a terminal state, or simplify dead-end loops.");
  }

  if (strictQualityEnabled && (qc.warnings || []).length > 0) {
    hints.push(
      inCi
        ? "CI mode: --strict-quality is active and should block merges; resolve warnings before retrying the pipeline."
        : "Local mode: run once without --strict-quality to inspect warnings, then re-enable strict mode before pushing."
    );
  }

  hints.push("Run x-openapi-flow graph <openapi-file> --format mermaid to visualize and debug lifecycle paths.");

  return [...new Set(hints)];
}

function buildValidateFailureSummary(result, context = {}) {
  const qc = result.qualityChecks || {};
  const graph = result.graphChecks || {};
  const summary = [];

  const schemaErrors = (result.schemaFailures || []).reduce((count, failure) => {
    const failureCount = Array.isArray(failure.errors) ? failure.errors.length : 0;
    return count + failureCount;
  }, 0);

  const buckets = [
    { label: "schema errors", count: schemaErrors },
    { label: "orphan states", count: (result.orphans || []).length },
    { label: "unreachable states", count: (graph.unreachable_states || []).length },
    { label: "cycle detected", count: graph.cycle && graph.cycle.has_cycle ? 1 : 0 },
    { label: "invalid operation references", count: (qc.invalid_operation_references || []).length },
    { label: "invalid field references", count: (qc.invalid_field_references || []).length },
    { label: "duplicate operationIds", count: (qc.duplicate_operation_ids || []).length },
    { label: "duplicate transitions", count: (qc.duplicate_transitions || []).length },
    { label: "states without terminal path", count: (qc.non_terminating_states || []).length },
  ];

  buckets.forEach((bucket) => {
    if (bucket.count > 0) {
      summary.push(`${bucket.label}: ${bucket.count}`);
    }
  });

  if (context.strictQuality === true && (qc.warnings || []).length > 0) {
    summary.push(`strict-quality escalated warnings: ${(qc.warnings || []).length}`);
  }

  return summary;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function isCiEnvironment() {
  const value = process.env.CI;
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function buildValidateSuggestedCommands(resolvedPath, context = {}) {
  const commands = [];
  const profile = context.profile || "strict";
  const semanticFlag = context.semantic ? " --semantic" : "";
  const strictQualityFlag = context.strictQuality ? " --strict-quality" : "";
  const quotedPath = shellQuote(resolvedPath);
  const inCi = context.ci === true;

  commands.push(
    `[inspect] x-openapi-flow validate ${quotedPath} --profile ${profile}${semanticFlag}${strictQualityFlag} --format json`
  );

  commands.push(`[visualize] x-openapi-flow graph ${quotedPath} --format mermaid`);

  if (context.strictQuality) {
    commands.push(`[local-debug] x-openapi-flow validate ${quotedPath} --profile ${profile}${semanticFlag}`);
  }

  if (!inCi && profile !== "strict") {
    commands.push(`[pre-release] x-openapi-flow validate ${quotedPath} --profile strict${semanticFlag} --strict-quality`);
  }

  if (inCi && profile !== "strict") {
    commands.push(`[ci-hardening] x-openapi-flow validate ${quotedPath} --profile strict${semanticFlag} --strict-quality`);
  }

  return commands;
}

// ---------------------------------------------------------------------------
// Structured issue builder (maps raw results → standard issue objects)
// ---------------------------------------------------------------------------

/**
 * Convert raw validation result into a flat array of structured issue objects,
 * each with a stable XFLOW error code.
 */
function buildStructuredIssues(result) {
  const issues = [];

  // Schema failures
  for (const failure of (result.schemaFailures || [])) {
    for (const err of (failure.errors || [])) {
      const isAdditional = err.keyword === "additionalProperties" && err.params && err.params.additionalProperty;
      const isMissing = err.keyword === "required" && err.params && err.params.missingProperty;
      const isEnum = err.keyword === "enum";

      let def;
      if (isAdditional) {
        def = CODES.SCHEMA_ADDITIONAL_PROPERTY;
      } else if (isMissing) {
        def = CODES.SCHEMA_MISSING_REQUIRED;
      } else if (isEnum) {
        def = CODES.SCHEMA_INVALID_ENUM;
      } else {
        def = CODES.SCHEMA_VALIDATION_FAILED;
      }

      const msg = isMissing
        ? `Missing required property '${err.params.missingProperty}'.`
        : isAdditional
          ? `Property '${err.params.additionalProperty}' is not allowed.`
          : err.message || def.title;

      const suggestion = isMissing && err.params.missingProperty === "version"
        ? "Add `version: \"1.0\"` to the x-openapi-flow object."
        : isMissing && err.params.missingProperty === "current_state"
          ? "Add `current_state` to describe the operation state."
          : isAdditional
            ? `Remove unsupported property \`${err.params.additionalProperty}\` from x-openapi-flow payload.`
            : undefined;

      issues.push(buildIssue(def, msg, { location: failure.endpoint, suggestion }));
    }
  }

  // Orphan states
  for (const orphan of (result.orphans || [])) {
    issues.push(buildIssue(
      CODES.GRAPH_ORPHAN_STATES,
      `Orphan state: '${orphan}'.`,
      {
        location: orphan,
        suggestion: "Connect this state to the flow graph using transitions.",
      }
    ));
  }

  const gc = result.graphChecks || {};

  // Graph: no initial state
  if (Array.isArray(gc.initial_states) && gc.initial_states.length === 0 && (result.flowCount || 0) > 0) {
    issues.push(buildIssue(
      CODES.GRAPH_NO_INITIAL_STATE,
      "No initial state detected (every state has incoming transitions).",
      { suggestion: "Ensure at least one state has no incoming transitions (flow entry point)." }
    ));
  }

  // Graph: no terminal state
  if (Array.isArray(gc.terminal_states) && gc.terminal_states.length === 0 && (result.flowCount || 0) > 0) {
    issues.push(buildIssue(
      CODES.GRAPH_NO_TERMINAL_STATE,
      "No terminal state detected (every state has outgoing transitions).",
      { suggestion: "Ensure at least one state has no outgoing transitions (flow end point)." }
    ));
  }

  // Graph: unreachable
  for (const state of (gc.unreachable_states || [])) {
    issues.push(buildIssue(
      CODES.GRAPH_UNREACHABLE_STATES,
      `State '${state}' is unreachable from any initial state.`,
      { location: state, suggestion: `Add a transition leading to '${state}' or remove it.` }
    ));
  }

  // Graph: cycle
  if (gc.cycle && gc.cycle.has_cycle) {
    const cyclePath = Array.isArray(gc.cycle.cycle_path) ? gc.cycle.cycle_path.join(" → ") : "";
    issues.push(buildIssue(
      CODES.GRAPH_CYCLE_DETECTED,
      `Cycle detected in flow graph: ${cyclePath}.`,
      {
        suggestion: "Remove the back-edge creating the cycle or use profile 'relaxed' to allow cycles.",
        details: { cycle_path: gc.cycle.cycle_path },
      }
    ));
  }

  const qc = result.qualityChecks || {};

  // Quality: multiple initial states
  for (const state of (qc.multiple_initial_states || [])) {
    issues.push(buildIssue(
      CODES.QUALITY_MULTIPLE_INITIAL_STATES,
      `State '${state}' is an additional initial state — the flow has multiple entry points.`,
      { location: state, suggestion: "Consolidate into a single initial state if possible." }
    ));
  }

  // Quality: duplicate transitions
  for (const dup of (qc.duplicate_transitions || [])) {
    issues.push(buildIssue(
      CODES.QUALITY_DUPLICATE_TRANSITIONS,
      `Duplicate transition from '${dup.from}' to '${dup.to}' (count: ${dup.count}).`,
      { location: `${dup.from} → ${dup.to}`, suggestion: "Remove redundant transition entries." }
    ));
  }

  // Quality: duplicate operationIds
  for (const dup of (qc.duplicate_operation_ids || [])) {
    issues.push(buildIssue(
      CODES.QUALITY_DUPLICATE_OPERATION_IDS,
      `OpenAPI operationId '${dup.operation_id}' is duplicated across endpoints: ${dup.endpoints.join(", ")}.`,
      {
        location: dup.operation_id,
        suggestion: `Rename each duplicated operationId to a unique value. For example, include the resource or action name instead of reusing '${dup.operation_id}'.`,
        details: { operation_id: dup.operation_id, endpoints: dup.endpoints },
      }
    ));
  }

  // Quality: non-terminating states
  for (const state of (qc.non_terminating_states || [])) {
    issues.push(buildIssue(
      CODES.QUALITY_NON_TERMINATING_STATES,
      `State '${state}' has no path to a terminal state.`,
      { location: state, suggestion: "Add a transition from this state to a terminal state." }
    ));
  }

  // Quality: invalid operation references
  for (const ref of (qc.invalid_operation_references || [])) {
    issues.push(buildIssue(
      CODES.QUALITY_INVALID_OPERATION_REF,
      `Transition in '${ref.declared_in}' references unknown operationId '${ref.operation_id}' (type: ${ref.type}).`,
      {
        location: ref.declared_in,
        suggestion: `Check that '${ref.operation_id}' is defined in the OpenAPI spec with an operationId.`,
        details: { operation_id: ref.operation_id, ref_type: ref.type },
      }
    ));
  }

  // Quality: invalid field references
  for (const ref of (qc.invalid_field_refs || qc.invalid_field_references || [])) {
    if (!ref) continue;
    issues.push(buildIssue(
      CODES.QUALITY_INVALID_FIELD_REF,
      typeof ref === "string"
        ? `Invalid field reference: ${ref}`
        : `Invalid field reference '${ref.ref || ref.message}' in '${ref.endpoint || ref.declared_in || "unknown"}'.`,
      { suggestion: "Verify the field path and operationId in the field reference." }
    ));
  }

  // Semantic warnings
  for (const warning of (qc.semantic_warnings || [])) {
    const isAmbiguous = warning.includes("ambiguous state variants") || warning.includes("ambiguous transition");
    const def = isAmbiguous ? CODES.QUALITY_SEMANTIC_AMBIGUOUS_VARIANTS : CODES.QUALITY_SEMANTIC_INCONSISTENT_NAMING;
    issues.push(buildIssue(
      def,
      warning,
      { suggestion: "Adopt a single consistent naming convention for all state names (e.g. UPPER_SNAKE_CASE)." }
    ));
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Quality report
// ---------------------------------------------------------------------------

/**
 * Compute a quality score and structured report from a validation result.
 *
 * @param {object} result - Result returned by `run()`.
 * @param {{ semantic?: boolean }} [options]
 * @returns {object} Quality report with score, grade, issues, suggestions, breakdown.
 */
function computeQualityReport(result, options = {}) {
  const semantic = options.semantic === true;
  const issues = result.issues && result.issues.length > 0 ? result.issues : buildStructuredIssues(result);
  const flowCount = result.flowCount || 0;

  // ── Schema score (weight 40 pts) ────────────────────────────────────────
  const schemaErrors = (result.schemaFailures || []).length;
  const schemaScore = flowCount === 0 ? 100 : Math.max(0, Math.round((1 - schemaErrors / flowCount) * 100));

  // ── Graph score (weight 30 pts) ──────────────────────────────────────────
  const gc = result.graphChecks || {};
  const graphChecksTotal = 4;
  let graphPassed = 0;
  if (!Array.isArray(gc.initial_states) || gc.initial_states.length > 0 || flowCount === 0) graphPassed += 1;
  if (!Array.isArray(gc.terminal_states) || gc.terminal_states.length > 0 || flowCount === 0) graphPassed += 1;
  if (!Array.isArray(gc.unreachable_states) || gc.unreachable_states.length === 0) graphPassed += 1;
  if (!gc.cycle || !gc.cycle.has_cycle) graphPassed += 1;
  const graphScore = Math.round((graphPassed / graphChecksTotal) * 100);

  // ── Quality score (weight 20 pts) ────────────────────────────────────────
  const qc = result.qualityChecks || {};
  const qualityIssueCount =
    (qc.multiple_initial_states || []).length +
    (qc.duplicate_transitions || []).length +
    (qc.non_terminating_states || []).length +
    (qc.invalid_operation_references || []).length +
    (qc.invalid_field_references || []).length;
  const qualityScore = flowCount === 0 ? 100 : Math.max(0, Math.round((1 - Math.min(1, qualityIssueCount / Math.max(1, flowCount))) * 100));

  // ── Semantic score (weight 10 pts) ───────────────────────────────────────
  const semanticIssueCount = semantic ? (qc.semantic_warnings || []).length : 0;
  const semanticScore = flowCount === 0 ? 100 : Math.max(0, Math.round((1 - Math.min(1, semanticIssueCount / Math.max(1, flowCount))) * 100));

  // ── Overall weighted score ───────────────────────────────────────────────
  const semanticWeight = semantic ? 0.10 : 0;
  const qualityWeight = semantic ? 0.20 : 0.25;
  const graphWeight = semantic ? 0.30 : 0.35;
  const schemaWeight = semantic ? 0.40 : 0.40;

  const weightedScore =
    schemaScore * schemaWeight +
    graphScore * graphWeight +
    qualityScore * qualityWeight +
    (semantic ? semanticScore * semanticWeight : 0);

  const score = Math.round(weightedScore);

  let grade;
  if (score >= 90) grade = "A";
  else if (score >= 80) grade = "B";
  else if (score >= 70) grade = "C";
  else if (score >= 60) grade = "D";
  else grade = "F";

  const suggestions = [...new Set(
    issues.map((issue) => issue.suggestion).filter(Boolean)
  )];

  const breakdown = {
    schema: {
      score: schemaScore,
      weight: Math.round(schemaWeight * 100),
      failed: schemaErrors,
      passed: flowCount - schemaErrors,
    },
    graph: {
      score: graphScore,
      weight: Math.round(graphWeight * 100),
      checks_passed: graphPassed,
      checks_total: graphChecksTotal,
    },
    quality: {
      score: qualityScore,
      weight: Math.round(qualityWeight * 100),
      issues: qualityIssueCount,
    },
  };

  if (semantic) {
    breakdown.semantic = {
      score: semanticScore,
      weight: Math.round(semanticWeight * 100),
      issues: semanticIssueCount,
    };
  }

  return {
    generated_at: new Date().toISOString(),
    path: result.path,
    profile: result.profile,
    score,
    grade,
    flow_count: flowCount,
    ok: result.ok,
    issues: issues.filter((issue) => semantic || issue.category !== "quality" || !issue.code.startsWith("XFLOW_W20")),
    suggestions,
    breakdown,
  };
}

// Allow the module to be required by tests without side-effects.
if (require.main === module) {
  const result = run(process.argv[2]);
  process.exit(result.ok ? 0 : 1);
}

module.exports = {
  loadApi,
  extractFlows,
  validateFlows,
  detectOrphanStates,
  buildStateGraph,
  detectDuplicateOperationIds,
  detectDuplicateTransitions,
  detectInvalidOperationReferences,
  detectTerminalCoverage,
  detectSemanticModelingWarnings,
  detectTransitionDeterminismIssues,
  buildStructuredIssues,
  computeQualityReport,
  run,
};
