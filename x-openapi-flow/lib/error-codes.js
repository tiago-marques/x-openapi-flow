"use strict";

// ---------------------------------------------------------------------------
// x-openapi-flow Stable Error & Warning Code Registry
//
// Codes are organized by category:
//   XFLOW_E0xx  – Schema validation errors
//   XFLOW_E1xx  – Graph validation errors
//   XFLOW_W2xx  – Quality check warnings
//   XFLOW_L3xx  – Lint rule violations
//   XFLOW_RT4xx – Runtime guard errors
//   XFLOW_CLI5xx – CLI / argument errors
//
// All codes are stable across releases. New codes are only appended.
// ---------------------------------------------------------------------------

const CODES = {
  // ── Schema ──────────────────────────────────────────────────────────────
  /** x-openapi-flow payload failed JSON Schema validation. */
  SCHEMA_VALIDATION_FAILED: {
    code: "XFLOW_E001",
    category: "schema",
    severity: "error",
    title: "Schema validation failed",
  },
  /** Required field is missing from the x-openapi-flow object. */
  SCHEMA_MISSING_REQUIRED: {
    code: "XFLOW_E002",
    category: "schema",
    severity: "error",
    title: "Missing required field",
  },
  /** Unknown property found in x-openapi-flow payload. */
  SCHEMA_ADDITIONAL_PROPERTY: {
    code: "XFLOW_E003",
    category: "schema",
    severity: "error",
    title: "Additional property not allowed",
  },
  /** Field value is not in the allowed enum set. */
  SCHEMA_INVALID_ENUM: {
    code: "XFLOW_E004",
    category: "schema",
    severity: "error",
    title: "Invalid enum value",
  },

  // ── Graph ────────────────────────────────────────────────────────────────
  /** No initial state (indegree = 0) detected in the flow graph. */
  GRAPH_NO_INITIAL_STATE: {
    code: "XFLOW_E101",
    category: "graph",
    severity: "error",
    title: "No initial state detected",
  },
  /** No terminal state (outdegree = 0) detected in the flow graph. */
  GRAPH_NO_TERMINAL_STATE: {
    code: "XFLOW_E102",
    category: "graph",
    severity: "error",
    title: "No terminal state detected",
  },
  /** One or more states are unreachable from any initial state. */
  GRAPH_UNREACHABLE_STATES: {
    code: "XFLOW_E103",
    category: "graph",
    severity: "error",
    title: "Unreachable state(s) detected",
  },
  /** A cycle was detected in the flow graph (strict profile fails on cycles). */
  GRAPH_CYCLE_DETECTED: {
    code: "XFLOW_E104",
    category: "graph",
    severity: "error",
    title: "Cycle detected in flow graph",
  },
  /** States referenced in transitions but not defined as current_state ancestors. */
  GRAPH_ORPHAN_STATES: {
    code: "XFLOW_E105",
    category: "graph",
    severity: "error",
    title: "Orphan states detected",
  },

  // ── Quality ──────────────────────────────────────────────────────────────
  /** More than one flow has no incoming transitions (multiple starting points). */
  QUALITY_MULTIPLE_INITIAL_STATES: {
    code: "XFLOW_W201",
    category: "quality",
    severity: "warning",
    title: "Multiple initial states",
  },
  /** Two or more transitions from the same state to the same target are identical. */
  QUALITY_DUPLICATE_TRANSITIONS: {
    code: "XFLOW_W202",
    category: "quality",
    severity: "warning",
    title: "Duplicate transitions",
  },
  /** A state exists that has no outgoing path to any terminal state. */
  QUALITY_NON_TERMINATING_STATES: {
    code: "XFLOW_W203",
    category: "quality",
    severity: "warning",
    title: "Non-terminating states",
  },
  /** A transition references an operationId that is not defined in the API spec. */
  QUALITY_INVALID_OPERATION_REF: {
    code: "XFLOW_W204",
    category: "quality",
    severity: "warning",
    title: "Invalid operation reference in transition",
  },
  /** A field reference in a transition cannot be resolved against the API schema. */
  QUALITY_INVALID_FIELD_REF: {
    code: "XFLOW_W205",
    category: "quality",
    severity: "warning",
    title: "Invalid field reference in transition",
  },
  /** State names use inconsistent naming conventions (e.g. mix of snake_case and camelCase). */
  QUALITY_SEMANTIC_INCONSISTENT_NAMING: {
    code: "XFLOW_W206",
    category: "quality",
    severity: "warning",
    title: "Inconsistent state naming style",
  },
  /** Different capitalisation variants resolve to the same canonical state name. */
  QUALITY_SEMANTIC_AMBIGUOUS_VARIANTS: {
    code: "XFLOW_W207",
    category: "quality",
    severity: "warning",
    title: "Ambiguous state name variants",
  },

  // ── Lint ─────────────────────────────────────────────────────────────────
  /** next_operation_id references an operationId that does not exist. */
  LINT_NEXT_OPERATION_ID_EXISTS: {
    code: "XFLOW_L301",
    category: "lint",
    severity: "error",
    title: "next_operation_id references unknown operation",
  },
  /** prerequisite_operation_ids references one or more operationIds that do not exist. */
  LINT_PREREQUISITE_OPERATION_IDS_EXIST: {
    code: "XFLOW_L302",
    category: "lint",
    severity: "error",
    title: "prerequisite_operation_ids references unknown operation",
  },
  /** Duplicate transitions violate lint rule. */
  LINT_DUPLICATE_TRANSITIONS: {
    code: "XFLOW_L303",
    category: "lint",
    severity: "error",
    title: "Duplicate transitions (lint)",
  },
  /** State(s) cannot reach any terminal state, violating the terminal_path lint rule. */
  LINT_TERMINAL_PATH: {
    code: "XFLOW_L304",
    category: "lint",
    severity: "error",
    title: "No terminal path from state",
  },
  /** Semantic naming consistency issues detected in flow state names. */
  LINT_SEMANTIC_CONSISTENCY: {
    code: "XFLOW_L305",
    category: "lint",
    severity: "error",
    title: "Semantic modeling inconsistency",
  },

  // ── Runtime ──────────────────────────────────────────────────────────────
  /** Request blocked because the resource is not in a state that allows this operation. */
  RUNTIME_INVALID_STATE_TRANSITION: {
    code: "XFLOW_RT401",
    category: "runtime",
    severity: "error",
    title: "Invalid state transition blocked",
    httpStatus: 409,
    legacyCode: "INVALID_STATE_TRANSITION",
  },
  /** Runtime guard cannot resolve an operation for the incoming request. */
  RUNTIME_UNKNOWN_OPERATION: {
    code: "XFLOW_RT402",
    category: "runtime",
    severity: "error",
    title: "Unknown operation",
    httpStatus: 500,
    legacyCode: "UNKNOWN_OPERATION",
  },
  /** Runtime guard is configured without a getCurrentState callback. */
  RUNTIME_MISSING_STATE_RESOLVER: {
    code: "XFLOW_RT403",
    category: "runtime",
    severity: "error",
    title: "Missing state resolver",
    httpStatus: 500,
    legacyCode: "MISSING_STATE_RESOLVER",
  },
  /** Runtime guard cannot determine the resource id for the incoming request. */
  RUNTIME_MISSING_RESOURCE_ID: {
    code: "XFLOW_RT404",
    category: "runtime",
    severity: "error",
    title: "Missing resource id",
    httpStatus: 400,
    legacyCode: "MISSING_RESOURCE_ID",
  },

  // ── CLI ──────────────────────────────────────────────────────────────────
  /** OpenAPI or sidecar file could not be found at the specified path. */
  CLI_FILE_NOT_FOUND: {
    code: "XFLOW_CLI501",
    category: "cli",
    severity: "error",
    title: "File not found",
  },
  /** OpenAPI or sidecar file could not be parsed (invalid YAML/JSON). */
  CLI_PARSE_ERROR: {
    code: "XFLOW_CLI502",
    category: "cli",
    severity: "error",
    title: "File parse error",
  },
  /** Invalid or missing CLI argument. */
  CLI_INVALID_ARGS: {
    code: "XFLOW_CLI503",
    category: "cli",
    severity: "error",
    title: "Invalid arguments",
  },
};

