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
  x-openapi-flow apply [openapi-file] [--flows path] [--out path] [--in-place]
  x-openapi-flow graph <openapi-file> [--format mermaid|json]
  x-openapi-flow doctor [--config path]
  x-openapi-flow --help

Examples:
  x-openapi-flow validate examples/order-api.yaml
  x-openapi-flow validate examples/order-api.yaml --profile relaxed
  x-openapi-flow validate examples/order-api.yaml --strict-quality
  x-openapi-flow init openapi.yaml --flows openapi-openapi-flow.yaml
  x-openapi-flow init
  x-openapi-flow apply openapi.yaml
  x-openapi-flow apply openapi.yaml --in-place
  x-openapi-flow apply openapi.yaml --out openapi.flow.yaml
  x-openapi-flow graph examples/order-api.yaml
  x-openapi-flow doctor
`);
}

function deriveFlowOutputPath(openApiFile) {
  const parsed = path.parse(openApiFile);
  const extension = parsed.ext || ".yaml";
  return path.join(parsed.dir, `${parsed.name}.flow${extension}`);
}

function readSingleLineFromStdin() {
  const chunks = [];
  const buffer = Buffer.alloc(256);

  while (true) {
    const bytesRead = fs.readSync(0, buffer, 0, buffer.length, null);
    if (bytesRead === 0) {
      break;
    }

    const chunk = buffer.toString("utf8", 0, bytesRead);
    chunks.push(chunk);
    if (chunk.includes("\n")) {
      break;
    }
  }

  const input = chunks.join("");
  const firstLine = input.split(/\r?\n/)[0] || "";
  return firstLine.trim();
}

function askForConfirmation(question) {
  process.stdout.write(`${question} [y/N]: `);
  const answer = readSingleLineFromStdin().toLowerCase();
  return answer === "y" || answer === "yes";
}

function getNextBackupPath(filePath) {
  let index = 1;
  while (true) {
    const candidate = `${filePath}.backup-${index}`;
    if (!fs.existsSync(candidate)) {
      return candidate;
    }
    index += 1;
  }
}

function applyFlowsAndWrite(openApiFile, flowsDoc, outputPath) {
  const api = loadApi(openApiFile);
  const appliedCount = applyFlowsToOpenApi(api, flowsDoc);
  saveOpenApi(outputPath, api);
  return appliedCount;
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
  const unknown = findUnknownOptions(args, ["--flows", "--out"], ["--in-place"]);
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

  const inPlace = args.includes("--in-place");
  if (inPlace && outOpt.found) {
    return { error: "Options --in-place and --out cannot be used together." };
  }

  const positional = args.filter((token, index) => {
    if (token === "--flows" || token === "--out" || token === "--in-place") {
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
    inPlace,
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
    const parsed = path.parse(openApiFile);
    const extension = parsed.ext.toLowerCase() === ".json" ? ".json" : ".yaml";
    const fileName = `${parsed.name}-openapi-flow${extension}`;
    return path.join(path.dirname(openApiFile), fileName);
  }

  return path.resolve(process.cwd(), DEFAULT_FLOWS_FILE);
}

function looksLikeFlowsSidecar(filePath) {
  if (!filePath) return false;
  const normalized = filePath.toLowerCase();
  return normalized.endsWith("-openapi-flow.yaml")
    || normalized.endsWith("-openapi-flow.yml")
    || normalized.endsWith("-openapi-flow.json")
    || normalized.endsWith("x-openapi-flow.flows.yaml")
    || normalized.endsWith("x-openapi-flow.flows.yml")
    || normalized.endsWith("x-openapi-flow.flows.json");
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

function buildFallbackOperationId(method, pathKey) {
  const raw = `${method}_${pathKey}`.toLowerCase();
  const sanitized = raw
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return sanitized || "operation";
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
      const resolvedOperationId = operationId || buildFallbackOperationId(method, pathKey);
      const key = operationId ? `operationId:${operationId}` : `${method.toUpperCase()} ${pathKey}`;

      entries.push({
        key,
        operationId,
        resolvedOperationId,
        method,
        path: pathKey,
        operation,
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
  const content = flowsPath.endsWith(".json")
    ? `${JSON.stringify(flowsDoc, null, 2)}\n`
    : yaml.dump(flowsDoc, { noRefs: true, lineWidth: -1 });
  fs.writeFileSync(flowsPath, content, "utf8");
}

function buildFlowTemplate(operationId) {
  const safeOperationId = operationId || "operation";
  return {
    version: "1.0",
    id: safeOperationId,
    current_state: safeOperationId,
    transitions: [],
  };
}

function buildOperationLookup(api) {
  const lookupByKey = new Map();
  const lookupByOperationId = new Map();
  const entries = extractOperationEntries(api);

  for (const entry of entries) {
    lookupByKey.set(entry.key, entry);
    if (entry.resolvedOperationId) {
      lookupByOperationId.set(entry.resolvedOperationId, entry);
    }
  }

  return { entries, lookupByKey, lookupByOperationId };
}

function mergeFlowsWithOpenApi(api, flowsDoc) {
  const { entries, lookupByKey } = buildOperationLookup(api);

  const existingByOperationId = new Map();
  const existingByKey = new Map();
  for (const entry of flowsDoc.operations) {
    if (entry && entry.operationId) {
      existingByOperationId.set(entry.operationId, entry);
    }

    const legacyKey = entry && entry.key ? entry.key : null;
    if (legacyKey) {
      existingByKey.set(legacyKey, entry);
    }
  }

  const mergedOperations = [];

  for (const op of entries) {
    const existing = (op.resolvedOperationId && existingByOperationId.get(op.resolvedOperationId))
      || existingByKey.get(op.key);

    const openApiFlow =
      op.operation && typeof op.operation["x-openapi-flow"] === "object"
        ? op.operation["x-openapi-flow"]
        : null;

    const sidecarFlow =
      existing && typeof existing["x-openapi-flow"] === "object"
        ? existing["x-openapi-flow"]
        : null;

    mergedOperations.push({
      operationId: op.resolvedOperationId,
      "x-openapi-flow": sidecarFlow || openApiFlow || buildFlowTemplate(op.resolvedOperationId),
    });
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
    if (!flowEntry) {
      continue;
    }

    const flowValue = flowEntry["x-openapi-flow"];
    if (!flowValue || typeof flowValue !== "object" || Object.keys(flowValue).length === 0) {
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
  const flowOutputPath = deriveFlowOutputPath(targetOpenApiFile);

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
  const trackedCount = mergedFlows.operations.length;

  let applyMessage = "Init completed without regenerating flow output.";
  if (!fs.existsSync(flowOutputPath)) {
    const appliedCount = applyFlowsAndWrite(targetOpenApiFile, mergedFlows, flowOutputPath);
    applyMessage = `Flow output generated: ${flowOutputPath} (applied entries: ${appliedCount}).`;
  } else {
    const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
    if (isInteractive) {
      const shouldRecreate = askForConfirmation(
        `Flow output already exists at ${flowOutputPath}. Recreate it from current OpenAPI + sidecar?`
      );

      if (shouldRecreate) {
        const backupPath = getNextBackupPath(flowOutputPath);
        fs.renameSync(flowOutputPath, backupPath);
        const appliedCount = applyFlowsAndWrite(targetOpenApiFile, mergedFlows, flowOutputPath);
        applyMessage = `Flow output recreated: ${flowOutputPath} (applied entries: ${appliedCount}). Backup: ${backupPath}.`;
      } else {
        applyMessage = "Flow output kept as-is (recreate cancelled by user).";
      }
    } else {
      console.error(`ERROR: Flow output already exists at ${flowOutputPath}.`);
      console.error("Use `x-openapi-flow apply` to update the existing flow output in non-interactive mode.");
      return 1;
    }
  }

  console.log(`Using existing OpenAPI file: ${targetOpenApiFile}`);
  console.log(`Flows sidecar synced: ${flowsPath}`);
  console.log(`Tracked operations: ${trackedCount}`);
  console.log(applyMessage);
  console.log("OpenAPI source unchanged. Edit the sidecar and run apply to generate the full spec.");

  console.log(`Validate now: x-openapi-flow validate ${targetOpenApiFile}`);
  return 0;
}

function runApply(parsed) {
  let targetOpenApiFile = parsed.openApiFile || findOpenApiFile(process.cwd());
  let flowsPathFromPositional = null;

  if (!parsed.flowsPath && parsed.openApiFile && looksLikeFlowsSidecar(parsed.openApiFile)) {
    flowsPathFromPositional = parsed.openApiFile;
    targetOpenApiFile = findOpenApiFile(process.cwd());
  }

  if (!targetOpenApiFile) {
    console.error("ERROR: Could not find an existing OpenAPI file in this repository.");
    console.error("Expected one of: openapi.yaml|yml|json, swagger.yaml|yml|json");
    if (flowsPathFromPositional) {
      console.error(`Detected sidecar argument: ${flowsPathFromPositional}`);
      console.error("Provide an OpenAPI file explicitly or run the command from the OpenAPI project root.");
    }
    return 1;
  }

  const flowsPath = resolveFlowsPath(targetOpenApiFile, parsed.flowsPath || flowsPathFromPositional);
  if (!fs.existsSync(flowsPath)) {
    console.error(`ERROR: Flows sidecar not found: ${flowsPath}`);
    console.error("Run `x-openapi-flow init` first to create and sync the sidecar, or use --flows <sidecar-file>.");
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
  const outputPath = parsed.inPlace
    ? targetOpenApiFile
    : (parsed.outPath || deriveFlowOutputPath(targetOpenApiFile));
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
  const flows = extractFlowsForGraph(filePath);
  if (flows.length === 0) {
    throw new Error("No x-openapi-flow definitions found in OpenAPI or sidecar file");
  }

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

function extractFlowsForGraph(filePath) {
  let flows = [];

  try {
    const api = loadApi(filePath);
    flows = extractFlows(api);
  } catch (_err) {
    flows = [];
  }

  if (flows.length > 0) {
    return flows;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const parsed = yaml.load(content);

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.operations)) {
    return [];
  }

  const sidecarFlows = [];
  for (const operationEntry of parsed.operations) {
    if (!operationEntry || typeof operationEntry !== "object") {
      continue;
    }

    const flow = operationEntry["x-openapi-flow"];
    if (!flow || typeof flow !== "object") {
      continue;
    }

    if (!flow.current_state) {
      continue;
    }

    sidecarFlows.push({
      endpoint: operationEntry.operationId || operationEntry.key || "sidecar-operation",
      flow,
    });
  }

  return sidecarFlows;
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
