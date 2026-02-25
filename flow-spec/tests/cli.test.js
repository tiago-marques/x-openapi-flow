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
    input: options.input,
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

test("graph command accepts sidecar file", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-graph-sidecar-"));
  const sidecarPath = path.join(tempDir, "openapi-openapi-flow.yaml");

  try {
    fs.writeFileSync(
      sidecarPath,
      `version: '1.0'\noperations:\n  - operationId: createOrder\n    x-openapi-flow:\n      version: '1.0'\n      id: create-order\n      current_state: CREATED\n      transitions:\n        - trigger_type: synchronous\n          condition: ok\n          target_state: PAID\n          next_operation_id: payOrder\n`,
      "utf8"
    );

    const result = runCli(["graph", sidecarPath]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^stateDiagram-v2/m);
    assert.match(result.stdout, /CREATED --> PAID/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
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

    const sidecarPath = path.join(tempDir, "openapi-openapi-flow.yaml");
    const sidecarContent = fs.readFileSync(sidecarPath, "utf8");
    assert.match(sidecarContent, /operationId: listItems/);

    const flowOutputPath = path.join(tempDir, "openapi.flow.yaml");
    assert.equal(fs.existsSync(flowOutputPath), true);
    const flowOutputContent = fs.readFileSync(flowOutputPath, "utf8");
    assert.match(flowOutputContent, /x-openapi-flow:/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("init fails in non-interactive mode when flow output exists", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-init-existing-flow-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const flowOutputPath = path.join(tempDir, "openapi.flow.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Existing Flow API\n  version: "1.0.0"\npaths:\n  /items:\n    get:\n      operationId: listItems\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    fs.writeFileSync(flowOutputPath, "# existing flow output\n", "utf8");

    const result = runCli(["init", openapiPath]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Flow output already exists/);
    assert.match(result.stderr, /Use `x-openapi-flow apply` to update/);

    const flowContent = fs.readFileSync(flowOutputPath, "utf8");
    assert.equal(flowContent, "# existing flow output\n");
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
  const sidecarPath = path.join(tempDir, "openapi-openapi-flow.yaml");

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
      `version: '1.0'\noperations:\n  - operationId: getOrder\n    x-openapi-flow:\n      version: '1.0'\n      id: getOrderFlow\n      current_state: CREATED\n      states: [CREATED, DONE]\n      transitions:\n        - from: CREATED\n          to: DONE\n          action: complete\n`,
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
    assert.match(apply.stdout, /Output written to:/);

    const updatedOpenApi = fs.readFileSync(path.join(tempDir, "openapi.flow.yaml"), "utf8");
    assert.match(updatedOpenApi, /x-openapi-flow:/);
    assert.match(updatedOpenApi, /id: getOrderFlow/);

    const sourceOpenApi = fs.readFileSync(openapiPath, "utf8");
    assert.doesNotMatch(sourceOpenApi, /x-openapi-flow:/);
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

test("init creates fallback operationId for operations without operationId", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-init-fallback-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Fallback API\n  version: "1.0.0"\npaths:\n  /health:\n    get:\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    const result = runCli(["init", openapiPath]);
    assert.equal(result.status, 0);

    const sidecarPath = path.join(tempDir, "openapi-openapi-flow.yaml");
    const sidecarContent = fs.readFileSync(sidecarPath, "utf8");
    assert.match(sidecarContent, /operationId: get_health/);
    assert.match(sidecarContent, /id: get_health/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("apply injects flow for operation without operationId using fallback operationId", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-apply-fallback-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const sidecarPath = path.join(tempDir, "openapi-openapi-flow.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Fallback Apply API\n  version: "1.0.0"\npaths:\n  /health:\n    get:\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    fs.writeFileSync(
      sidecarPath,
      `version: '1.0'\noperations:\n  - operationId: get_health\n    x-openapi-flow:\n      version: '1.0'\n      id: healthFlow\n      current_state: READY\n      transitions: []\n`,
      "utf8"
    );

    const apply = runCli(["apply", openapiPath]);
    assert.equal(apply.status, 0);
    assert.match(apply.stdout, /Applied x-openapi-flow entries: 1/);

    const updatedOpenApi = fs.readFileSync(path.join(tempDir, "openapi.flow.yaml"), "utf8");
    assert.match(updatedOpenApi, /x-openapi-flow:/);
    assert.match(updatedOpenApi, /id: healthFlow/);

    const sourceOpenApi = fs.readFileSync(openapiPath, "utf8");
    assert.doesNotMatch(sourceOpenApi, /x-openapi-flow:/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("apply supports --in-place to preserve legacy behavior", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-apply-in-place-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const sidecarPath = path.join(tempDir, "openapi-openapi-flow.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: In Place API\n  version: "1.0.0"\npaths:\n  /health:\n    get:\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    fs.writeFileSync(
      sidecarPath,
      `version: '1.0'\noperations:\n  - operationId: get_health\n    x-openapi-flow:\n      version: '1.0'\n      id: healthFlow\n      current_state: READY\n      transitions: []\n`,
      "utf8"
    );

    const apply = runCli(["apply", openapiPath, "--in-place"]);
    assert.equal(apply.status, 0);
    assert.match(apply.stdout, /Applied x-openapi-flow entries: 1/);

    const updatedOpenApi = fs.readFileSync(openapiPath, "utf8");
    assert.match(updatedOpenApi, /x-openapi-flow:/);
    assert.match(updatedOpenApi, /id: healthFlow/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("apply accepts sidecar file as positional argument", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-apply-sidecar-positional-"));
  const openapiPath = path.join(tempDir, "swagger.json");
  const sidecarPath = path.join(tempDir, "examples", "order-openapi-flow.yaml");

  try {
    fs.mkdirSync(path.dirname(sidecarPath), { recursive: true });

    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Positional Sidecar API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: ok\n`,
      "utf8"
    );

    fs.writeFileSync(
      sidecarPath,
      `version: '1.0'\noperations:\n  - operationId: createOrder\n    x-openapi-flow:\n      version: '1.0'\n      id: create-order\n      current_state: CREATED\n      transitions: []\n`,
      "utf8"
    );

    const apply = runCli(["apply", "examples/order-openapi-flow.yaml"], { cwd: tempDir });
    assert.equal(apply.status, 0);
    assert.match(apply.stdout, /Flows sidecar: .*examples\/order-openapi-flow.yaml/);
    assert.match(apply.stdout, /Applied x-openapi-flow entries: 1/);

    const updatedOpenApi = fs.readFileSync(path.join(tempDir, "swagger.flow.json"), "utf8");
    assert.match(updatedOpenApi, /"x-openapi-flow"\s*:/);
    assert.match(updatedOpenApi, /"id"\s*:\s*"create-order"/);
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
