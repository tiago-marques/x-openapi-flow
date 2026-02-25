#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const {
  run,
  loadApi,
  extractFlows,
} = require("../lib/validator");

const DEFAULT_CONFIG_NAME = "x-openapi-flow.config.json";
const DEFAULT_FLOWS_FILE = "x-openapi-flow.flows.yaml";

function resolveConfigPath(configPathArg) {
  return configPathArg
    ? path.resolve(configPathArg)
    : path.resolve(process.cwd(), DEFAULT_CONFIG_NAME);
}

function loadConfig(configPathArg) {
  const configPath = resolveConfigPath(configPathArg);
  if (!fs.existsSync(configPath)) {
    return { path: configPath, exists: false, data: {} };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return { path: configPath, exists: true, data: parsed };
  } catch (err) {
    return {
      path: configPath,
      exists: true,
      error: `Could not parse config file: ${err.message}`,
      data: {},
    };
  }
}

function printHelp() {
  console.log(`x-openapi-flow CLI

Usage:
  x-openapi-flow validate <openapi-file> [--format pretty|json] [--profile core|relaxed|strict] [--strict-quality] [--config path]
  x-openapi-flow init [openapi-file] [--flows path]
  x-openapi-flow apply [openapi-file] [--flows path] [--out path]
  x-openapi-flow graph <openapi-file> [--format mermaid|json]
  x-openapi-flow doctor [--config path]
  x-openapi-flow --help

Examples:
  x-openapi-flow validate examples/order-api.yaml
  x-openapi-flow validate examples/order-api.yaml --profile relaxed
  x-openapi-flow validate examples/order-api.yaml --strict-quality
  x-openapi-flow init openapi.yaml --flows x-openapi-flow.flows.yaml
  x-openapi-flow init
  x-openapi-flow apply openapi.yaml
  x-openapi-flow apply openapi.yaml --out openapi.flow.yaml
  x-openapi-flow graph examples/order-api.yaml
  x-openapi-flow doctor
`);
}

function getOptionValue(args, optionName) {
  const index = args.indexOf(optionName);
  if (index === -1) {
    return { found: false };
  }

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    return { found: true, error: `Missing value for ${optionName}.` };
  }

  return { found: true, value, index };
}

function findUnknownOptions(args, knownOptionsWithValue, knownFlags) {
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      continue;
    }

    if (knownFlags.includes(token)) {
      continue;
    }

    if (knownOptionsWithValue.includes(token)) {
      index += 1;
      continue;
    }

    return token;
  }

  return null;
}

function parseValidateArgs(args) {
  const unknown = findUnknownOptions(
    args,
    ["--format", "--profile", "--config"],
    ["--strict-quality"]
  );
  if (unknown) {
    return { error: `Unknown option: ${unknown}` };
  }

  const formatOpt = getOptionValue(args, "--format");
  if (formatOpt.error) {
    return { error: `${formatOpt.error} Use 'pretty' or 'json'.` };
  }

  const profileOpt = getOptionValue(args, "--profile");
  if (profileOpt.error) {
    return { error: `${profileOpt.error} Use 'core', 'relaxed', or 'strict'.` };
  }

  const configOpt = getOptionValue(args, "--config");
  if (configOpt.error) {
    return { error: configOpt.error };
  }

  const strictQuality = args.includes("--strict-quality");
  const format = formatOpt.found ? formatOpt.value : undefined;
  const profile = profileOpt.found ? profileOpt.value : undefined;

  if (format && !["pretty", "json"].includes(format)) {
    return { error: `Invalid --format '${format}'. Use 'pretty' or 'json'.` };
  }

  if (profile && !["core", "relaxed", "strict"].includes(profile)) {
    return { error: `Invalid --profile '${profile}'. Use 'core', 'relaxed', or 'strict'.` };
  }

  const positional = args.filter((token, index) => {
    if (["--format", "--profile", "--config"].includes(token)) {
      return false;
    }

    if (
      index > 0 &&
      ["--format", "--profile", "--config"].includes(args[index - 1])
    ) {
      return false;
    }

    return !token.startsWith("--") || token === "-";
  });

  if (positional.length === 0) {
    return { error: "Missing OpenAPI file path. Usage: x-openapi-flow validate <openapi-file>" };
  }

  if (positional.length > 1) {
    return { error: `Unexpected argument: ${positional[1]}` };
  }

  return {
    filePath: path.resolve(positional[0]),
    strictQuality,
    format,
    profile,
    configPath: configOpt.found ? configOpt.value : undefined,
  };
}

