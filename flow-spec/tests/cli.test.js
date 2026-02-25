"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const FLOW_SPEC_ROOT = path.resolve(__dirname, "..");
const CLI_PATH = path.resolve(FLOW_SPEC_ROOT, "bin", "x-openapi-flow.js");

function runCli(args, options = {}) {
  const result = spawnSync("node", [CLI_PATH, ...args], {
    cwd: options.cwd || FLOW_SPEC_ROOT,
    encoding: "utf8",
    env: { ...process.env, ...(options.env || {}) },
  });

  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

test("validate strict succeeds on known good example", () => {
  const result = runCli(["validate", "examples/order-api.yaml", "--profile", "strict"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /All validations passed/);
});

test("validate fails for missing required version with fix suggestion", () => {
  const result = runCli([
    "validate",
    "tests/fixtures/missing-version.yaml",
    "--profile",
    "strict",
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Schema validation FAILED/);
  assert.match(result.stderr, /Add `version: "1.0"` to the x-openapi-flow object/);
});

test("relaxed profile allows cycle example with warning", () => {
  const result = runCli([
    "validate",
    "examples/non-terminating-api.yaml",
    "--profile",
    "relaxed",
  ]);

  assert.equal(result.status, 0);
  assert.match(result.stderr, /Graph warning — cycle detected/);
});

test("strict-quality turns quality warnings into failure", () => {
  const result = runCli([
    "validate",
    "examples/quality-warning-api.yaml",
    "--strict-quality",
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Quality check FAILED \(strict\)/);
});

test("graph command prints mermaid output", () => {
  const result = runCli(["graph", "examples/order-api.yaml"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^stateDiagram-v2/m);
  assert.match(result.stdout, /CREATED --> CONFIRMED/);
});

test("doctor command runs successfully", () => {
  const result = runCli(["doctor"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /x-openapi-flow doctor/);
  assert.match(result.stdout, /Validator engine: OK/);
});

test("init succeeds with explicit existing OpenAPI file", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-init-explicit-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Init API\n  version: "1.0.0"\npaths:\n  /items:\n    get:\n      operationId: listItems\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    const result = runCli(["init", openapiPath]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Using existing OpenAPI file:/);
    assert.match(result.stdout, /Flows sidecar synced:/);
    assert.match(result.stdout, /Tracked operations: 1/);
    assert.match(result.stdout, /Validate now: x-openapi-flow validate/);

    const sidecarPath = path.join(tempDir, "x-openapi-flow.flows.yaml");
    const sidecarContent = fs.readFileSync(sidecarPath, "utf8");
    assert.match(sidecarContent, /operationId:listItems/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("init auto-discovers openapi file in current project", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-init-discover-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Discover API\n  version: "1.0.0"\npaths:\n  /health:\n    get:\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    const result = runCli(["init"], { cwd: tempDir });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Using existing OpenAPI file:/);
    assert.match(result.stdout, /Flows sidecar synced:/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("init preserves sidecar x-openapi-flow and apply injects into regenerated OpenAPI", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-sidecar-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const sidecarPath = path.join(tempDir, "x-openapi-flow.flows.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Sidecar API\n  version: "1.0.0"\npaths:\n  /orders/{id}:\n    get:\n      operationId: getOrder\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    const firstInit = runCli(["init", openapiPath]);
    assert.equal(firstInit.status, 0);

    fs.writeFileSync(
      sidecarPath,
      `version: '1.0'\noperations:\n  - key: operationId:getOrder\n    operationId: getOrder\n    method: get\n    path: /orders/{id}\n    x-openapi-flow:\n      version: '1.0'\n      id: getOrderFlow\n      current_state: CREATED\n      states: [CREATED, DONE]\n      transitions:\n        - from: CREATED\n          to: DONE\n          action: complete\n`,
      "utf8"
    );

    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Sidecar API\n  version: "1.0.1"\npaths:\n  /orders/{id}:\n    get:\n      operationId: getOrder\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    const apply = runCli(["apply", openapiPath]);
    assert.equal(apply.status, 0);
    assert.match(apply.stdout, /Applied x-openapi-flow entries: 1/);

    const updatedOpenApi = fs.readFileSync(openapiPath, "utf8");
    assert.match(updatedOpenApi, /x-openapi-flow:/);
    assert.match(updatedOpenApi, /id: getOrderFlow/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("init fails when no OpenAPI file exists", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-init-empty-"));

  try {
    const result = runCli(["init"], { cwd: tempDir });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Could not find an existing OpenAPI file/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("validate reads options from config file", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-config-"));
  const configPath = path.join(tempDir, "x-openapi-flow.config.json");

  try {
    fs.writeFileSync(
      configPath,
      JSON.stringify({ profile: "relaxed", format: "json", strictQuality: false }, null, 2),
      "utf8"
    );

    const result = runCli([
      "validate",
      path.resolve(FLOW_SPEC_ROOT, "examples/non-terminating-api.yaml"),
      "--config",
      configPath,
    ]);

    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /Validating:/);
    assert.match(result.stdout, /"profile": "relaxed"/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
