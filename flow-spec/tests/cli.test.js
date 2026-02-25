"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const FLOW_SPEC_ROOT = path.resolve(__dirname, "..");
const CLI_PATH = path.resolve(FLOW_SPEC_ROOT, "bin", "x-openapi-flow.js");
const HTTP_METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
const FIXTURES_DIR = path.resolve(FLOW_SPEC_ROOT, "tests", "fixtures");

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

function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8").trimEnd();
}

function normalizeDiffPrettyOutput(stdout, tempDir) {
  return stdout.replaceAll(tempDir, "<TMP>").trimEnd();
}

function normalizeDiffJsonOutput(stdout) {
  const payload = JSON.parse(stdout);
  payload.openApiFile = "<OPENAPI_FILE>";
  payload.flowsPath = "<FLOWS_PATH>";
  return JSON.stringify(payload, null, 2).trimEnd();
}

function normalizeGraphJsonOutput(stdout) {
  const payload = JSON.parse(stdout);
  return JSON.stringify(payload, null, 2).trimEnd();
}

function buildOpenApiWithAllHttpMethods() {
  const pathEntries = HTTP_METHODS.map((method) => {
    const operationId = `${method}Op`;
    return `  /${method}-resource:\n    ${method}:\n      operationId: ${operationId}\n      responses:\n        "200":\n          description: ok\n`;
  }).join("");

  return `openapi: "3.0.3"\ninfo:\n  title: All Methods API\n  version: "1.0.0"\npaths:\n${pathEntries}`;
}

function buildSidecarWithAllHttpMethods() {
  const operationEntries = HTTP_METHODS.map((method) => {
    const operationId = `${method}Op`;
    const currentState = `${method.toUpperCase()}_STATE`;
    return `  - operationId: ${operationId}\n    x-openapi-flow:\n      version: '1.0'\n      id: ${method}-flow\n      current_state: ${currentState}\n      transitions: []\n`;
  }).join("");

  return `version: '1.0'\noperations:\n${operationEntries}`;
}

