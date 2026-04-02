#!/usr/bin/env node
"use strict";

/**
 * x-openapi-flow MCP Server
 *
 * Implements the Model Context Protocol (MCP) over stdio using JSON-RPC 2.0.
 * Exposes x-openapi-flow CLI commands as tools that AI agents can call directly.
 *
 * Protocol reference: https://spec.modelcontextprotocol.io/
 * Transport: stdio (line-delimited JSON, one message per line)
 */

const { spawnSync } = require("child_process");
const path = require("path");

const pkg = require("../package.json");

const CLI_PATH = path.join(__dirname, "../bin/x-openapi-flow.js");
const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "x-openapi-flow", version: pkg.version };

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: "validate",
    description:
      "Validate an OpenAPI flow file against the x-openapi-flow schema and lifecycle rules. " +
      "Returns a structured result with ok status, errors by category (schema, orphan states, " +
      "unreachable states, cycles, invalid refs, quality), quality score, and grade. " +
      "Use profile 'strict' for release gates and CI.",
    inputSchema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          description:
            "Absolute path to the .flow.yaml/json or OpenAPI file with x-openapi-flow extensions.",
        },
        profile: {
          type: "string",
          enum: ["core", "relaxed", "strict"],
          description:
            "Validation profile. 'core' = fast baseline, 'relaxed' = graph checks without strict enforcement, " +
            "'strict' = full graph soundness including initial/terminal/reachability/cycle checks. Default: strict.",
        },
        strict_quality: {
          type: "boolean",
          description: "Treat quality warnings as blocking errors. Default: false.",
        },
        semantic: {
          type: "boolean",
          description:
            "Enable semantic consistency validation: decision intent, evidence refs, transition priority. Default: false.",
        },
      },
      required: ["file"],
    },
  },
  {
    name: "lint",
    description:
      "Run structural lint rules on an OpenAPI flow file. " +
      "Checks: duplicate operationIds, invalid next_operation_id references, " +
      "invalid prerequisite_operation_ids, duplicate transitions, non-terminating states. " +
      "Returns issues grouped by rule with per-issue detail.",
    inputSchema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          description: "Absolute path to the OpenAPI or .flow file.",
        },
        semantic: {
          type: "boolean",
          description:
            "Enable semantic lint rules: decision_rule_clarity, evidence_refs_for_decisions, " +
            "transition_priority_determinism. Default: false.",
        },
      },
      required: ["file"],
    },
  },
  {
    name: "graph",
    description:
      "Generate a Mermaid stateDiagram-v2 diagram of the lifecycle state machine from an OpenAPI flow file. " +
      "Returns the mermaid block suitable for embedding in docs or visualizing in any Mermaid-compatible viewer.",
    inputSchema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          description: "Absolute path to the OpenAPI or .flow file.",
        },
      },
      required: ["file"],
    },
  },
  {
    name: "diff",
    description:
      "Compute the lifecycle diff between a base OpenAPI file and a sidecar file (.x.yaml/json). " +
      "Returns added, changed, and removed operations with before/after flow metadata. " +
      "Use before apply to review what changes will be merged.",
    inputSchema: {
      type: "object",
      properties: {
        openapi_file: {
          type: "string",
          description: "Absolute path to the base OpenAPI file (openapi.yaml/json).",
        },
        flows_file: {
          type: "string",
          description: "Absolute path to the sidecar file ({context}.x.yaml/json).",
        },
      },
      required: ["openapi_file", "flows_file"],
    },
  },
  {
    name: "analyze",
    description:
      "Analyze a base OpenAPI file and infer a suggested sidecar (.x.yaml) with lifecycle states and transitions. " +
      "Returns the inferred sidecar structure and analysis metadata. " +
      "Use this to bootstrap sidecar authoring before an AI refines it manually.",
    inputSchema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          description: "Absolute path to the base OpenAPI file (openapi.yaml/json).",
        },
      },
      required: ["file"],
    },
  },
  {
    name: "quality_report",
    description:
      "Run the lifecycle quality report on an OpenAPI flow file. " +
      "Returns a structured score (0–100), grade (A–F), and breakdown by quality dimension: " +
      "completeness, field_coverage, semantic_depth, graph_soundness. " +
      "Use to track lifecycle documentation maturity before release.",
    inputSchema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          description: "Absolute path to the flow file.",
        },
        profile: {
          type: "string",
          enum: ["core", "relaxed", "strict"],
          description: "Validation profile. Default: strict.",
        },
        semantic: {
          type: "boolean",
          description: "Include semantic quality signals in the report. Default: false.",
        },
      },
      required: ["file"],
    },
  },
];

// ---------------------------------------------------------------------------
// CLI runner
// ---------------------------------------------------------------------------

function runCli(args) {
  const r = spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    stdout: r.stdout || "",
    stderr: r.stderr || "",
    status: r.status !== null ? r.status : 1,
    spawnError: r.error || null,
  };
}

// ---------------------------------------------------------------------------
// Tool handlers — each returns an MCP tool result { isError, content }
// ---------------------------------------------------------------------------

function okResult(text) {
  return { isError: false, content: [{ type: "text", text }] };
}

function errorResult(text) {
  return { isError: true, content: [{ type: "text", text }] };
}

