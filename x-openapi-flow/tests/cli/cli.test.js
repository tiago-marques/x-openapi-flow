"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const FLOW_SPEC_ROOT = path.resolve(__dirname, "..", "..");
const CLI_PATH = path.resolve(FLOW_SPEC_ROOT, "bin", "x-openapi-flow.js");
const HTTP_METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
const FIXTURES_DIR = path.resolve(__dirname, "fixtures");

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

function normalizeAnalyzeJsonOutput(stdout) {
  const payload = JSON.parse(stdout);
  payload.openApiFile = "<OPENAPI_FILE>";
  payload.outputPath = payload.outputPath ? "<OUTPUT_PATH>" : null;
  return JSON.stringify(payload, null, 2).trimEnd();
}

function normalizeValidateJsonOutput(stdout) {
  const payload = JSON.parse(stdout);
  payload.path = "<OPENAPI_FILE>";
  if (Array.isArray(payload.issues)) {
    payload.issues = payload.issues.map((issue) => {
      const normalized = { ...issue };
      if (typeof normalized.location === "string" && normalized.location.includes("/")) {
        normalized.location = "<ENDPOINT>";
      }
      return normalized;
    });
  }
  if (Array.isArray(payload.schemaFailures)) {
    payload.schemaFailures = payload.schemaFailures.map((failure) => ({
      ...failure,
      endpoint: "<ENDPOINT>",
    }));
  }

  return JSON.stringify(payload, null, 2).trimEnd();
}

function normalizeLintJsonOutput(stdout) {
  const payload = JSON.parse(stdout);
  payload.path = "<OPENAPI_FILE>";

  const normalizeEntry = (entry) => {
    const normalized = { ...entry };
    if (typeof normalized.endpoint === "string") {
      normalized.endpoint = "<ENDPOINT>";
    }
    if (typeof normalized.declared_in === "string") {
      normalized.declared_in = "<ENDPOINT>";
    }
    return normalized;
  };

  if (payload.issues && Array.isArray(payload.issues.transition_priority_determinism)) {
    payload.issues.transition_priority_determinism = payload.issues.transition_priority_determinism
      .map(normalizeEntry)
      .sort((a, b) => (String(a.target_state || "")).localeCompare(String(b.target_state || "")));
  }

  if (payload.issues && Array.isArray(payload.issues.decision_rule_clarity)) {
    payload.issues.decision_rule_clarity = payload.issues.decision_rule_clarity
      .map(normalizeEntry)
      .sort((a, b) => (String(a.target_state || "")).localeCompare(String(b.target_state || "")));
  }

  if (payload.issues && Array.isArray(payload.issues.evidence_refs_for_decisions)) {
    payload.issues.evidence_refs_for_decisions = payload.issues.evidence_refs_for_decisions
      .map(normalizeEntry)
      .sort((a, b) => (String(a.target_state || "")).localeCompare(String(b.target_state || "")));
  }

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
    "tests/cli/fixtures/missing-version.yaml",
    "--profile",
    "strict",
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Schema validation FAILED/);
  assert.match(result.stderr, /Add `version: "1.0"` to the x-openapi-flow object/);
  assert.match(result.stderr, /Failure summary:/);
  assert.match(result.stderr, /schema errors: 1/);
  assert.match(result.stderr, /Suggested commands:/);
  assert.match(result.stderr, /--format json/);
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
  assert.match(result.stderr, /Profile strict enforces graph soundness/);
  assert.match(result.stderr, /Local mode: run once without --strict-quality/);
  assert.match(result.stderr, /\[local-debug\]/);
});

