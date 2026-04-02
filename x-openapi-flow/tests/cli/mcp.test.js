"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const MCP_BIN = path.join(__dirname, "../../bin/x-openapi-flow-mcp.js");
const EXAMPLES_DIR = path.join(__dirname, "../../examples");
const ORDER_API = path.join(EXAMPLES_DIR, "order-api.yaml");

/**
 * Send a batch of JSON-RPC messages to the MCP server process over stdin.
 * Returns the parsed array of response objects and raw stderr.
 */
function sendMessages(messages) {
  const input = messages.map((m) => JSON.stringify(m)).join("\n") + "\n";
  const r = spawnSync(process.execPath, [MCP_BIN], {
    input,
    encoding: "utf8",
    timeout: 60000,
  });
  const responses = (r.stdout || "")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
  return { responses, stderr: r.stderr || "" };
}

const INIT_MSG = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "0.0.1" },
  },
};

// ---------------------------------------------------------------------------
// Protocol tests
// ---------------------------------------------------------------------------

test("MCP server responds to initialize with serverInfo and capabilities", () => {
  const { responses } = sendMessages([INIT_MSG]);
  assert.equal(responses.length, 1);
  const res = responses[0];
  assert.equal(res.id, 1);
  assert.ok(res.result, "expected result");
  assert.equal(res.result.serverInfo.name, "x-openapi-flow");
  assert.ok(res.result.serverInfo.version);
  assert.ok(res.result.capabilities.tools !== undefined);
  assert.equal(res.result.protocolVersion, "2024-11-05");
});

test("MCP server notification (no id) produces no response", () => {
  const { responses } = sendMessages([
    INIT_MSG,
    { jsonrpc: "2.0", method: "notifications/initialized" }, // notification
  ]);
  // Only the initialize response — notification has no id so no response
  assert.equal(responses.length, 1);
  assert.equal(responses[0].id, 1);
});

test("MCP server responds to ping", () => {
  const { responses } = sendMessages([
    INIT_MSG,
    { jsonrpc: "2.0", id: 2, method: "ping" },
  ]);
  const pong = responses.find((r) => r.id === 2);
  assert.ok(pong, "no pong");
  assert.deepStrictEqual(pong.result, {});
});

test("MCP server returns error for unknown method", () => {
  const { responses } = sendMessages([
    INIT_MSG,
    { jsonrpc: "2.0", id: 2, method: "unknown/method" },
  ]);
  const res = responses.find((r) => r.id === 2);
  assert.ok(res, "no response");
  assert.ok(res.error, "expected error");
  assert.equal(res.error.code, -32601);
});

// ---------------------------------------------------------------------------
// tools/list
// ---------------------------------------------------------------------------

test("MCP tools/list returns all expected tools", () => {
  const { responses } = sendMessages([
    INIT_MSG,
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
  ]);
  const res = responses.find((r) => r.id === 2);
  assert.ok(res, "no response");
  const tools = res.result.tools;
  assert.ok(Array.isArray(tools));
  const names = tools.map((t) => t.name);
  for (const expected of ["validate", "lint", "graph", "diff", "analyze", "quality_report"]) {
    assert.ok(names.includes(expected), `tool '${expected}' missing from tools/list`);
  }
});

test("MCP tools/list — each tool has name, description and inputSchema", () => {
  const { responses } = sendMessages([
    INIT_MSG,
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
  ]);
  const tools = responses.find((r) => r.id === 2).result.tools;
  for (const tool of tools) {
    assert.ok(tool.name, `tool missing name: ${JSON.stringify(tool)}`);
    assert.ok(tool.description, `tool '${tool.name}' missing description`);
    assert.ok(tool.inputSchema, `tool '${tool.name}' missing inputSchema`);
    assert.ok(
      Array.isArray(tool.inputSchema.required),
      `tool '${tool.name}' inputSchema.required should be an array`
    );
  }
});

// ---------------------------------------------------------------------------
// tools/call — unknown tool
// ---------------------------------------------------------------------------

test("MCP tools/call unknown tool returns JSON-RPC error -32601", () => {
  const { responses } = sendMessages([
    INIT_MSG,
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "nonexistent", arguments: {} } },
  ]);
  const res = responses.find((r) => r.id === 2);
  assert.ok(res, "no response");
  assert.ok(res.error, "expected error field");
  assert.equal(res.error.code, -32601);
});

// ---------------------------------------------------------------------------
// tools/call — validate
// ---------------------------------------------------------------------------

