"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const FLOW_SPEC_ROOT = path.resolve(__dirname, "..", "..");
const CLI_PATH = path.resolve(FLOW_SPEC_ROOT, "bin", "x-openapi-flow.js");

function runCli(args) {
  const result = spawnSync("node", [CLI_PATH, ...args], {
    cwd: FLOW_SPEC_ROOT,
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}

const ORDER_SPEC = `openapi: "3.0.3"
info:
  title: Order API
  version: "1.0.0"
paths:
  /orders:
    post:
      operationId: createOrder
      responses:
        "200":
          description: ok
      x-openapi-flow:
        version: "1.0"
        id: create-order
        current_state: OrderCreated
        transitions:
          - trigger_type: synchronous
            target_state: OrderConfirmed
            next_operation_id: confirmOrder
  /orders/{orderId}/confirm:
    post:
      operationId: confirmOrder
      responses:
        "200":
          description: ok
      x-openapi-flow:
        version: "1.0"
        id: confirm-order
        current_state: OrderConfirmed
        transitions: []
`;

test("generate-sdk and export-doc-flows produce coherent outputs for the same spec", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-flow-integration-"));
  const specPath = path.join(tempDir, "openapi.yaml");
  const sdkDir = path.join(tempDir, "sdk");
  const docPath = path.join(tempDir, "api-flows.md");

  try {
    fs.writeFileSync(specPath, ORDER_SPEC, "utf8");

    const sdkResult = runCli(["generate-sdk", specPath, "--lang", "typescript", "--output", sdkDir]);
    assert.equal(sdkResult.status, 0, `generate-sdk failed:\n${sdkResult.stderr}`);

    const docResult = runCli(["export-doc-flows", specPath, "--output", docPath]);
    assert.equal(docResult.status, 0, `export-doc-flows failed:\n${docResult.stderr}`);

    // Both commands should produce output using the same intermediate model
    const flowModel = JSON.parse(fs.readFileSync(path.join(sdkDir, "flow-model.json"), "utf8"));
    assert.ok(flowModel.resources && flowModel.resources.length > 0, "SDK model should have at least one resource");

    const docContent = fs.readFileSync(docPath, "utf8");
    assert.match(docContent, /# API Flows/, "Lifecycle doc should have API Flows heading");

    // Every resource name the SDK identified should appear in the doc output
    for (const resource of flowModel.resources) {
      assert.ok(
        docContent.toLowerCase().includes(resource.resource.toLowerCase()),
        `Doc should include resource '${resource.resource}'`
      );
    }

    // Every lifecycle state in the SDK model should appear in the doc output
    const sdkStates = new Set();
    for (const resource of flowModel.resources) {
      for (const op of resource.operations.filter((o) => o.hasFlow)) {
        if (op.currentState) sdkStates.add(op.currentState);
      }
    }
    for (const state of sdkStates) {
      assert.ok(
        docContent.includes(state),
        `Doc should include state '${state}' found in SDK model`
      );
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("generate-postman and generate-insomnia produce valid lifecycle exports for the same spec", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-flow-integration-"));
  const specPath = path.join(tempDir, "openapi.yaml");
  const postmanPath = path.join(tempDir, "collection.postman_collection.json");
  const insomniaPath = path.join(tempDir, "workspace.insomnia.json");

  try {
    fs.writeFileSync(specPath, ORDER_SPEC, "utf8");

    const postmanResult = runCli(["generate-postman", specPath, "--output", postmanPath]);
    assert.equal(postmanResult.status, 0, `generate-postman failed:\n${postmanResult.stderr}`);

    const insomniaResult = runCli(["generate-insomnia", specPath, "--output", insomniaPath]);
    assert.equal(insomniaResult.status, 0, `generate-insomnia failed:\n${insomniaResult.stderr}`);

    const postmanCollection = JSON.parse(fs.readFileSync(postmanPath, "utf8"));
    const insomniaExport = JSON.parse(fs.readFileSync(insomniaPath, "utf8"));

    // Postman: should have at least one folder (lifecycle resource group)
    assert.ok(postmanCollection.item && postmanCollection.item.length > 0, "Postman collection should have items");

    // Insomnia: should have a workspace and request_group resources
    assert.ok(
      insomniaExport.resources && insomniaExport.resources.some((r) => r._type === "workspace"),
      "Insomnia export should have a workspace resource"
    );
    assert.ok(
      insomniaExport.resources.some((r) => r._type === "request_group"),
      "Insomnia export should have at least one request group"
    );

    // Both exports should reference the same operationIds
    const postmanOpIds = postmanCollection.item
      .flatMap((folder) => (folder.item || []).flatMap((journey) => (journey.item || [journey]).map((item) => item.name)))
      .filter(Boolean);
    const insomniaReqNames = insomniaExport.resources
      .filter((r) => r._type === "request")
      .map((r) => r.name);

    assert.ok(postmanOpIds.includes("createOrder"), "Postman should include createOrder");
    assert.ok(insomniaReqNames.includes("createOrder"), "Insomnia should include createOrder");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