test("strict-quality in CI prints CI-specific guidance", () => {
  const result = runCli([
    "validate",
    "examples/quality-warning-api.yaml",
    "--strict-quality",
  ], {
    env: { CI: "true" },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /CI mode: --strict-quality is active and should block merges/);
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

test("analyze json infers sidecar with transitions", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-analyze-json-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Analyze API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n  /orders/{id}/confirm:\n    post:\n      operationId: confirmOrder\n      responses:\n        "200":\n          description: ok\n  /orders/{id}/ship:\n    post:\n      operationId: shipOrder\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    const result = runCli(["analyze", openapiPath, "--format", "json"]);
    assert.equal(result.status, 0);

    const normalized = normalizeAnalyzeJsonOutput(result.stdout);
    const payload = JSON.parse(normalized);

    assert.equal(payload.analysis.operationCount, 3);
    assert.equal(payload.analysis.inferredTransitions, 2);
    assert.equal(payload.analysis.confidenceThreshold, 0);
    assert.equal(Array.isArray(payload.analysis.warnings), true);
    assert.equal(Array.isArray(payload.analysis.transitionConfidence), true);
    assert.equal(payload.analysis.transitionConfidence.length, 2);
    payload.analysis.transitionConfidence.forEach((entry) => {
      assert.equal(typeof entry.confidence, "number");
      assert.equal(entry.confidence >= 0, true);
      assert.equal(entry.confidence <= 1, true);
      assert.equal(Array.isArray(entry.confidence_reasons), true);
    });
    assert.match(normalized, /"current_state": "CREATED"/);
    assert.match(normalized, /"current_state": "CONFIRMED"/);
    assert.match(normalized, /"current_state": "SHIPPED"/);
    assert.match(normalized, /"operation_role": "create"/);
    assert.match(normalized, /"operation_role": "mutate"/);
    assert.match(normalized, /"terminal": false/);
    assert.match(normalized, /"terminal": true/);
    assert.match(normalized, /"prerequisite_operation_ids": \[/);
    assert.match(normalized, /"next_operation_id": "confirmOrder"/);
    assert.match(normalized, /"next_operation_id": "shipOrder"/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("analyze respects --confidence-threshold and emits low-confidence warnings", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-analyze-threshold-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Analyze Threshold API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n  /orders/{id}/confirm:\n    post:\n      operationId: confirmOrder\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    const result = runCli(["analyze", openapiPath, "--format", "json", "--confidence-threshold", "0.96"]);
    assert.equal(result.status, 0);

    const payload = JSON.parse(result.stdout);
    assert.equal(payload.analysis.inferredTransitions, 0);
    assert.equal(payload.analysis.confidenceThreshold, 0.96);
    assert.equal(Array.isArray(payload.analysis.warnings), true);
    assert.equal(payload.analysis.warnings.length > 0, true);
    assert.equal(payload.analysis.warnings[0].type, "low_confidence_transition");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("analyze writes sidecar with --out", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-analyze-out-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const outPath = path.join(tempDir, "openapi.x.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Analyze Out API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n  /orders/{id}/cancel:\n    post:\n      operationId: cancelOrder\n      responses:\n        "200":\n          description: canceled\n`,
      "utf8"
    );

    const result = runCli(["analyze", openapiPath, "--out", outPath]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Suggested sidecar written to:/);

    const sidecar = fs.readFileSync(outPath, "utf8");
    assert.match(sidecar, /operationId: createOrder/);
    assert.match(sidecar, /operationId: cancelOrder/);
    assert.match(sidecar, /current_state: CREATED/);
    assert.match(sidecar, /current_state: CANCELED/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("analyze --merge preserves existing flow fields and merges inferred operations", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-analyze-merge-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const sidecarPath = path.join(tempDir, "openapi.x.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Analyze Merge API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n  /orders/{id}/confirm:\n    post:\n      operationId: confirmOrder\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    fs.writeFileSync(
      sidecarPath,
      `version: '1.0'\noperations:\n  - operationId: createOrder\n    x-openapi-flow:\n      version: '1.0'\n      id: create-order-manual\n      current_state: MANUAL_CREATED\n      transitions:\n        - target_state: MANUAL_NEXT\n          trigger_type: synchronous\n          next_operation_id: manualNext\n  - operationId: archivedOrder\n    x-openapi-flow:\n      version: '1.0'\n      id: archived-order\n      current_state: ARCHIVED\n      transitions: []\n`,
      "utf8"
    );

    const result = runCli(["analyze", openapiPath, "--merge", "--flows", sidecarPath, "--out", sidecarPath, "--format", "json"]);
    assert.equal(result.status, 0);

    const payload = JSON.parse(result.stdout);
    assert.equal(payload.merge.enabled, true);
    assert.equal(payload.merge.existingOperations, 2);
    assert.equal(payload.merge.inferredOperations, 2);
    assert.equal(payload.merge.mergedOperations, 3);

    const mergedSidecar = fs.readFileSync(sidecarPath, "utf8");
    assert.match(mergedSidecar, /operationId: createOrder/);
    assert.match(mergedSidecar, /current_state: MANUAL_CREATED/);
    assert.match(mergedSidecar, /next_operation_id: manualNext/);
    assert.match(mergedSidecar, /operationId: confirmOrder/);
    assert.match(mergedSidecar, /operationId: archivedOrder/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("analyze --merge aligns inferred target_state with existing next operation current_state", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-analyze-merge-align-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const sidecarPath = path.join(tempDir, "openapi.x.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Analyze Merge Align API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n  /orders/{id}/confirm:\n    post:\n      operationId: confirmOrder\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    fs.writeFileSync(
      sidecarPath,
      `version: '1.0'\noperations:\n  - operationId: confirmOrder\n    x-openapi-flow:\n      version: '1.0'\n      id: confirm-order-manual\n      current_state: ORDER_CONFIRMED_MANUAL\n      transitions: []\n`,
      "utf8"
    );

    const result = runCli(["analyze", openapiPath, "--merge", "--flows", sidecarPath, "--out", sidecarPath]);
    assert.equal(result.status, 0);

    const mergedSidecar = fs.readFileSync(sidecarPath, "utf8");
    assert.match(mergedSidecar, /operationId: createOrder/);
    assert.match(mergedSidecar, /next_operation_id: confirmOrder/);
    assert.match(mergedSidecar, /target_state: ORDER_CONFIRMED_MANUAL/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("generate-sdk typescript creates flow-aware resource classes", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-generate-sdk-"));
  const outputDir = path.join(tempDir, "sdk");

  try {
    const result = runCli([
      "generate-sdk",
      "examples/order-api.yaml",
      "--lang",
      "typescript",
      "--output",
      outputDir,
    ]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Resources generated:/);

    const orderResourcePath = path.join(outputDir, "src", "resources", "Order.ts");
    const indexPath = path.join(outputDir, "src", "index.ts");
    const helpersPath = path.join(outputDir, "src", "flow-helpers.ts");
    const modelPath = path.join(outputDir, "flow-model.json");

    assert.equal(fs.existsSync(orderResourcePath), true);
    assert.equal(fs.existsSync(indexPath), true);
    assert.equal(fs.existsSync(helpersPath), true);
    assert.equal(fs.existsSync(modelPath), true);

    const orderResource = fs.readFileSync(orderResourcePath, "utf8");
    assert.match(orderResource, /export class OrderResource/);
    assert.match(orderResource, /export class OrderCreated/);
    assert.match(orderResource, /async confirm\(params: OperationParams = \{\}\): Promise<OrderConfirmed>/);
    assert.match(orderResource, /async cancel\(params: OperationParams = \{\}\): Promise<OrderCancelled>/);
    assert.doesNotMatch(orderResource, /export class OrderCreated extends [^{]+\{\s*async ship\(/);

    const helpers = fs.readFileSync(helpersPath, "utf8");
    assert.match(helpers, /export async function runFlow/);

    const model = JSON.parse(fs.readFileSync(modelPath, "utf8"));
    assert.equal(Array.isArray(model.resources), true);
    assert.equal(model.resources.length > 0, true);
    assert.equal(Array.isArray(model.resources[0].operations), true);
    assert.equal(Array.isArray(model.resources[0].states), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("generate-sdk creates collection layer and lifecycle helper methods", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-generate-sdk-collection-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const outputDir = path.join(tempDir, "sdk");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Payments API\n  version: "1.0.0"\npaths:\n  /payments:\n    get:\n      operationId: listPayments\n      responses:\n        "200":\n          description: ok\n    post:\n      operationId: createPayment\n      x-openapi-flow:\n        version: "1.0"\n        id: create-payment\n        current_state: AUTHORIZED\n        transitions:\n          - target_state: CAPTURED\n            trigger_type: synchronous\n            next_operation_id: capturePayment\n      responses:\n        "201":\n          description: ok\n  /payments/{id}:\n    get:\n      operationId: retrievePayment\n      responses:\n        "200":\n          description: ok\n  /payments/{id}/capture:\n    post:\n      operationId: capturePayment\n      x-openapi-flow:\n        version: "1.0"\n        id: capture-payment\n        current_state: CAPTURED\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    const result = runCli([
      "generate-sdk",
      openapiPath,
      "--lang",
      "typescript",
      "--output",
      outputDir,
    ]);

    assert.equal(result.status, 0);

    const paymentResourcePath = path.join(outputDir, "src", "resources", "Payment.ts");
    assert.equal(fs.existsSync(paymentResourcePath), true);

    const paymentResource = fs.readFileSync(paymentResourcePath, "utf8");
    assert.match(paymentResource, /async create\(params: OperationParams = \{\}\): Promise<PaymentAuthorized>/);
    assert.match(paymentResource, /async retrieve\(id: string, params: OperationParams = \{\}\): Promise<PaymentResourceInstance>/);
    assert.match(paymentResource, /async list\(params: OperationParams = \{\}\): Promise<unknown>/);
    assert.match(paymentResource, /async capture\(id: string, params: OperationParams = \{\}, options: LifecycleOptions = \{\}\): Promise<PaymentCaptured>/);
    assert.match(paymentResource, /_executeTransition\(operationId: string, params: OperationParams, completedOperations: Set<string>\)/);
    assert.match(paymentResource, /class PaymentAuthorized[\s\S]*async capture\(params: OperationParams = \{\}\): Promise<PaymentCaptured>/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("export-doc-flows generates markdown lifecycle page", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-doc-flows-"));
  const outputPath = path.join(tempDir, "api-flows.md");

  try {
    const result = runCli([
      "export-doc-flows",
      "examples/order-api.yaml",
      "--output",
      outputPath,
    ]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Format: markdown/);
    assert.equal(fs.existsSync(outputPath), true);

    const content = fs.readFileSync(outputPath, "utf8");
    assert.match(content, /# API Flows/);
    assert.match(content, /## Orders Lifecycle/);
    assert.match(content, /```mermaid/);
    assert.match(content, /createOrder/);
    assert.match(content, /Next operations:/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("generate-postman creates flow-oriented collection", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-postman-"));
  const outputPath = path.join(tempDir, "flow.postman_collection.json");

  try {
    const result = runCli([
      "generate-postman",
      "examples/order-api.yaml",
      "--output",
      outputPath,
      "--with-scripts",
    ]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Scripts enabled: true/);
    assert.equal(fs.existsSync(outputPath), true);

    const collection = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    assert.equal(collection.info.schema.includes("collection/v2.1.0"), true);
    assert.equal(Array.isArray(collection.item), true);
    assert.equal(collection.item.length > 0, true);

    const firstFolder = collection.item[0];
    assert.equal(Array.isArray(firstFolder.item), true);
    const firstJourney = firstFolder.item[0];
    const firstRequest = firstJourney && Array.isArray(firstJourney.item) ? firstJourney.item[0] : null;
    assert.equal(!!firstRequest, true);
    assert.equal(Array.isArray(firstRequest.event), true);
    assert.equal(firstRequest.event.length >= 2, true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("generate-insomnia creates flow workspace export", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-insomnia-"));
  const outputPath = path.join(tempDir, "flow.insomnia.json");

  try {
    const result = runCli([
      "generate-insomnia",
      "examples/order-api.yaml",
      "--output",
      outputPath,
    ]);

    assert.equal(result.status, 0);
    assert.equal(fs.existsSync(outputPath), true);

    const payload = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    assert.equal(payload._type, "export");
    assert.equal(Array.isArray(payload.resources), true);
    assert.equal(payload.resources.some((entry) => entry._type === "workspace"), true);
    assert.equal(payload.resources.some((entry) => entry._type === "request_group"), true);
    assert.equal(payload.resources.some((entry) => entry._type === "request"), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("generate-redoc creates package with plugin and lifecycle model", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-redoc-"));
  const outputDir = path.join(tempDir, "redoc-flow");

  try {
    const result = runCli([
      "generate-redoc",
      "examples/order-api.yaml",
      "--output",
      outputDir,
    ]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Redoc index:/);

    const indexPath = path.join(outputDir, "index.html");
    const pluginPath = path.join(outputDir, "x-openapi-flow-redoc-plugin.js");
    const modelPath = path.join(outputDir, "flow-model.json");
    const specPath = path.join(outputDir, "openapi.yaml");

    assert.equal(fs.existsSync(indexPath), true);
    assert.equal(fs.existsSync(pluginPath), true);
    assert.equal(fs.existsSync(modelPath), true);
    assert.equal(fs.existsSync(specPath), true);

    const index = fs.readFileSync(indexPath, "utf8");
    assert.match(index, /<redoc spec-url="\.\/openapi\.yaml"><\/redoc>/);
    assert.match(index, /x-openapi-flow-redoc-plugin\.js/);
    assert.match(index, /data-x-openapi-flow-target="reference"/);
    assert.match(index, /data-x-openapi-flow-target="flow"/);
    assert.match(index, /data-x-openapi-flow-view="flow"/);

    const plugin = fs.readFileSync(pluginPath, "utf8");
    assert.match(plugin, /window\.XOpenApiFlowRedocPlugin/);
    assert.match(plugin, /window\.XOpenApiFlowRedocInternals/);
    assert.match(plugin, /Flow \/ Lifecycle/);
    assert.match(plugin, /data-x-openapi-flow-target/);
    assert.match(plugin, /data-x-openapi-flow-view/);
    assert.match(plugin, /View in API Reference/);
    assert.match(plugin, /Mermaid/);

    const model = JSON.parse(fs.readFileSync(modelPath, "utf8"));
    assert.equal(Array.isArray(model.resources), true);
    assert.equal(model.resources.length > 0, true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("generate-flow-tests creates Jest suite with happy and invalid transition cases", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-generate-flow-tests-jest-"));
  const openapiPath = path.join(tempDir, "openapi.flow.yaml");
  const outputPath = path.join(tempDir, "flow.generated.test.js");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Flow Tests API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n      x-openapi-flow:\n        version: "1.0"\n        id: create-order\n        current_state: CREATED\n        transitions:\n          - target_state: CONFIRMED\n            trigger_type: synchronous\n            next_operation_id: confirmOrder\n  /orders/{id}/confirm:\n    post:\n      operationId: confirmOrder\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: confirm-order\n        current_state: CONFIRMED\n        transitions:\n          - target_state: SHIPPED\n            trigger_type: synchronous\n            next_operation_id: shipOrder\n  /orders/{id}/ship:\n    post:\n      operationId: shipOrder\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: ship-order\n        current_state: SHIPPED\n        transitions: []\n`,
      "utf8"
    );

    const result = runCli([
      "generate-flow-tests",
      openapiPath,
      "--format",
      "jest",
      "--output",
      outputPath,
    ]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Test format: jest/);
    assert.match(result.stdout, /Happy path tests:/);
    assert.match(result.stdout, /Invalid transition tests:/);
    assert.equal(fs.existsSync(outputPath), true);

    const content = fs.readFileSync(outputPath, "utf8");
    assert.match(content, /createStateMachineEngine/);
    assert.match(content, /describe\("happy paths"/);
    assert.match(content, /describe\("invalid transitions"/);
    assert.match(content, /INVALID_TRANSITION/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("generate-flow-tests supports postman/newman-oriented output", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-generate-flow-tests-postman-"));
  const outputPath = path.join(tempDir, "flow-tests.postman_collection.json");

  try {
    const result = runCli([
      "generate-flow-tests",
      "examples/order-api.yaml",
      "--format",
      "postman",
      "--output",
      outputPath,
      "--with-scripts",
    ]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Test format: postman/);
    assert.match(result.stdout, /Scripts enabled: true/);
    assert.equal(fs.existsSync(outputPath), true);

    const collection = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    assert.equal(Array.isArray(collection.item), true);
    assert.equal(collection.item.length > 0, true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("apply supports expressive resource-based sidecar DSL", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-resource-dsl-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const sidecarPath = path.join(tempDir, "openapi.x.yaml");
  const flowPath = path.join(tempDir, "openapi.flow.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Resource DSL API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n  /orders/{id}/pay:\n    post:\n      operationId: payOrder\n      responses:\n        "200":\n          description: ok\n  /orders/{id}/ship:\n    post:\n      operationId: shipOrder\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    fs.writeFileSync(
      sidecarPath,
      `version: "1.0"\nresources:\n  - name: orders\n    defaults:\n      flow:\n        version: "1.0"\n        id_prefix: order\n      transition:\n        trigger_type: synchronous\n    states:\n      created: CREATED\n      paid: PAID\n      shipped: SHIPPED\n    transitions:\n      - from: created\n        to: paid\n        next_operation_id: payOrder\n      - from: paid\n        to: shipped\n        next_operation_id: shipOrder\n    operations:\n      - operationId: createOrder\n        state: created\n      - operationId: payOrder\n        state: paid\n      - operationId: shipOrder\n        state: shipped\n`,
      "utf8"
    );

    const applyResult = runCli(["apply", openapiPath, "--flows", sidecarPath, "--out", flowPath]);
    assert.equal(applyResult.status, 0, `apply failed:\n${applyResult.stderr}`);

    const validateResult = runCli(["validate", flowPath, "--profile", "strict"]);
    assert.equal(validateResult.status, 0, `validate failed:\n${validateResult.stderr}`);

    const flowContent = fs.readFileSync(flowPath, "utf8");
    assert.match(flowContent, /operationId: createOrder[\s\S]*current_state: CREATED/);
    assert.match(flowContent, /operationId: payOrder[\s\S]*current_state: PAID/);
    assert.match(flowContent, /operationId: shipOrder[\s\S]*current_state: SHIPPED/);
    assert.match(flowContent, /next_operation_id: payOrder/);
    assert.match(flowContent, /next_operation_id: shipOrder/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("validate --semantic reports semantic modeling warnings", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-semantic-validate-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Semantic Validate API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n      x-openapi-flow:\n        version: "1.0"\n        id: create-order\n        current_state: created\n        transitions:\n          - target_state: PAID\n            trigger_type: synchronous\n            next_operation_id: payOrder\n  /orders/{id}/pay:\n    post:\n      operationId: payOrder\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: pay-order\n        current_state: PAID\n        transitions: []\n`,
      "utf8"
    );

    const result = runCli(["validate", openapiPath, "--profile", "strict", "--semantic"]);
    assert.equal(result.status, 0);
    assert.match(result.stderr, /Semantic: inconsistent state naming styles detected/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("lint --semantic fails on ambiguous semantic modeling", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-semantic-lint-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Semantic Lint API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n      x-openapi-flow:\n        version: "1.0"\n        id: create-order\n        current_state: created\n        transitions:\n          - target_state: PAID\n            trigger_type: synchronous\n            next_operation_id: payOrder\n  /orders/{id}/pay:\n    post:\n      operationId: payOrder\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: pay-order\n        current_state: PAID\n        transitions: []\n`,
      "utf8"
    );

    const result = runCli(["lint", openapiPath, "--semantic"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /semantic_consistency/);
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

test("quickstart scaffolds a runnable onboarding project with base/sidecar/flow files", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-quickstart-"));
  const scaffoldDir = path.join(tempDir, "demo");

  try {
    const result = runCli(["quickstart", "--dir", scaffoldDir]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Quickstart project created:/);
    assert.match(result.stdout, /openapi\.json/);
    assert.match(result.stdout, /openapi\.x\.yaml/);
    assert.match(result.stdout, /openapi\.flow\.json/);

    const openapiPath = path.join(scaffoldDir, "openapi.json");
    const sidecarPath = path.join(scaffoldDir, "openapi.x.yaml");
    const flowPath = path.join(scaffoldDir, "openapi.flow.json");
    const serverPath = path.join(scaffoldDir, "server.js");
    const packagePath = path.join(scaffoldDir, "package.json");
    const readmePath = path.join(scaffoldDir, "README.md");

    assert.equal(fs.existsSync(openapiPath), true);
    assert.equal(fs.existsSync(sidecarPath), true);
    assert.equal(fs.existsSync(flowPath), true);
    assert.equal(fs.existsSync(serverPath), true);
    assert.equal(fs.existsSync(packagePath), true);
    assert.equal(fs.existsSync(readmePath), true);

    const readmeContent = fs.readFileSync(readmePath, "utf8");
    assert.match(readmeContent, /you can ignore this file at first/i);

    const validate = runCli(["validate", flowPath, "--profile", "strict"]);
    assert.equal(validate.status, 0, `validate failed:\n${validate.stderr}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("quickstart supports fastify runtime scaffold", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-quickstart-fastify-"));
  const scaffoldDir = path.join(tempDir, "demo-fastify");

  try {
    const result = runCli(["quickstart", "--dir", scaffoldDir, "--runtime", "fastify"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Runtime: fastify/);

    const packagePath = path.join(scaffoldDir, "package.json");
    const serverPath = path.join(scaffoldDir, "server.js");
    const flowPath = path.join(scaffoldDir, "openapi.flow.json");

    assert.equal(fs.existsSync(packagePath), true);
    assert.equal(fs.existsSync(serverPath), true);
    assert.equal(fs.existsSync(flowPath), true);

    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    assert.equal(typeof pkg.dependencies.fastify, "string");
    assert.equal(pkg.dependencies.express, undefined);

    const serverContent = fs.readFileSync(serverPath, "utf8");
    assert.match(serverContent, /createFastifyFlowGuard/);
    assert.match(serverContent, /fastify\.addHook/);

    const validate = runCli(["validate", flowPath, "--profile", "strict"]);
    assert.equal(validate.status, 0, `validate failed:\n${validate.stderr}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
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

test("init --suggest-transitions infers transitions into sidecar and flow output", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-init-suggest-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Suggest API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n  /orders/{id}/confirm:\n    post:\n      operationId: confirmOrder\n      responses:\n        "200":\n          description: ok\n  /orders/{id}/ship:\n    post:\n      operationId: shipOrder\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    const result = runCli(["init", openapiPath, "--suggest-transitions"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Suggested transitions inferred: 2/);

    const sidecarPath = path.join(tempDir, "openapi.x.yaml");
    const sidecarContent = fs.readFileSync(sidecarPath, "utf8");
    assert.match(sidecarContent, /operationId: createOrder/);
    assert.match(sidecarContent, /operationId: confirmOrder/);
    assert.match(sidecarContent, /prerequisite_operation_ids:/);
    assert.match(sidecarContent, /operation_role: mutate/);
    assert.match(sidecarContent, /next_operation_id: confirmOrder/);
    assert.match(sidecarContent, /next_operation_id: shipOrder/);

    const flowOutputPath = path.join(tempDir, "openapi.flow.yaml");
    const flowOutputContent = fs.readFileSync(flowOutputPath, "utf8");
    assert.match(flowOutputContent, /next_operation_id: confirmOrder/);
    assert.match(flowOutputContent, /next_operation_id: shipOrder/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("init --suggest-transitions preserves manual sidecar flow when operation already exists", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-init-suggest-preserve-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const sidecarPath = path.join(tempDir, "openapi.x.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Suggest Preserve API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n  /orders/{id}/confirm:\n    post:\n      operationId: confirmOrder\n      responses:\n        "200":\n          description: ok\n  /orders/{id}/ship:\n    post:\n      operationId: shipOrder\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    fs.writeFileSync(
      sidecarPath,
      `version: '1.0'\noperations:\n  - operationId: createOrder\n    x-openapi-flow:\n      version: '1.0'\n      id: create-order-manual\n      current_state: MANUAL_CREATED\n      transitions: []\n`,
      "utf8"
    );

    const result = runCli(["init", openapiPath, "--suggest-transitions", "--force"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Suggested transitions inferred: 2/);

    const sidecarContent = fs.readFileSync(sidecarPath, "utf8");
    assert.match(sidecarContent, /operationId: createOrder/);
    assert.match(sidecarContent, /id: create-order-manual/);
    assert.match(sidecarContent, /current_state: MANUAL_CREATED/);
    assert.match(sidecarContent, /operationId: confirmOrder/);
    assert.match(sidecarContent, /next_operation_id: shipOrder/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("init --suggest-transitions aligns target_state to manual current_state for next operation", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-init-suggest-align-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const sidecarPath = path.join(tempDir, "openapi.x.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Suggest Align API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n  /orders/{id}/confirm:\n    post:\n      operationId: confirmOrder\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    fs.writeFileSync(
      sidecarPath,
      `version: '1.0'\noperations:\n  - operationId: confirmOrder\n    x-openapi-flow:\n      version: '1.0'\n      id: confirm-order-manual\n      current_state: ORDER_CONFIRMED_MANUAL\n      transitions: []\n`,
      "utf8"
    );

    const result = runCli(["init", openapiPath, "--suggest-transitions", "--force"]);
    assert.equal(result.status, 0);

    const sidecarContent = fs.readFileSync(sidecarPath, "utf8");
    assert.match(sidecarContent, /operationId: createOrder/);
    assert.match(sidecarContent, /next_operation_id: confirmOrder/);
    assert.match(sidecarContent, /target_state: ORDER_CONFIRMED_MANUAL/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("help init includes --suggest-transitions option", () => {
  const result = runCli(["help", "init"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /x-openapi-flow init \[openapi-file\] \[--flows path\] \[--force\] \[--dry-run\] \[--suggest-transitions\] \[--confidence-threshold 0\.\.1\]/);
  assert.match(result.stdout, /init openapi\.yaml --suggest-transitions/);
});

test("completion scripts include --suggest-transitions for init", () => {
  const bash = runCli(["completion", "bash"]);
  const zsh = runCli(["completion", "zsh"]);

  assert.equal(bash.status, 0);
  assert.equal(zsh.status, 0);
  assert.match(bash.stdout, /--flows --force --dry-run --suggest-transitions --confidence-threshold --help --verbose/);
  assert.match(zsh.stdout, /_values 'options' --flows --force --dry-run --suggest-transitions --confidence-threshold --help/);
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

test("init auto-installs swagger-ui plugin when swagger-ui-express is in package.json", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-init-swagger-detect-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Swagger Detect API\n  version: "1.0.0"\npaths:\n  /items:\n    get:\n      operationId: listItems\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({ dependencies: { "swagger-ui-express": "^5.0.0" } }),
      "utf8"
    );

    const result = runCli(["init", openapiPath], { cwd: tempDir });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Swagger UI detected/);
    assert.match(result.stdout, /x-openapi-flow-plugin\.js/);
    assert.match(result.stdout, /customJs/);
    assert.match(result.stdout, /showExtensions/);

    const pluginDest = path.join(tempDir, "x-openapi-flow-plugin.js");
    assert.equal(fs.existsSync(pluginDest), true);
    const pluginContent = fs.readFileSync(pluginDest, "utf8");
    assert.match(pluginContent, /XOpenApiFlowPlugin/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("init prints redoc hint when redoc is in package.json", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-init-redoc-detect-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Redoc Detect API\n  version: "1.0.0"\npaths:\n  /items:\n    get:\n      operationId: listItems\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({ dependencies: { redoc: "^2.0.0" } }),
      "utf8"
    );

    const result = runCli(["init", openapiPath], { cwd: tempDir });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Redoc detected/);
    assert.match(result.stdout, /generate-redoc/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("init --dry-run reports swagger-ui and redoc detection without copying files", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-init-dryrun-detect-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Dry Detect API\n  version: "1.0.0"\npaths:\n  /items:\n    get:\n      operationId: listItems\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({ dependencies: { "swagger-ui-express": "^5.0.0", redoc: "^2.0.0" } }),
      "utf8"
    );

    const result = runCli(["init", openapiPath, "--dry-run"], { cwd: tempDir });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[dry-run\] Swagger UI detected/);
    assert.match(result.stdout, /\[dry-run\] Redoc detected/);
    assert.match(result.stdout, /No files were written/);

    assert.equal(fs.existsSync(path.join(tempDir, "x-openapi-flow-plugin.js")), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("init does not emit ui hints when no ui packages in package.json", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-init-no-ui-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: No UI API\n  version: "1.0.0"\npaths:\n  /items:\n    get:\n      operationId: listItems\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({ dependencies: { express: "^4.0.0" } }),
      "utf8"
    );

    const result = runCli(["init", openapiPath], { cwd: tempDir });
    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /Swagger UI detected/);
    assert.doesNotMatch(result.stdout, /Redoc detected/);
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

test("init disambiguates duplicate operationIds in sidecar and generated flow output", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-init-duplicate-operationid-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Duplicate OperationId API\n  version: "1.0.0"\npaths:\n  /restaurants:\n    get:\n      operationId: List\n      responses:\n        "200":\n          description: ok\n  /couriers:\n    get:\n      operationId: List\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    const result = runCli(["init", openapiPath]);
    assert.equal(result.status, 0);

    const sidecarContent = fs.readFileSync(path.join(tempDir, "openapi.x.yaml"), "utf8");
    assert.match(sidecarContent, /operationId: List__get_restaurants/);
    assert.match(sidecarContent, /operationId: List__get_couriers/);

    const flowContent = fs.readFileSync(path.join(tempDir, "openapi.flow.yaml"), "utf8");
    assert.match(flowContent, /operationId: List__get_restaurants/);
    assert.match(flowContent, /operationId: List__get_couriers/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("init --suggest-transitions uses canonical unique operationIds when source operationIds collide", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-init-suggest-duplicate-operationid-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Suggest Duplicate OperationId API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: Action\n      responses:\n        "201":\n          description: created\n  /orders/{id}/cancel:\n    delete:\n      operationId: Action\n      responses:\n        "200":\n          description: canceled\n`,
      "utf8"
    );

    const result = runCli(["init", openapiPath, "--suggest-transitions"]);
    assert.equal(result.status, 0);

    const sidecarContent = fs.readFileSync(path.join(tempDir, "openapi.x.yaml"), "utf8");
    assert.match(sidecarContent, /operationId: Action__post_orders/);
    assert.match(sidecarContent, /operationId: Action__delete_orders_id_cancel/);
    assert.match(sidecarContent, /next_operation_id: Action__delete_orders_id_cancel/);
    assert.match(sidecarContent, /prerequisite_operation_ids:\n\s+- Action__post_orders/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("apply rewrites duplicate source operationIds in generated flow output using canonical sidecar ids", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-apply-duplicate-operationid-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const sidecarPath = path.join(tempDir, "openapi.x.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Apply Duplicate OperationId API\n  version: "1.0.0"\npaths:\n  /restaurants:\n    get:\n      operationId: List\n      responses:\n        "200":\n          description: ok\n  /couriers:\n    get:\n      operationId: List\n      responses:\n        "200":\n          description: ok\n`,
      "utf8"
    );

    fs.writeFileSync(
      sidecarPath,
      `version: '1.0'\noperations:\n  - operationId: List__get_restaurants\n    x-openapi-flow:\n      version: '1.0'\n      id: restaurant-list\n      current_state: RESTAURANT_LIST\n      transitions: []\n  - operationId: List__get_couriers\n    x-openapi-flow:\n      version: '1.0'\n      id: courier-list\n      current_state: COURIER_LIST\n      transitions: []\n`,
      "utf8"
    );

    const apply = runCli(["apply", openapiPath]);
    assert.equal(apply.status, 0);

    const updatedOpenApi = fs.readFileSync(path.join(tempDir, "openapi.flow.yaml"), "utf8");
    assert.match(updatedOpenApi, /operationId: List__get_restaurants/);
    assert.match(updatedOpenApi, /operationId: List__get_couriers/);
    assert.match(updatedOpenApi, /current_state: RESTAURANT_LIST/);
    assert.match(updatedOpenApi, /current_state: COURIER_LIST/);
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
    assert.match(result.stderr, /Failure summary:/);
    assert.match(result.stderr, /invalid next_operation_id refs: 1/);
    assert.match(result.stderr, /Actionable next steps:/);
    assert.match(result.stderr, /Standard lint covers structural correctness/);
    assert.match(result.stderr, /Suggested commands:/);
    assert.match(result.stderr, /\[inspect\]/);
    assert.match(result.stderr, /\[deeper-analysis\]/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("lint --semantic pretty output prints semantic hint", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-lint-sem-ux-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Lint Semantic UX API\n  version: "1.0.0"\npaths:\n  /start:\n    post:\n      operationId: startFlow\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: start-flow\n        current_state: START\n        transitions:\n          - target_state: LOOP\n            trigger_type: synchronous\n            next_operation_id: missingNext\n  /loop:\n    post:\n      operationId: loopFlow\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: loop-flow\n        current_state: LOOP\n        transitions:\n          - target_state: START\n            trigger_type: synchronous\n`,
      "utf8"
    );

    const result = runCli(["lint", openapiPath, "--semantic"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Semantic rules are active/);
    assert.doesNotMatch(result.stderr, /\[deeper-analysis\]/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("lint in CI prints ci-report suggested command", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-lint-ci-ux-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Lint CI UX API\n  version: "1.0.0"\npaths:\n  /start:\n    post:\n      operationId: startFlow\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: start-flow\n        current_state: START\n        transitions:\n          - target_state: DONE\n            trigger_type: synchronous\n            next_operation_id: missingOp\n  /done:\n    post:\n      operationId: doneFlow\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: done-flow\n        current_state: DONE\n        transitions: []\n`,
      "utf8"
    );

    const result = runCli(["lint", openapiPath], { env: { ...process.env, CI: "true" } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[ci-report\]/);
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

test("quality-report emits consolidated JSON with score, grade and breakdown", () => {
  const result = runCli(["quality-report", "examples/order-api.yaml"]);

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(typeof payload.generated_at, "string");
  assert.equal(payload.ok, true);
  assert.equal(typeof payload.score, "number");
  assert.equal(payload.score >= 0 && payload.score <= 100, true);
  assert.match(payload.grade, /^[ABCDF]$/);
  assert.equal(Array.isArray(payload.issues), true);
  assert.equal(typeof payload.breakdown, "object");
  assert.equal(typeof payload.breakdown.schema, "object");
  assert.equal(typeof payload.breakdown.graph, "object");
  assert.equal(typeof payload.breakdown.quality, "object");
});

test("quality-report score drops when schema errors exist", () => {
  const badSpec = path.resolve(FIXTURES_DIR, "missing-version.yaml");
  const result = runCli(["quality-report", badSpec]);

  assert.equal(result.status, 1);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.score < 100, true);
  assert.equal(Array.isArray(payload.issues), true);
  assert.equal(payload.issues.length > 0, true);
});

test("validate --format json includes structured issues with XFLOW codes", () => {
  const badSpec = path.resolve(FIXTURES_DIR, "missing-version.yaml");
  const result = runCli(["validate", badSpec, "--format", "json"]);

  assert.equal(result.status, 1);
  const payload = JSON.parse(result.stdout);
  assert.equal(Array.isArray(payload.issues), true);
  assert.equal(payload.issues.length > 0, true);
  assert.match(payload.issues[0].code, /^XFLOW_[A-Z0-9]+$/);
});

test("validate --format json reports duplicate operationIds with structured quality code", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-validate-duplicate-operationids-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Validate Duplicate OperationIds API\n  version: "1.0.0"\npaths:\n  /restaurants:\n    get:\n      operationId: List\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: restaurants-list\n        current_state: READY\n        transitions: []\n  /couriers:\n    get:\n      operationId: List\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: couriers-list\n        current_state: READY\n        transitions: []\n`,
      "utf8"
    );

    const result = runCli(["validate", openapiPath, "--format", "json", "--profile", "strict"]);
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout);
    const duplicateIssue = payload.issues.find((issue) => issue.code === "XFLOW_W208");
    assert.ok(duplicateIssue);
    assert.match(duplicateIssue.message, /operationId 'List'/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("lint --format json includes code fields for duplicate and terminal issues", () => {
  const duplicateResult = runCli(["lint", "examples/quality-warning-api.yaml", "--format", "json"]);
  assert.equal(duplicateResult.status, 1);
  const duplicatePayload = JSON.parse(duplicateResult.stdout);
  assert.equal(Array.isArray(duplicatePayload.issues.duplicate_transitions), true);
  assert.equal(duplicatePayload.issues.duplicate_transitions.length > 0, true);
  assert.equal(duplicatePayload.issues.duplicate_transitions[0].code, "XFLOW_L303");

  const terminalResult = runCli(["lint", "examples/non-terminating-api.yaml", "--format", "json"]);
  assert.equal(terminalResult.status, 1);
  const terminalPayload = JSON.parse(terminalResult.stdout);
  assert.equal(Array.isArray(terminalPayload.issues.terminal_path.non_terminating_states), true);
  assert.equal(terminalPayload.issues.terminal_path.non_terminating_states.length > 0, true);
  assert.equal(terminalPayload.issues.terminal_path.non_terminating_states[0].code, "XFLOW_L304");
});

test("lint --format json reports duplicate operationIds with dedicated lint code", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-lint-duplicate-operationids-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Lint Duplicate OperationIds API\n  version: "1.0.0"\npaths:\n  /restaurants:\n    get:\n      operationId: List\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: restaurants-list\n        current_state: READY\n        transitions: []\n  /couriers:\n    get:\n      operationId: List\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: couriers-list\n        current_state: READY\n        transitions: []\n`,
      "utf8"
    );

    const result = runCli(["lint", openapiPath, "--format", "json"]);
    assert.equal(result.status, 1);
    const payload = JSON.parse(result.stdout);
    assert.equal(Array.isArray(payload.issues.duplicate_operation_ids), true);
    assert.equal(payload.issues.duplicate_operation_ids.length, 1);
    assert.equal(payload.issues.duplicate_operation_ids[0].code, "XFLOW_L309");
    assert.deepEqual(payload.summary.violated_rules, ["duplicate_operation_ids"]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("lint --format json --semantic includes code field for semantic issues", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-semantic-json-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Semantic JSON Lint API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n      x-openapi-flow:\n        version: "1.0"\n        id: create-order\n        current_state: created\n        transitions:\n          - target_state: PAID\n            trigger_type: synchronous\n            next_operation_id: payOrder\n  /orders/{id}/pay:\n    post:\n      operationId: payOrder\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: pay-order\n        current_state: PAID\n        transitions: []\n`,
      "utf8"
    );

    const result = runCli(["lint", openapiPath, "--format", "json", "--semantic"]);
    assert.equal(result.status, 1);
    const payload = JSON.parse(result.stdout);
    assert.equal(Array.isArray(payload.issues.semantic_consistency), true);
    assert.equal(payload.issues.semantic_consistency.length > 0, true);
    assert.equal(payload.issues.semantic_consistency[0].code, "XFLOW_L305");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("validate accepts AI clarity optional fields in x-openapi-flow schema", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-ai-clarity-schema-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: AI Clarity Schema API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  order_id:\n                    type: string\n                  status:\n                    type: string\n      x-openapi-flow:\n        version: "1.0"\n        id: create-order\n        current_state: CREATED\n        terminal: false\n        transitions:\n          - transition_id: order-created-to-paid\n            from_state: CREATED\n            target_state: PAID\n            trigger_type: synchronous\n            decision_rule: payOrder:response.200.body.status == 'approved'\n            operation_role: mutate\n            transition_priority: 10\n            next_operation_id: payOrder\n            prerequisite_operation_ids:\n              - createOrder\n            prerequisite_field_refs:\n              - createOrder:response.201.body.order_id\n            propagated_field_refs:\n              - createOrder:response.201.body.order_id\n            evidence_refs:\n              - payOrder:response.200.body.status\n            failure_paths:\n              - reason: Payment denied\n                target_state: PAYMENT_FAILED\n                next_operation_id: getOrder\n            compensation_operation_id: cancelOrder\n            async_contract:\n              timeout_ms: 120000\n              max_retries: 5\n              backoff: exponential\n  /orders/{id}/pay:\n    post:\n      operationId: payOrder\n      parameters:\n        - name: id\n          in: path\n          required: true\n          schema:\n            type: string\n      responses:\n        "200":\n          description: ok\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  status:\n                    type: string\n      x-openapi-flow:\n        version: "1.0"\n        id: pay-order\n        current_state: PAID\n        terminal: true\n        transitions: []\n  /orders/{id}:
    get:
      operationId: getOrder
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: ok
      x-openapi-flow:
        version: "1.0"
        id: get-order
        current_state: PAYMENT_FAILED
        terminal: true
        transitions: []\n`,
      "utf8"
    );

    const result = runCli(["validate", openapiPath, "--profile", "strict"]);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("lint --semantic validates decision_rule, evidence_refs and transition_priority determinism", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-semantic-determinism-lint-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Determinism Lint API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n      x-openapi-flow:\n        version: "1.0"\n        id: create-order\n        current_state: CREATED\n        transitions:\n          - target_state: PAID\n            trigger_type: synchronous\n            next_operation_id: payOrder\n          - target_state: PAYMENT_FAILED\n            trigger_type: synchronous\n            decision_rule: getOrder:response.200.body.status == 'payment_failed'\n            transition_priority: 1\n            next_operation_id: getOrder\n  /orders/{id}/pay:\n    post:\n      operationId: payOrder\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: pay-order\n        current_state: PAID\n        transitions: []\n  /orders/{id}:
    get:
      operationId: getOrder
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
      x-openapi-flow:
        version: "1.0"
        id: get-order
        current_state: PAYMENT_FAILED
        transitions: []\n`,
      "utf8"
    );

    const result = runCli(["lint", openapiPath, "--format", "json", "--semantic"]);
    assert.equal(result.status, 1);

    const payload = JSON.parse(result.stdout);
    assert.equal(Array.isArray(payload.issues.decision_rule_clarity), true);
    assert.equal(Array.isArray(payload.issues.evidence_refs_for_decisions), true);
    assert.equal(Array.isArray(payload.issues.transition_priority_determinism), true);
    assert.equal(payload.issues.decision_rule_clarity.length > 0, true);
    assert.equal(payload.issues.evidence_refs_for_decisions.length > 0, true);
    assert.equal(payload.issues.transition_priority_determinism.length > 0, true);
    assert.equal(payload.issues.decision_rule_clarity[0].code, "XFLOW_L306");
    assert.equal(payload.issues.evidence_refs_for_decisions[0].code, "XFLOW_L307");
    assert.equal(payload.issues.transition_priority_determinism[0].code, "XFLOW_L308");
    assert.equal(payload.summary.violated_rules.includes("decision_rule_clarity"), true);
    assert.equal(payload.summary.violated_rules.includes("evidence_refs_for_decisions"), true);
    assert.equal(payload.summary.violated_rules.includes("transition_priority_determinism"), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("validate strict succeeds on ai-clarity example with new fields", () => {
  const result = runCli(["validate", "examples/ai-clarity-order-api.yaml", "--profile", "strict"]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /All validations passed/);
});

test("validate fails for invalid enum in new AI clarity fields", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-invalid-ai-enum-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Invalid AI Enum API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n      x-openapi-flow:\n        version: "1.0"\n        id: create-order\n        current_state: CREATED\n        transitions:\n          - target_state: PAID\n            trigger_type: synchronous\n            operation_role: mutate-now\n            async_contract:\n              timeout_ms: 1000\n              max_retries: 1\n              backoff: jitter\n            next_operation_id: payOrder\n  /orders/{id}/pay:\n    post:\n      operationId: payOrder\n      parameters:\n        - name: id\n          in: path\n          required: true\n          schema:\n            type: string\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: pay-order\n        current_state: PAID\n        transitions: []\n`,
      "utf8"
    );

    const result = runCli(["validate", openapiPath, "--profile", "strict"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /operation_role/);
    assert.match(result.stderr, /async_contract\/backoff/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("lint semantic passes when new determinism rules are disabled via config", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-semantic-rules-disabled-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");
  const configPath = path.join(tempDir, "x-openapi-flow.config.json");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Semantic Rules Disabled API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n      x-openapi-flow:\n        version: "1.0"\n        id: create-order\n        current_state: CREATED\n        transitions:\n          - target_state: PAID\n            trigger_type: synchronous\n            next_operation_id: payOrder\n          - target_state: PAYMENT_FAILED\n            trigger_type: synchronous\n            next_operation_id: getOrder\n  /orders/{id}/pay:\n    post:\n      operationId: payOrder\n      parameters:\n        - name: id\n          in: path\n          required: true\n          schema:\n            type: string\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: pay-order\n        current_state: PAID\n        transitions: []\n  /orders/{id}:\n    get:\n      operationId: getOrder\n      parameters:\n        - name: id\n          in: path\n          required: true\n          schema:\n            type: string\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: get-order\n        current_state: PAYMENT_FAILED\n        transitions: []\n`,
      "utf8"
    );

    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          lint: {
            rules: {
              semantic: true,
              decision_rule_clarity: false,
              evidence_refs_for_decisions: false,
              transition_priority_determinism: false,
            },
          },
        },
        null,
        2
      ),
      "utf8"
    );

    const result = runCli(["lint", openapiPath, "--format", "json", "--config", configPath]);
    assert.equal(result.status, 0, result.stderr);

    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ruleConfig.semantic_consistency, true);
    assert.equal(payload.ruleConfig.decision_rule_clarity, false);
    assert.equal(payload.ruleConfig.evidence_refs_for_decisions, false);
    assert.equal(payload.ruleConfig.transition_priority_determinism, false);
    assert.equal(payload.issues.decision_rule_clarity.length, 0);
    assert.equal(payload.issues.evidence_refs_for_decisions.length, 0);
    assert.equal(payload.issues.transition_priority_determinism.length, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("validate fails when failure_paths entry misses required fields", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-invalid-failure-path-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Invalid Failure Path API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n      x-openapi-flow:\n        version: "1.0"\n        id: create-order\n        current_state: CREATED\n        transitions:\n          - target_state: PAID\n            trigger_type: synchronous\n            next_operation_id: payOrder\n            failure_paths:\n              - target_state: PAYMENT_FAILED\n                next_operation_id: getOrder\n  /orders/{id}/pay:\n    post:\n      operationId: payOrder\n      parameters:\n        - name: id\n          in: path\n          required: true\n          schema:\n            type: string\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: pay-order\n        current_state: PAID\n        transitions: []\n  /orders/{id}:\n    get:\n      operationId: getOrder\n      parameters:\n        - name: id\n          in: path\n          required: true\n          schema:\n            type: string\n      responses:\n        "200":\n          description: ok\n      x-openapi-flow:\n        version: "1.0"\n        id: get-order\n        current_state: PAYMENT_FAILED\n        transitions: []\n`,
      "utf8"
    );

    const result = runCli(["validate", openapiPath, "--profile", "strict", "--format", "json"]);
    assert.equal(result.status, 1);

    const normalized = normalizeValidateJsonOutput(result.stdout);
    const snapshot = readFixture("validate-invalid-failure-path.snapshot.json");
    assert.equal(normalized, snapshot);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("lint semantic flags duplicate transition_priority across 3 branching transitions", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-duplicate-priority-3-branches-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Duplicate Priority API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n      x-openapi-flow:\n        version: "1.0"\n        id: create-order\n        current_state: CREATED\n        transitions:\n          - target_state: PAID\n            trigger_type: synchronous\n            decision_rule: payOrder:response.200.body.status == 'approved'\n            transition_priority: 1\n            next_operation_id: payOrder\n            evidence_refs:\n              - payOrder:response.200.body.status\n          - target_state: PAYMENT_FAILED\n            trigger_type: synchronous\n            decision_rule: getOrder:response.200.body.status == 'failed'\n            transition_priority: 1\n            next_operation_id: getOrder\n            evidence_refs:\n              - getOrder:response.200.body.status\n          - target_state: REVIEW\n            trigger_type: synchronous\n            decision_rule: reviewOrder:response.200.body.status == 'review'\n            transition_priority: 1\n            next_operation_id: reviewOrder\n            evidence_refs:\n              - reviewOrder:response.200.body.status\n  /orders/{id}/pay:\n    post:\n      operationId: payOrder\n      parameters:\n        - name: id\n          in: path\n          required: true\n          schema:\n            type: string\n      responses:\n        "200":\n          description: ok\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  status:\n                    type: string\n      x-openapi-flow:\n        version: "1.0"\n        id: pay-order\n        current_state: PAID\n        transitions: []\n  /orders/{id}:\n    get:\n      operationId: getOrder\n      parameters:\n        - name: id\n          in: path\n          required: true\n          schema:\n            type: string\n      responses:\n        "200":\n          description: ok\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  status:\n                    type: string\n      x-openapi-flow:\n        version: "1.0"\n        id: get-order\n        current_state: PAYMENT_FAILED\n        transitions: []\n  /orders/{id}/review:\n    post:\n      operationId: reviewOrder\n      parameters:\n        - name: id\n          in: path\n          required: true\n          schema:\n            type: string\n      responses:\n        "200":\n          description: ok\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  status:\n                    type: string\n      x-openapi-flow:\n        version: "1.0"\n        id: review-order\n        current_state: REVIEW\n        transitions: []\n`,
      "utf8"
    );

    const result = runCli(["lint", openapiPath, "--format", "json", "--semantic"]);
    assert.equal(result.status, 1);

    const normalized = normalizeLintJsonOutput(result.stdout);
    const snapshot = readFixture("lint-duplicate-priority-3-branches.snapshot.json");
    assert.equal(normalized, snapshot);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("lint semantic snapshots decision_rule_clarity violations", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-decision-rule-clarity-snapshot-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Decision Rule Clarity API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n      x-openapi-flow:\n        version: "1.0"\n        id: create-order\n        current_state: CREATED\n        transitions:\n          - target_state: PAID\n            trigger_type: synchronous\n            transition_priority: 10\n            next_operation_id: payOrder\n            evidence_refs:\n              - payOrder:response.200.body.status\n          - target_state: PAYMENT_FAILED\n            trigger_type: synchronous\n            transition_priority: 20\n            next_operation_id: getOrder\n            evidence_refs:\n              - getOrder:response.200.body.status\n  /orders/{id}/pay:\n    post:\n      operationId: payOrder\n      parameters:\n        - name: id\n          in: path\n          required: true\n          schema:\n            type: string\n      responses:\n        "200":\n          description: ok\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  status:\n                    type: string\n      x-openapi-flow:\n        version: "1.0"\n        id: pay-order\n        current_state: PAID\n        transitions: []\n  /orders/{id}:\n    get:\n      operationId: getOrder\n      parameters:\n        - name: id\n          in: path\n          required: true\n          schema:\n            type: string\n      responses:\n        "200":\n          description: ok\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  status:\n                    type: string\n      x-openapi-flow:\n        version: "1.0"\n        id: get-order\n        current_state: PAYMENT_FAILED\n        transitions: []\n`,
      "utf8"
    );

    const result = runCli(["lint", openapiPath, "--format", "json", "--semantic"]);
    assert.equal(result.status, 1);

    const normalized = normalizeLintJsonOutput(result.stdout);
    const snapshot = readFixture("lint-decision-rule-clarity.snapshot.json");
    assert.equal(normalized, snapshot);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("lint semantic snapshots evidence_refs_for_decisions violations", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-evidence-refs-snapshot-"));
  const openapiPath = path.join(tempDir, "openapi.yaml");

  try {
    fs.writeFileSync(
      openapiPath,
      `openapi: "3.0.3"\ninfo:\n  title: Evidence Refs API\n  version: "1.0.0"\npaths:\n  /orders:\n    post:\n      operationId: createOrder\n      responses:\n        "201":\n          description: created\n      x-openapi-flow:\n        version: "1.0"\n        id: create-order\n        current_state: CREATED\n        transitions:\n          - target_state: PAID\n            trigger_type: synchronous\n            decision_rule: payOrder:response.200.body.status == 'approved'\n            transition_priority: 10\n            next_operation_id: payOrder\n          - target_state: PAYMENT_FAILED\n            trigger_type: synchronous\n            decision_rule: getOrder:response.200.body.status == 'failed'\n            transition_priority: 20\n            next_operation_id: getOrder\n  /orders/{id}/pay:\n    post:\n      operationId: payOrder\n      parameters:\n        - name: id\n          in: path\n          required: true\n          schema:\n            type: string\n      responses:\n        "200":\n          description: ok\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  status:\n                    type: string\n      x-openapi-flow:\n        version: "1.0"\n        id: pay-order\n        current_state: PAID\n        transitions: []\n  /orders/{id}:\n    get:\n      operationId: getOrder\n      parameters:\n        - name: id\n          in: path\n          required: true\n          schema:\n            type: string\n      responses:\n        "200":\n          description: ok\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  status:\n                    type: string\n      x-openapi-flow:\n        version: "1.0"\n        id: get-order\n        current_state: PAYMENT_FAILED\n        transitions: []\n`,
      "utf8"
    );

    const result = runCli(["lint", openapiPath, "--format", "json", "--semantic"]);
    assert.equal(result.status, 1);

    const normalized = normalizeLintJsonOutput(result.stdout);
    const snapshot = readFixture("lint-evidence-refs-for-decisions.snapshot.json");
    assert.equal(normalized, snapshot);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