function parseInitArgs(args) {
  const unknown = findUnknownOptions(args, ["--flows"], []);
  if (unknown) {
    return { error: `Unknown option: ${unknown}` };
  }

  const flowsOpt = getOptionValue(args, "--flows");
  if (flowsOpt.error) {
    return { error: flowsOpt.error };
  }

  const positional = args.filter((token, index) => {
    if (token === "--flows") {
      return false;
    }
    if (index > 0 && args[index - 1] === "--flows") {
      return false;
    }
    return !token.startsWith("--");
  });

  if (positional.length > 1) {
    return { error: `Unexpected argument: ${positional[1]}` };
  }

  return {
    openApiFile: positional[0] ? path.resolve(positional[0]) : undefined,
    flowsPath: flowsOpt.found ? path.resolve(flowsOpt.value) : undefined,
  };
}

function parseApplyArgs(args) {
  const unknown = findUnknownOptions(args, ["--flows", "--out"], []);
  if (unknown) {
    return { error: `Unknown option: ${unknown}` };
  }

  const flowsOpt = getOptionValue(args, "--flows");
  if (flowsOpt.error) {
    return { error: flowsOpt.error };
  }

  const outOpt = getOptionValue(args, "--out");
  if (outOpt.error) {
    return { error: outOpt.error };
  }

  const positional = args.filter((token, index) => {
    if (token === "--flows" || token === "--out") {
      return false;
    }
    if (index > 0 && (args[index - 1] === "--flows" || args[index - 1] === "--out")) {
      return false;
    }
    return !token.startsWith("--");
  });

  if (positional.length > 1) {
    return { error: `Unexpected argument: ${positional[1]}` };
  }

  return {
    openApiFile: positional[0] ? path.resolve(positional[0]) : undefined,
    flowsPath: flowsOpt.found ? path.resolve(flowsOpt.value) : undefined,
    outPath: outOpt.found ? path.resolve(outOpt.value) : undefined,
  };
}

function parseGraphArgs(args) {
  const unknown = findUnknownOptions(args, ["--format"], []);
  if (unknown) {
    return { error: `Unknown option: ${unknown}` };
  }

  const formatOpt = getOptionValue(args, "--format");
  if (formatOpt.error) {
    return { error: `${formatOpt.error} Use 'mermaid' or 'json'.` };
  }

  const format = formatOpt.found ? formatOpt.value : "mermaid";
  if (!["mermaid", "json"].includes(format)) {
    return { error: `Invalid --format '${format}'. Use 'mermaid' or 'json'.` };
  }

  const positional = args.filter((token, index) => {
    if (token === "--format") {
      return false;
    }
    if (index > 0 && args[index - 1] === "--format") {
      return false;
    }
    return !token.startsWith("--");
  });

  if (positional.length === 0) {
    return { error: "Missing OpenAPI file path. Usage: x-openapi-flow graph <openapi-file>" };
  }

  if (positional.length > 1) {
    return { error: `Unexpected argument: ${positional[1]}` };
  }

  return { filePath: path.resolve(positional[0]), format };
}

function parseDoctorArgs(args) {
  const unknown = findUnknownOptions(args, ["--config"], []);
  if (unknown) {
    return { error: `Unknown option: ${unknown}` };
  }

  const configOpt = getOptionValue(args, "--config");
  if (configOpt.error) {
    return { error: configOpt.error };
  }

  return {
    configPath: configOpt.found ? configOpt.value : undefined,
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    return { help: true };
  }

  const commandArgs = args.slice(1);
  if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
    return { help: true, command };
  }

  if (command === "validate") {
    const parsed = parseValidateArgs(commandArgs);
    return parsed.error ? parsed : { command, ...parsed };
  }

  if (command === "init") {
    const parsed = parseInitArgs(commandArgs);
    return parsed.error ? parsed : { command, ...parsed };
  }

  if (command === "graph") {
    const parsed = parseGraphArgs(commandArgs);
    return parsed.error ? parsed : { command, ...parsed };
  }

  if (command === "apply") {
    const parsed = parseApplyArgs(commandArgs);
    return parsed.error ? parsed : { command, ...parsed };
  }

  if (command === "doctor") {
    const parsed = parseDoctorArgs(commandArgs);
    return parsed.error ? parsed : { command, ...parsed };
  }

  return { error: `Unknown command: ${command}` };
}