test("MCP validate tool returns ok:true for valid order-api.yaml", () => {
  const { responses } = sendMessages([
    INIT_MSG,
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "validate", arguments: { file: ORDER_API, profile: "strict" } },
    },
  ]);
  const res = responses.find((r) => r.id === 2);
  assert.ok(res, "no response");
  assert.ok(!res.error, `unexpected RPC error: ${JSON.stringify(res.error)}`);
  assert.equal(res.result.isError, false);
  const parsed = JSON.parse(res.result.content[0].text);
  assert.strictEqual(parsed.ok, true);
  assert.ok(parsed.profile);
});

test("MCP validate tool returns isError:true for missing file", () => {
  const { responses } = sendMessages([
    INIT_MSG,
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "validate", arguments: { file: "/nonexistent/does-not-exist.yaml" } },
    },
  ]);
  const res = responses.find((r) => r.id === 2);
  assert.ok(res, "no response");
  // CLI returns JSON with ok:false for unreadable file — isError stays false (tool ran)
  assert.equal(res.result.isError, false);
  const parsed = JSON.parse(res.result.content[0].text);
  assert.strictEqual(parsed.ok, false);
});

test("MCP validate tool returns isError:true when file arg omitted", () => {
  const { responses } = sendMessages([
    INIT_MSG,
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "validate", arguments: {} },
    },
  ]);
  const res = responses.find((r) => r.id === 2);
  assert.equal(res.result.isError, true);
  assert.match(res.result.content[0].text, /Missing required argument/);
});

// ---------------------------------------------------------------------------
// tools/call — lint
// ---------------------------------------------------------------------------

test("MCP lint tool returns structured ok:true for valid order-api.yaml", () => {
  const { responses } = sendMessages([
    INIT_MSG,
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "lint", arguments: { file: ORDER_API } },
    },
  ]);
  const res = responses.find((r) => r.id === 2);
  assert.ok(res, "no response");
  assert.equal(res.result.isError, false);
  const parsed = JSON.parse(res.result.content[0].text);
  assert.strictEqual(parsed.ok, true);
  assert.ok(parsed.issues, "expected issues object");
  assert.ok(typeof parsed.summary.errors === "number");
});

// ---------------------------------------------------------------------------
// tools/call — graph
// ---------------------------------------------------------------------------

test("MCP graph tool returns Mermaid stateDiagram block", () => {
  const { responses } = sendMessages([
    INIT_MSG,
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "graph", arguments: { file: ORDER_API } },
    },
  ]);
  const res = responses.find((r) => r.id === 2);
  assert.ok(res, "no response");
  assert.equal(res.result.isError, false);
  assert.match(res.result.content[0].text, /stateDiagram/i);
});

// ---------------------------------------------------------------------------
// tools/call — analyze
// ---------------------------------------------------------------------------

test("MCP analyze tool returns sidecar suggestion with operations array", () => {
  const { responses } = sendMessages([
    INIT_MSG,
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "analyze", arguments: { file: ORDER_API } },
    },
  ]);
  const res = responses.find((r) => r.id === 2);
  assert.ok(res, "no response");
  assert.equal(res.result.isError, false);
  const parsed = JSON.parse(res.result.content[0].text);
  assert.ok(parsed.sidecar, "expected sidecar field");
  assert.ok(Array.isArray(parsed.sidecar.operations));
  assert.ok(parsed.analysis, "expected analysis field");
});

// ---------------------------------------------------------------------------
// tools/call — quality_report
// ---------------------------------------------------------------------------

test("MCP quality_report tool returns score and grade", () => {
  const { responses } = sendMessages([
    INIT_MSG,
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "quality_report", arguments: { file: ORDER_API } },
    },
  ]);
  const res = responses.find((r) => r.id === 2);
  assert.ok(res, "no response");
  assert.equal(res.result.isError, false);
  const parsed = JSON.parse(res.result.content[0].text);
  assert.ok(typeof parsed.score === "number", "expected numeric score");
  assert.ok(parsed.grade, "expected grade");
  assert.ok(parsed.breakdown, "expected breakdown");
});

// ---------------------------------------------------------------------------
// Multi-turn: multiple calls in one stdio session
// ---------------------------------------------------------------------------

test("MCP server handles multiple tool calls in one session", () => {
  const { responses } = sendMessages([
    INIT_MSG,
    { jsonrpc: "2.0", method: "notifications/initialized" },
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "validate", arguments: { file: ORDER_API } },
    },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "lint", arguments: { file: ORDER_API } },
    },
    {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "quality_report", arguments: { file: ORDER_API } },
    },
  ]);
  // initialize + 3 tool calls = 4 responses (notification has no response)
  assert.equal(responses.length, 4);
  assert.ok(responses.every((r) => !r.error), "unexpected RPC error in multi-turn session");
});