function handleValidate(args) {
  if (!args.file) return errorResult("Missing required argument: file");
  const cliArgs = ["validate", args.file, "--format", "json"];
  if (args.profile) cliArgs.push("--profile", args.profile);
  if (args.strict_quality) cliArgs.push("--strict-quality");
  if (args.semantic) cliArgs.push("--semantic");

  const r = runCli(cliArgs);
  if (r.spawnError) return errorResult(`Failed to spawn CLI: ${r.spawnError.message}`);

  try {
    const parsed = JSON.parse(r.stdout);
    return okResult(JSON.stringify(parsed, null, 2));
  } catch {
    return errorResult(
      `validate produced unexpected output.\nstdout: ${r.stdout.slice(0, 500)}\nstderr: ${r.stderr.slice(0, 500)}`
    );
  }
}

function handleLint(args) {
  if (!args.file) return errorResult("Missing required argument: file");
  const cliArgs = ["lint", args.file, "--format", "json"];
  if (args.semantic) cliArgs.push("--semantic");

  const r = runCli(cliArgs);
  if (r.spawnError) return errorResult(`Failed to spawn CLI: ${r.spawnError.message}`);

  try {
    const parsed = JSON.parse(r.stdout);
    return okResult(JSON.stringify(parsed, null, 2));
  } catch {
    return errorResult(
      `lint produced unexpected output.\nstdout: ${r.stdout.slice(0, 500)}\nstderr: ${r.stderr.slice(0, 500)}`
    );
  }
}

function handleGraph(args) {
  if (!args.file) return errorResult("Missing required argument: file");

  const r = runCli(["graph", args.file]);
  if (r.spawnError) return errorResult(`Failed to spawn CLI: ${r.spawnError.message}`);
  if (r.status !== 0) {
    return errorResult(`graph failed (exit ${r.status}):\n${r.stderr.slice(0, 1000)}`);
  }
  return okResult(r.stdout);
}

function handleDiff(args) {
  if (!args.openapi_file) return errorResult("Missing required argument: openapi_file");
  if (!args.flows_file) return errorResult("Missing required argument: flows_file");

  const r = runCli(["diff", args.openapi_file, "--flows", args.flows_file, "--format", "json"]);
  if (r.spawnError) return errorResult(`Failed to spawn CLI: ${r.spawnError.message}`);

  try {
    const parsed = JSON.parse(r.stdout);
    return okResult(JSON.stringify(parsed, null, 2));
  } catch {
    if (r.status !== 0) {
      return errorResult(`diff failed (exit ${r.status}):\n${r.stderr.slice(0, 1000)}`);
    }
    return okResult(r.stdout);
  }
}

function handleAnalyze(args) {
  if (!args.file) return errorResult("Missing required argument: file");

  const r = runCli(["analyze", args.file, "--format", "json"]);
  if (r.spawnError) return errorResult(`Failed to spawn CLI: ${r.spawnError.message}`);
  if (r.status !== 0) {
    return errorResult(`analyze failed (exit ${r.status}):\n${r.stderr.slice(0, 1000)}`);
  }

  try {
    const parsed = JSON.parse(r.stdout);
    return okResult(JSON.stringify(parsed, null, 2));
  } catch {
    return okResult(r.stdout);
  }
}

function handleQualityReport(args) {
  if (!args.file) return errorResult("Missing required argument: file");
  const cliArgs = ["quality-report", args.file];
  if (args.profile) cliArgs.push("--profile", args.profile);
  if (args.semantic) cliArgs.push("--semantic");

  const r = runCli(cliArgs);
  if (r.spawnError) return errorResult(`Failed to spawn CLI: ${r.spawnError.message}`);

  try {
    const parsed = JSON.parse(r.stdout);
    return okResult(JSON.stringify(parsed, null, 2));
  } catch {
    return errorResult(
      `quality-report produced unexpected output.\nstdout: ${r.stdout.slice(0, 500)}\nstderr: ${r.stderr.slice(0, 500)}`
    );
  }
}

const TOOL_HANDLERS = {
  validate: handleValidate,
  lint: handleLint,
  graph: handleGraph,
  diff: handleDiff,
  analyze: handleAnalyze,
  quality_report: handleQualityReport,
};

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 / MCP protocol
// ---------------------------------------------------------------------------

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function handleMessage(msg) {
  if (!msg || msg.jsonrpc !== "2.0") return;

  // Notifications (no id field) — no response
  if (msg.id === undefined || msg.id === null) return;

  const { id, method, params } = msg;

  if (method === "initialize") {
    send({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      },
    });
    return;
  }

  if (method === "ping") {
    send({ jsonrpc: "2.0", id, result: {} });
    return;
  }

  if (method === "tools/list") {
    send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    return;
  }

  if (method === "tools/call") {
    const toolName = params && params.name;
    const toolArgs = (params && params.arguments) || {};
    const handler = TOOL_HANDLERS[toolName];
    if (!handler) {
      send({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Tool not found: ${toolName}` },
      });
      return;
    }
    const toolResult = handler(toolArgs);
    send({ jsonrpc: "2.0", id, result: toolResult });
    return;
  }

  send({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}

// ---------------------------------------------------------------------------
// Stdio transport
// ---------------------------------------------------------------------------

function start() {
  let buffer = "";

  process.stdin.setEncoding("utf8");

  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep the incomplete trailing fragment
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        handleMessage(msg);
      } catch {
        // discard malformed lines silently
      }
    }
  });

  process.stdin.on("end", () => {
    const trimmed = buffer.trim();
    if (trimmed) {
      try {
        const msg = JSON.parse(trimmed);
        handleMessage(msg);
      } catch {
        // ignore
      }
    }
  });
}

module.exports = { start, TOOLS, SERVER_INFO, PROTOCOL_VERSION };