function findOpenApiFile(startDirectory) {
  const preferredNames = [
    "openapi.yaml",
    "openapi.yml",
    "openapi.json",
    "swagger.yaml",
    "swagger.yml",
    "swagger.json",
  ];

  for (const fileName of preferredNames) {
    const candidate = path.join(startDirectory, fileName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const ignoredDirs = new Set(["node_modules", ".git", "dist", "build"]);

  function walk(directory) {
    let entries = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (_err) {
      return null;
    }

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) {
          const nested = walk(fullPath);
          if (nested) {
            return nested;
          }
        }
        continue;
      }

      if (preferredNames.includes(entry.name)) {
        return fullPath;
      }
    }

    return null;
  }

  return walk(startDirectory);
}

function resolveFlowsPath(openApiFile, customFlowsPath) {
  if (customFlowsPath) {
    return customFlowsPath;
  }

  if (openApiFile) {
    return path.join(path.dirname(openApiFile), DEFAULT_FLOWS_FILE);
  }

  return path.resolve(process.cwd(), DEFAULT_FLOWS_FILE);
}

function getOpenApiFormat(filePath) {
  return filePath.endsWith(".json") ? "json" : "yaml";
}

function saveOpenApi(filePath, api) {
  const format = getOpenApiFormat(filePath);
  const content = format === "json"
    ? JSON.stringify(api, null, 2) + "\n"
    : yaml.dump(api, { noRefs: true, lineWidth: -1 });

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function extractOperationEntries(api) {
  const entries = [];
  const paths = (api && api.paths) || {};
  const httpMethods = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    for (const method of httpMethods) {
      const operation = pathItem[method];
      if (!operation) {
        continue;
      }

      const operationId = operation.operationId;
      const key = operationId ? `operationId:${operationId}` : `${method.toUpperCase()} ${pathKey}`;

      entries.push({
        key,
        operationId,
        method,
        path: pathKey,
      });
    }
  }

  return entries;
}

function readFlowsFile(flowsPath) {
  if (!fs.existsSync(flowsPath)) {
    return {
      version: "1.0",
      operations: [],
    };
  }

  const content = fs.readFileSync(flowsPath, "utf8");
  const parsed = yaml.load(content);

  if (!parsed || typeof parsed !== "object") {
    return { version: "1.0", operations: [] };
  }

  return {
    version: parsed.version || "1.0",
    operations: Array.isArray(parsed.operations) ? parsed.operations : [],
  };
}

function writeFlowsFile(flowsPath, flowsDoc) {
  fs.mkdirSync(path.dirname(flowsPath), { recursive: true });
  const content = yaml.dump(flowsDoc, { noRefs: true, lineWidth: -1 });
  fs.writeFileSync(flowsPath, content, "utf8");
}

function buildOperationLookup(api) {
  const lookupByKey = new Map();
  const lookupByOperationId = new Map();
  const entries = extractOperationEntries(api);

  for (const entry of entries) {
    lookupByKey.set(entry.key, entry);
    if (entry.operationId) {
      lookupByOperationId.set(entry.operationId, entry);
    }
  }

  return { entries, lookupByKey, lookupByOperationId };
}

function mergeFlowsWithOpenApi(api, flowsDoc) {
  const { entries, lookupByKey, lookupByOperationId } = buildOperationLookup(api);

  const existingByKey = new Map();
  for (const entry of flowsDoc.operations) {
    const entryKey = entry.key || (entry.operationId ? `operationId:${entry.operationId}` : null);
    if (entryKey) {
      existingByKey.set(entryKey, entry);
    }
  }

  const mergedOperations = [];

  for (const op of entries) {
    const existing = existingByKey.get(op.key);
    if (existing) {
      mergedOperations.push({
        ...existing,
        key: op.key,
        operationId: op.operationId,
        method: op.method,
        path: op.path,
        missing_in_openapi: false,
      });
    } else {
      mergedOperations.push({
        key: op.key,
        operationId: op.operationId,
        method: op.method,
        path: op.path,
        "x-openapi-flow": null,
        missing_in_openapi: false,
      });
    }
  }

  for (const existing of flowsDoc.operations) {
    const existingKey = existing.key || (existing.operationId ? `operationId:${existing.operationId}` : null);
    const found = existingKey && lookupByKey.has(existingKey);

    if (!found) {
      mergedOperations.push({
        ...existing,
        missing_in_openapi: true,
      });
    }
  }

  return {
    version: "1.0",
    operations: mergedOperations,
  };
}