/**
 * Build a structured diagnostic issue object suitable for JSON output.
 *
 * @param {object} def  - A CODES entry.
 * @param {string} [message] - Human-readable detail message.
 * @param {object} [opts]
 * @param {string} [opts.location] - Operation endpoint or state label.
 * @param {string} [opts.suggestion] - Actionable fix text.
 * @param {object} [opts.details] - Extra machine-readable fields.
 * @returns {{ code: string, category: string, severity: string, title: string, message: string, location?: string, suggestion?: string }}
 */
function buildIssue(def, message, { location, suggestion, details } = {}) {
  const issue = {
    code: def.code,
    category: def.category,
    severity: def.severity,
    title: def.title,
    message: message || def.title,
  };

  if (location != null) {
    issue.location = location;
  }

  if (suggestion != null) {
    issue.suggestion = suggestion;
  }

  if (details && typeof details === "object") {
    Object.assign(issue, details);
  }

  return issue;
}

/**
 * Look up a CODES entry by its short key (e.g. "SCHEMA_VALIDATION_FAILED") or
 * by stable code string (e.g. "XFLOW_E001").
 *
 * @param {string} keyOrCode
 * @returns {object|null}
 */
function lookup(keyOrCode) {
  if (CODES[keyOrCode]) {
    return CODES[keyOrCode];
  }

  return Object.values(CODES).find((entry) => entry.code === keyOrCode) || null;
}

module.exports = {
  CODES,
  buildIssue,
  lookup,
};
