"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const PACKAGE_ROOT = path.resolve(__dirname, "..", "..");
const REPO_ROOT = path.resolve(PACKAGE_ROOT, "..");
const EXAMPLE_ROOT = path.join(REPO_ROOT, "example");
const CLI_PATH = path.resolve(PACKAGE_ROOT, "bin", "x-openapi-flow.js");

function runCli(args) {
  const result = spawnSync("node", [CLI_PATH, ...args], {
    cwd: PACKAGE_ROOT,
    encoding: "utf8",
  });

  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function buildFlowSpecFromExample(exampleFolder, tempDir) {
  const baseSpecPath = path.join(EXAMPLE_ROOT, exampleFolder, "swagger.json");
  const sidecarPath = path.join(EXAMPLE_ROOT, exampleFolder, "examples", "swagger.x.yaml");
  const flowSpecPath = path.join(tempDir, `${exampleFolder}.flow.json`);

  const applyResult = runCli([
    "apply",
    baseSpecPath,
    "--flows",
    sidecarPath,
    "--out",
    flowSpecPath,
  ]);

  assert.equal(applyResult.status, 0, `apply failed for ${exampleFolder}:\n${applyResult.stderr}`);

  const validateResult = runCli(["validate", flowSpecPath, "--profile", "strict"]);
  assert.equal(validateResult.status, 0, `validate failed for ${exampleFolder}:\n${validateResult.stderr}`);

  return flowSpecPath;
}

test("swagger-ui example can apply flow sidecar and render graph json", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-example-swagger-"));

  try {
    const flowSpecPath = buildFlowSpecFromExample("swagger-ui", tempDir);

    const graphResult = runCli(["graph", flowSpecPath, "--format", "json"]);
    assert.equal(graphResult.status, 0, `graph failed:\n${graphResult.stderr}`);

    const payload = JSON.parse(graphResult.stdout);
    assert.ok(Array.isArray(payload.nodes) && payload.nodes.length > 0, "graph json should contain nodes");
    assert.ok(Array.isArray(payload.edges), "graph json should contain edges array");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("redoc example generates package files from flow-applied spec", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-example-redoc-"));

  try {
    const flowSpecPath = buildFlowSpecFromExample("redoc", tempDir);
    const outputDir = path.join(tempDir, "redoc-flow");

    const result = runCli(["generate-redoc", flowSpecPath, "--output", outputDir]);
    assert.equal(result.status, 0, `generate-redoc failed:\n${result.stderr}`);

    const indexPath = path.join(outputDir, "index.html");
    const pluginPath = path.join(outputDir, "x-openapi-flow-redoc-plugin.js");
    const modelPath = path.join(outputDir, "flow-model.json");

    assert.equal(fs.existsSync(indexPath), true, "redoc index.html should be generated");
    assert.equal(fs.existsSync(pluginPath), true, "redoc plugin should be generated");
    assert.equal(fs.existsSync(modelPath), true, "redoc flow model should be generated");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("postman example generates flow-oriented collection", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-example-postman-"));

  try {
    const flowSpecPath = buildFlowSpecFromExample("postman", tempDir);
    const outputPath = path.join(tempDir, "x-openapi-flow.postman_collection.json");

    const result = runCli(["generate-postman", flowSpecPath, "--output", outputPath, "--with-scripts"]);
    assert.equal(result.status, 0, `generate-postman failed:\n${result.stderr}`);

    const collection = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    assert.ok(Array.isArray(collection.item) && collection.item.length > 0, "collection should have folders");

    const requestNames = collection.item
      .flatMap((group) => (group.item || []))
      .flatMap((item) => (item.item ? item.item : [item]))
      .map((request) => request.name)
      .filter(Boolean);

    assert.ok(requestNames.includes("createOrder"), "collection should include createOrder request");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("insomnia example generates workspace export with request groups", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-openapi-flow-example-insomnia-"));

  try {
    const flowSpecPath = buildFlowSpecFromExample("insomnia", tempDir);
    const outputPath = path.join(tempDir, "x-openapi-flow.insomnia.json");

    const result = runCli(["generate-insomnia", flowSpecPath, "--output", outputPath]);
    assert.equal(result.status, 0, `generate-insomnia failed:\n${result.stderr}`);

    const exportPayload = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    assert.ok(Array.isArray(exportPayload.resources), "insomnia export should have resources");

    const hasWorkspace = exportPayload.resources.some((resource) => resource._type === "workspace");
    const hasRequestGroup = exportPayload.resources.some((resource) => resource._type === "request_group");
    const hasRequest = exportPayload.resources.some((resource) => resource._type === "request");

    assert.equal(hasWorkspace, true, "insomnia export should include workspace");
    assert.equal(hasRequestGroup, true, "insomnia export should include request groups");
    assert.equal(hasRequest, true, "insomnia export should include requests");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