function applyFlowsToOpenApi(api, flowsDoc) {
  const paths = (api && api.paths) || {};
  let appliedCount = 0;
  const { lookupByKey, lookupByOperationId } = buildOperationLookup(api);

  for (const flowEntry of flowsDoc.operations || []) {
    if (!flowEntry || flowEntry.missing_in_openapi === true) {
      continue;
    }

    const flowValue = flowEntry["x-openapi-flow"];
    if (!flowValue || typeof flowValue !== "object") {
      continue;
    }

    let target = null;
    if (flowEntry.operationId && lookupByOperationId.has(flowEntry.operationId)) {
      target = lookupByOperationId.get(flowEntry.operationId);
    } else if (flowEntry.key && lookupByKey.has(flowEntry.key)) {
      target = lookupByKey.get(flowEntry.key);
    }

    if (!target) {
      continue;
    }

    const pathItem = paths[target.path];
    if (pathItem && pathItem[target.method]) {
      pathItem[target.method]["x-openapi-flow"] = flowValue;
      appliedCount += 1;
    }
  }

  return appliedCount;
}

function runInit(parsed) {
  const targetOpenApiFile = parsed.openApiFile || findOpenApiFile(process.cwd());

  if (!targetOpenApiFile) {
    console.error("ERROR: Could not find an existing OpenAPI file in this repository.");
    console.error("Expected one of: openapi.yaml|yml|json, swagger.yaml|yml|json");
    console.error("Create your OpenAPI/Swagger spec first (using your framework's official generator), then run init again.");
    return 1;
  }

  const flowsPath = resolveFlowsPath(targetOpenApiFile, parsed.flowsPath);

  let api;
  try {
    api = loadApi(targetOpenApiFile);
  } catch (err) {
    console.error(`ERROR: Could not parse OpenAPI file — ${err.message}`);
    return 1;
  }

  let flowsDoc;
  try {
    flowsDoc = readFlowsFile(flowsPath);
  } catch (err) {
    console.error(`ERROR: Could not parse flows file — ${err.message}`);
    return 1;
  }

  const mergedFlows = mergeFlowsWithOpenApi(api, flowsDoc);
  writeFlowsFile(flowsPath, mergedFlows);
  const appliedCount = applyFlowsToOpenApi(api, mergedFlows);
  saveOpenApi(targetOpenApiFile, api);

  const trackedCount = mergedFlows.operations.filter((entry) => !entry.missing_in_openapi).length;
  const orphanCount = mergedFlows.operations.filter((entry) => entry.missing_in_openapi).length;

  console.log(`Using existing OpenAPI file: ${targetOpenApiFile}`);
  console.log(`Flows sidecar synced: ${flowsPath}`);
  console.log(`Tracked operations: ${trackedCount}`);
  if (orphanCount > 0) {
    console.log(`Orphan flow entries kept in sidecar: ${orphanCount}`);
  }
  console.log(`Applied x-openapi-flow entries to OpenAPI: ${appliedCount}`);

  console.log(`Validate now: x-openapi-flow validate ${targetOpenApiFile}`);
  return 0;
}

function runApply(parsed) {
  const targetOpenApiFile = parsed.openApiFile || findOpenApiFile(process.cwd());

  if (!targetOpenApiFile) {
    console.error("ERROR: Could not find an existing OpenAPI file in this repository.");
    console.error("Expected one of: openapi.yaml|yml|json, swagger.yaml|yml|json");
    return 1;
  }

  const flowsPath = resolveFlowsPath(targetOpenApiFile, parsed.flowsPath);
  if (!fs.existsSync(flowsPath)) {
    console.error(`ERROR: Flows sidecar not found: ${flowsPath}`);
    console.error("Run `x-openapi-flow init` first to create and sync the sidecar.");
    return 1;
  }

  let api;
  let flowsDoc;
  try {
    api = loadApi(targetOpenApiFile);
  } catch (err) {
    console.error(`ERROR: Could not parse OpenAPI file — ${err.message}`);
    return 1;
  }

  try {
    flowsDoc = readFlowsFile(flowsPath);
  } catch (err) {
    console.error(`ERROR: Could not parse flows file — ${err.message}`);
    return 1;
  }

  const appliedCount = applyFlowsToOpenApi(api, flowsDoc);
  const outputPath = parsed.outPath || targetOpenApiFile;
  saveOpenApi(outputPath, api);

  console.log(`OpenAPI source: ${targetOpenApiFile}`);
  console.log(`Flows sidecar: ${flowsPath}`);
  console.log(`Applied x-openapi-flow entries: ${appliedCount}`);
  console.log(`Output written to: ${outputPath}`);
  return 0;
}