function buildOpenApiWithInlineFlowsForAllHttpMethods() {
  const stateNames = HTTP_METHODS.map((method) => `${method.toUpperCase()}_STATE`);
  const pathEntries = HTTP_METHODS.map((method, index) => {
    const operationId = `${method}Op`;
    const currentState = stateNames[index];
    const nextState = stateNames[index + 1];
    const transitionBlock = nextState
      ? `\n        transitions:\n          - trigger_type: synchronous\n            target_state: ${nextState}\n            next_operation_id: ${HTTP_METHODS[index + 1]}Op`
      : "\n        transitions: []";

    return `  /${method}-resource:\n    ${method}:\n      operationId: ${operationId}\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: ${method}-flow\n        current_state: ${currentState}${transitionBlock}\n`;
  }).join("");

  return `openapi: "3.0.3"\ninfo:\n  title: All Methods Inline Flows API\n  version: "1.0.0"\npaths:\n${pathEntries}`;
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

test("graph json output is deterministic and matches snapshot contract", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-graph-json-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Graph JSON Contract API\n  version: "1.0.0"\npaths:\n  /create:\n    post:\n      operationId: createOrder\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: create-order\n        current_state: CREATED\n        transitions:\n          - target_state: CONFIRMED\n            trigger_type: synchronous\n            next_operation_id: confirmOrder\n            prerequisite_operation_ids:\n              - createOrder\n  /confirm:\n    post:\n      operationId: confirmOrder\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: confirm-order\n        current_state: CONFIRMED\n        transitions:\n          - target_state: SHIPPED\n            trigger_type: webhook\n            next_operation_id: shipOrder\n  /ship:\n    post:\n      operationId: shipOrder\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: ship-order\n        current_state: SHIPPED\n        transitions: []\n`,
      "utf8"
    );

    const first = runCli(["graph", openapiPath, "--format", "json"]);
    const second = runCli(["graph", openapiPath, "--format", "json"]);

    assert.equal(first.status, 0);
    assert.equal(second.status, 0);

    const normalizedFirst = normalizeGraphJsonOutput(first.stdout);
    const normalizedSecond = normalizeGraphJsonOutput(second.stdout);
    const snapshot = readFixture("graph-json-contract.snapshot.json");

    assert.equal(normalizedFirst, normalizedSecond);
    assert.equal(normalizedFirst, snapshot);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("graph command accepts sidecar file", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-graph-sidecar-"));
  const sidecarPath = path.join(tempDir, "openapi.x.yaml");

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

    const sidecarPath = path.join(tempDir, "openapi.x.yaml");
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
  const sidecarPath = path.join(tempDir, "openapi.x.yaml");
  const flowOutputPath = path.join(tempDir, "openapi.flow.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Existing Flow API\n  version: "1.0.0"\npaths:\n  /items:\n    get:\n      operationId: listItems\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    fs.writeFileSync(flowOutputPath, "# existing flow output\n", "utf8");
    fs.writeFileSync(sidecarPath, "version: '1.0'\noperations: []\n", "utf8");

    const result = runCli(["init", openapiPath]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Flow output already exists/);
    assert.match(result.stderr, /init --force/);
    assert.match(result.stderr, /x-openapi-flow apply/);

    const flowContent = fs.readFileSync(flowOutputPath, "utf8");
    assert.equal(flowContent, "# existing flow output\n");

    const sidecarContent = fs.readFileSync(sidecarPath, "utf8");
    assert.equal(sidecarContent, "version: '1.0'\noperations: []\n");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("init --force skips prompt, backups sidecar, and recreates flow output", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-init-force-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const sidecarPath = path.join(tempDir, "openapi.x.yaml");
  const flowOutputPath = path.join(tempDir, "openapi.flow.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Force Init API\n  version: "1.0.0"\npaths:\n  /items:\n    get:\n      operationId: listItems\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    const originalSidecarContent =
      `version: '1.0'\noperations:\n  - operationId: listItems\n    x-openapi-flow:\n      version: '1.0'\n      id: list-items-custom\n      current_state: READY\n      transitions: []\n`;

    fs.writeFileSync(sidecarPath, originalSidecarContent, "utf8");
    fs.writeFileSync(flowOutputPath, "# old flow output\n", "utf8");

    const result = runCli(["init", openapiPath, "--force"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Flow output recreated:/);
    assert.match(result.stdout, /Sidecar backup: .*openapi\.x\.yaml\.backup-1/);

    const sidecarBackupPath = `${sidecarPath}.backup-1`;
    assert.equal(fs.existsSync(sidecarBackupPath), true);
    const sidecarBackupContent = fs.readFileSync(sidecarBackupPath, "utf8");
    assert.equal(sidecarBackupContent, originalSidecarContent);

    const flowOutputContent = fs.readFileSync(flowOutputPath, "utf8");
    assert.doesNotMatch(flowOutputContent, /# old flow output/);
    assert.match(flowOutputContent, /x-openapi-flow:/);
    assert.match(flowOutputContent, /id: list-items-custom/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("init --force with custom --flows path backs up the custom sidecar file", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-init-force-custom-flows-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const customFlowsPath = path.join(tempDir, "sidecars", "custom.x.yaml");
  const flowOutputPath = path.join(tempDir, "openapi.flow.yaml");

  try {
    fs.mkdirSync(path.dirname(customFlowsPath), { recursive: true });

    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Force Custom Flows API\n  version: "1.0.0"\npaths:\n  /items:\n    get:\n      operationId: listItems\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    const originalSidecarContent =
      `version: '1.0'\noperations:\n  - operationId: listItems\n    x-openapi-flow:\n      version: '1.0'\n      id: custom-list-items\n      current_state: READY\n      transitions: []\n`;

    fs.writeFileSync(customFlowsPath, originalSidecarContent, "utf8");
    fs.writeFileSync(flowOutputPath, "# old flow output\n", "utf8");

    const result = runCli(["init", openapiPath, "--flows", customFlowsPath, "--force"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Flow output recreated:/);
    assert.match(result.stdout, /Sidecar backup: .*custom\.x\.yaml\.backup-1/);

    const backupPath = `${customFlowsPath}.backup-1`;
    assert.equal(fs.existsSync(backupPath), true);
    const backupContent = fs.readFileSync(backupPath, "utf8");
    assert.equal(backupContent, originalSidecarContent);

    const flowOutputContent = fs.readFileSync(flowOutputPath, "utf8");
    assert.doesNotMatch(flowOutputContent, /# old flow output/);
    assert.match(flowOutputContent, /id: custom-list-items/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("init --force recreates flow output without backup when sidecar does not exist yet", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-init-force-no-sidecar-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const sidecarPath = path.join(tempDir, "openapi.x.yaml");
  const flowOutputPath = path.join(tempDir, "openapi.flow.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Force No Sidecar API\n  version: "1.0.0"\npaths:\n  /items:\n    get:\n      operationId: listItems\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    fs.writeFileSync(flowOutputPath, "# old flow output\n", "utf8");

    const result = runCli(["init", openapiPath, "--force"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Flow output recreated:/);
    assert.doesNotMatch(result.stdout, /Sidecar backup:/);

    assert.equal(fs.existsSync(sidecarPath), true);
    assert.equal(fs.existsSync(`${sidecarPath}.backup-1`), false);

    const flowOutputContent = fs.readFileSync(flowOutputPath, "utf8");
    assert.doesNotMatch(flowOutputContent, /# old flow output/);
    assert.match(flowOutputContent, /x-openapi-flow:/);
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
  const sidecarPath = path.join(tempDir, "openapi.x.yaml");

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

test("init --dry-run does not create sidecar or flow output", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-init-dry-run-empty-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const sidecarPath = path.join(tempDir, "openapi.x.yaml");
  const flowOutputPath = path.join(tempDir, "openapi.flow.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Dry Run API\n  version: "1.0.0"\npaths:\n  /items:\n    get:\n      operationId: listItems\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    const result = runCli(["init", openapiPath, "--dry-run"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[dry-run\]/);
    assert.match(result.stdout, /No files were written/);

    assert.equal(fs.existsSync(sidecarPath), false);
    assert.equal(fs.existsSync(flowOutputPath), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("init --dry-run --force does not modify existing files or create backups", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-init-dry-run-force-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const sidecarPath = path.join(tempDir, "openapi.x.yaml");
  const flowOutputPath = path.join(tempDir, "openapi.flow.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Dry Run Force API\n  version: "1.0.0"\npaths:\n  /items:\n    get:\n      operationId: listItems\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    const originalSidecar =
      `version: '1.0'\noperations:\n  - operationId: listItems\n    x-openapi-flow:\n      version: '1.0'\n      id: list-items-old\n      current_state: OLD\n      transitions: []\n`;
    const originalFlow = "# existing flow output\n";

    fs.writeFileSync(sidecarPath, originalSidecar, "utf8");
    fs.writeFileSync(flowOutputPath, originalFlow, "utf8");

    const result = runCli(["init", openapiPath, "--dry-run", "--force"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Would recreate flow output/);
    assert.match(result.stdout, /No files were written/);

    const sidecarAfter = fs.readFileSync(sidecarPath, "utf8");
    const flowAfter = fs.readFileSync(flowOutputPath, "utf8");
    assert.equal(sidecarAfter, originalSidecar);
    assert.equal(flowAfter, originalFlow);
    assert.equal(fs.existsSync(`${sidecarPath}.backup-1`), false);
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

    const sidecarPath = path.join(tempDir, "openapi.x.yaml");
    const sidecarContent = fs.readFileSync(sidecarPath, "utf8");
    assert.match(sidecarContent, /operationId: get_health/);
    assert.match(sidecarContent, /id: get_health/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("init tracks all OpenAPI HTTP methods in sidecar and flow output", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-init-all-methods-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(openapiPath, buildOpenApiWithAllHttpMethods(), "utf8");

    const result = runCli(["init", openapiPath]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Tracked operations: 8/);

    const sidecarPath = path.join(tempDir, "openapi.x.yaml");
    const sidecarContent = fs.readFileSync(sidecarPath, "utf8");
    HTTP_METHODS.forEach((method) => {
      assert.match(sidecarContent, new RegExp(`operationId: ${method}Op`));
    });

    const flowOutputPath = path.join(tempDir, "openapi.flow.yaml");
    const flowOutputContent = fs.readFileSync(flowOutputPath, "utf8");
    const flowBlocks = flowOutputContent.match(/x-openapi-flow:/g) || [];
    assert.equal(flowBlocks.length, HTTP_METHODS.length);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("apply injects flow for operation without operationId using fallback operationId", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-apply-fallback-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const sidecarPath = path.join(tempDir, "openapi.x.yaml");

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
  const sidecarPath = path.join(tempDir, "openapi.x.yaml");

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

test("apply injects flow entries for all OpenAPI HTTP methods", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-apply-all-methods-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const sidecarPath = path.join(tempDir, "openapi.x.yaml");

  try {
    fs.writeFileSync(openapiPath, buildOpenApiWithAllHttpMethods(), "utf8");
    fs.writeFileSync(sidecarPath, buildSidecarWithAllHttpMethods(), "utf8");

    const apply = runCli(["apply", openapiPath]);
    assert.equal(apply.status, 0);
    assert.match(apply.stdout, /Applied x-openapi-flow entries: 8/);

    const updatedOpenApi = fs.readFileSync(path.join(tempDir, "openapi.flow.yaml"), "utf8");
    const flowBlocks = updatedOpenApi.match(/x-openapi-flow:/g) || [];
    assert.equal(flowBlocks.length, HTTP_METHODS.length);
    assert.match(updatedOpenApi, /id: trace-flow/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("graph includes transitions derived from all OpenAPI HTTP methods", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-graph-all-methods-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(openapiPath, buildOpenApiWithInlineFlowsForAllHttpMethods(), "utf8");

    const graph = runCli(["graph", openapiPath]);
    assert.equal(graph.status, 0);
    assert.match(graph.stdout, /stateDiagram-v2/);
    assert.match(graph.stdout, /GET_STATE --> PUT_STATE/);
    assert.match(graph.stdout, /PUT_STATE --> POST_STATE/);
    assert.match(graph.stdout, /PATCH_STATE --> TRACE_STATE/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("apply keeps compatibility with legacy -openapi-flow sidecar naming", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-legacy-sidecar-"));
  const openapiPath = path.join(tempDir, "swagger.json");
  const legacySidecarPath = path.join(tempDir, "swagger-openapi-flow.json");

  try {
    fs.writeFileSync(
      openapiPath,
      `{"openapi":"3.0.3","info":{"title":"Legacy Sidecar API","version":"1.0.0"},"paths":{"/orders":{"post":{"operationId":"createOrder","responses":{"201":{"description":"ok"}}}}}}\n`,
      "utf8"
    );

    fs.writeFileSync(
      legacySidecarPath,
      `{"version":"1.0","operations":[{"operationId":"createOrder","x-openapi-flow":{"version":"1.0","id":"create-order","current_state":"CREATED","transitions":[]}}]}\n`,
      "utf8"
    );

    const apply = runCli(["apply", openapiPath]);
    assert.equal(apply.status, 0);
    assert.match(apply.stdout, /Flows sidecar: .*swagger-openapi-flow.json/);
    assert.match(apply.stdout, /Applied x-openapi-flow entries: 1/);

    const updatedOpenApi = fs.readFileSync(path.join(tempDir, "swagger.flow.json"), "utf8");
    assert.match(updatedOpenApi, /"x-openapi-flow"\s*:/);
    assert.match(updatedOpenApi, /"id"\s*:\s*"create-order"/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("diff pretty reports added operations when sidecar does not exist", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-diff-pretty-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Diff Pretty API\n  version: "1.0.0"\npaths:\n  /items:\n    get:\n      operationId: listItems\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    const result = runCli(["diff", openapiPath]);
    assert.equal(result.status, 0);
    const normalized = normalizeDiffPrettyOutput(result.stdout, tempDir);
    const snapshot = readFixture("diff-pretty-added.snapshot.txt");
    assert.equal(normalized, snapshot);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("diff json reports changed operations", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-diff-json-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const sidecarPath = path.join(tempDir, "openapi.x.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Diff JSON API\n  version: "1.0.0"\npaths:\n  /items:\n    get:\n      operationId: listItems\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    fs.writeFileSync(
      sidecarPath,
      `version: '1.0'\noperations:\n  - operationId: listItems\n`,
      "utf8"
    );

    const result = runCli(["diff", openapiPath, "--format", "json"]);
    assert.equal(result.status, 0);

    const normalized = normalizeDiffJsonOutput(result.stdout);
    const snapshot = readFixture("diff-json-changed.snapshot.json");
    assert.equal(normalized, snapshot);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("diff pretty includes changed field-level details", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-diff-pretty-details-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const sidecarPath = path.join(tempDir, "openapi.x.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Diff Pretty Details API\n  version: "1.0.0"\npaths:\n  /items:\n    get:\n      operationId: listItems\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    fs.writeFileSync(
      sidecarPath,
      `version: '1.0'\noperations:\n  - operationId: listItems\n`,
      "utf8"
    );

    const result = runCli(["diff", openapiPath]);
    assert.equal(result.status, 0);
    const normalized = normalizeDiffPrettyOutput(result.stdout, tempDir);
    const snapshot = readFixture("diff-pretty-changed-details.snapshot.txt");
    assert.equal(normalized, snapshot);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("lint pretty reports semantic issues", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-lint-pretty-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Lint Pretty API\n  version: "1.0.0"\npaths:\n  /start:\n    post:\n      operationId: startFlow\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: start-flow\n        current_state: START\n        transitions:\n          - target_state: LOOP\n            trigger_type: synchronous\n            next_operation_id: missingNext\n            prerequisite_operation_ids:\n              - missingPrereq\n          - target_state: LOOP\n            trigger_type: synchronous\n  /loop:\n    post:\n      operationId: loopFlow\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: loop-flow\n        current_state: LOOP\n        transitions:\n          - target_state: START\n            trigger_type: synchronous\n`,
      "utf8"
    );

    const result = runCli(["lint", openapiPath]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /next_operation_id_exists/);
    assert.match(result.stderr, /prerequisite_operation_ids_exist/);
    assert.match(result.stderr, /duplicate_transitions/);
    assert.match(result.stderr, /terminal_path/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("lint json supports disabling specific rules via config", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-lint-json-config-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const configPath = path.join(tempDir, "x-openapi-flow.config.json");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Lint JSON API\n  version: "1.0.0"\npaths:\n  /start:\n    post:\n      operationId: startFlow\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: start-flow\n        current_state: START\n        transitions:\n          - target_state: LOOP\n            trigger_type: synchronous\n            next_operation_id: missingNext\n            prerequisite_operation_ids:\n              - missingPrereq\n          - target_state: LOOP\n            trigger_type: synchronous\n  /loop:\n    post:\n      operationId: loopFlow\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: loop-flow\n        current_state: LOOP\n        transitions:\n          - target_state: START\n            trigger_type: synchronous\n`,
      "utf8"
    );

    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          lint: {
            rules: {
              next_operation_id_exists: true,
              prerequisite_operation_ids_exist: false,
              duplicate_transitions: false,
              terminal_path: false,
            },
          },
        },
        null,
        2
      ),
      "utf8"
    );

    const result = runCli(["lint", openapiPath, "--format", "json", "--config", configPath]);
    assert.equal(result.status, 1);

    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ruleConfig.next_operation_id_exists, true);
    assert.equal(payload.ruleConfig.prerequisite_operation_ids_exist, false);
    assert.equal(payload.ruleConfig.duplicate_transitions, false);
    assert.equal(payload.ruleConfig.terminal_path, false);
    assert.equal(payload.issues.next_operation_id_exists.length, 1);
    assert.equal(payload.issues.prerequisite_operation_ids_exist.length, 0);
    assert.equal(payload.issues.duplicate_transitions.length, 0);
    assert.equal(payload.issues.terminal_path.non_terminating_states.length, 0);
    assert.deepEqual(payload.summary.violated_rules, ["next_operation_id_exists"]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("lint json passes when all lint rules are disabled", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-lint-json-all-disabled-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const configPath = path.join(tempDir, "x-openapi-flow.config.json");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Lint JSON Disabled API\n  version: "1.0.0"\npaths:\n  /start:\n    post:\n      operationId: startFlow\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: start-flow\n        current_state: START\n        transitions:\n          - target_state: LOOP\n            trigger_type: synchronous\n            next_operation_id: missingNext\n            prerequisite_operation_ids:\n              - missingPrereq\n          - target_state: LOOP\n            trigger_type: synchronous\n  /loop:\n    post:\n      operationId: loopFlow\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: loop-flow\n        current_state: LOOP\n        transitions:\n          - target_state: START\n            trigger_type: synchronous\n`,
      "utf8"
    );

    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          lint: {
            rules: {
              next_operation_id_exists: false,
              prerequisite_operation_ids_exist: false,
              duplicate_transitions: false,
              terminal_path: false,
            },
          },
        },
        null,
        2
      ),
      "utf8"
    );

    const result = runCli(["lint", openapiPath, "--format", "json", "--config", configPath]);
    assert.equal(result.status, 0);

    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.summary.errors, 0);
    assert.deepEqual(payload.summary.violated_rules, []);
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