function runDoctor(parsed) {
  const config = loadConfig(parsed.configPath);
  let hasErrors = false;

  console.log("x-openapi-flow doctor");
  console.log(`- Node.js: ${process.version}`);

  if (config.exists) {
    if (config.error) {
      console.error(`- Config: FAIL (${config.path})`);
      console.error(`  ${config.error}`);
      hasErrors = true;
    } else {
      console.log(`- Config: OK (${config.path})`);
    }
  } else {
    console.log(`- Config: not found (${config.path})`);
  }

  const defaultApi = path.resolve(process.cwd(), "examples", "payment-api.yaml");
  if (fs.existsSync(defaultApi)) {
    console.log(`- Example API: found (${defaultApi})`);
  } else {
    console.log("- Example API: not found in current directory (this is optional)");
  }

  try {
    if (fs.existsSync(defaultApi)) {
      const api = loadApi(defaultApi);
      extractFlows(api);
      console.log("- Validator engine: OK");
    } else {
      console.log("- Validator engine: OK");
    }
  } catch (_err) {
    console.error("- Validator engine: FAIL");
    hasErrors = true;
  }

  return hasErrors ? 1 : 0;
}

function buildMermaidGraph(filePath) {
  const api = loadApi(filePath);
  const flows = extractFlows(api);
  const lines = ["stateDiagram-v2"];
  const nodes = new Set();
  const edges = [];
  const edgeSeen = new Set();

  for (const { flow } of flows) {
    nodes.add(flow.current_state);

    const transitions = flow.transitions || [];
    for (const transition of transitions) {
      const from = flow.current_state;
      const to = transition.target_state;
      if (!to) {
        continue;
      }

      nodes.add(to);

      const labelParts = [];
      if (transition.next_operation_id) {
        labelParts.push(`next:${transition.next_operation_id}`);
      }
      if (
        Array.isArray(transition.prerequisite_operation_ids) &&
        transition.prerequisite_operation_ids.length > 0
      ) {
        labelParts.push(`requires:${transition.prerequisite_operation_ids.join(",")}`);
      }

      const label = labelParts.join(" | ");
      const edgeKey = `${from}::${to}::${label}`;
      if (edgeSeen.has(edgeKey)) {
        continue;
      }

      edgeSeen.add(edgeKey);
      edges.push({
        from,
        to,
        next_operation_id: transition.next_operation_id,
        prerequisite_operation_ids: transition.prerequisite_operation_ids || [],
      });

      lines.push(`  ${from} --> ${to}${label ? `: ${label}` : ""}`);
    }
  }

  for (const state of nodes) {
    lines.splice(1, 0, `  state ${state}`);
  }

  return {
    flowCount: flows.length,
    nodes: [...nodes],
    edges,
    mermaid: lines.join("\n"),
  };
}

function runGraph(parsed) {
  try {
    const graphResult = buildMermaidGraph(parsed.filePath);
    if (parsed.format === "json") {
      console.log(JSON.stringify(graphResult, null, 2));
    } else {
      console.log(graphResult.mermaid);
    }
    return 0;
  } catch (err) {
    console.error(`ERROR: Could not build graph — ${err.message}`);
    return 1;
  }
}

function main() {
  const parsed = parseArgs(process.argv);

  if (parsed.help) {
    printHelp();
    process.exit(0);
  }

  if (parsed.error) {
    console.error(`ERROR: ${parsed.error}`);
    console.log("");
    printHelp();
    process.exit(1);
  }

  if (parsed.command === "init") {
    process.exit(runInit(parsed));
  }

  if (parsed.command === "doctor") {
    process.exit(runDoctor(parsed));
  }

  if (parsed.command === "graph") {
    process.exit(runGraph(parsed));
  }

  if (parsed.command === "apply") {
    process.exit(runApply(parsed));
  }

  const config = loadConfig(parsed.configPath);
  if (config.error) {
    console.error(`ERROR: ${config.error}`);
    process.exit(1);
  }

  const options = {
    output: parsed.format || config.data.format || "pretty",
    strictQuality:
      parsed.strictQuality ||
      config.data.strictQuality === true,
    profile: parsed.profile || config.data.profile || "strict",
  };

  const result = run(parsed.filePath, options);
  process.exit(result.ok ? 0 : 1);
}

main();
