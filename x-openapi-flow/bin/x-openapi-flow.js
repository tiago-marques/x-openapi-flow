#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const {
  run,
  loadApi,
  extractFlows,
  buildStateGraph,
  detectDuplicateTransitions,
  detectInvalidOperationReferences,
  detectTerminalCoverage,
} = require("../lib/validator");
const { generateSdk } = require("../lib/sdk-generator");
const {
  exportDocFlows,
  generatePostmanCollection,
  generateInsomniaWorkspace,
  generateRedocPackage,
} = require("../adapters/flow-output-adapters");
const pkg = require("../package.json");

const DEFAULT_CONFIG_NAME = "x-openapi-flow.config.json";
const DEFAULT_FLOWS_FILE = "x-openapi-flow.flows.yaml";
const KNOWN_COMMANDS = [
  "validate",
  "init",
  "apply",
  "diff",
  "lint",
  "analyze",
  "generate-sdk",
  "export-doc-flows",
  "generate-postman",
  "generate-insomnia",
  "generate-redoc",
  "graph",
  "doctor",
  "completion",
];

const COMMAND_SNIPPETS = {
  validate: {
    usage: "x-openapi-flow validate <openapi-file> [--format pretty|json] [--profile core|relaxed|strict] [--strict-quality] [--config path]",
    examples: [
      "x-openapi-flow validate examples/order-api.yaml",
      "x-openapi-flow validate examples/order-api.yaml --profile relaxed",
      "x-openapi-flow validate examples/order-api.yaml --strict-quality",
    ],
  },
  init: {
    usage: "x-openapi-flow init [openapi-file] [--flows path] [--force] [--dry-run]",
    examples: [
      "x-openapi-flow init",
      "x-openapi-flow init openapi.yaml --flows openapi.x.yaml",
      "x-openapi-flow init openapi.yaml --force",
      "x-openapi-flow init openapi.yaml --dry-run",
    ],
  },
  apply: {
    usage: "x-openapi-flow apply [openapi-file] [--flows path] [--out path] [--in-place]",
    examples: [
      "x-openapi-flow apply openapi.yaml",
      "x-openapi-flow apply openapi.yaml --in-place",
      "x-openapi-flow apply openapi.yaml --out openapi.flow.yaml",
    ],
  },
  diff: {
    usage: "x-openapi-flow diff [openapi-file] [--flows path] [--format pretty|json]",
    examples: [
      "x-openapi-flow diff openapi.yaml",
      "x-openapi-flow diff openapi.yaml --format json",
    ],
  },
  lint: {
    usage: "x-openapi-flow lint [openapi-file] [--format pretty|json] [--config path]",
    examples: [
      "x-openapi-flow lint openapi.yaml",
      "x-openapi-flow lint openapi.yaml --format json",
    ],
  },
  analyze: {
    usage: "x-openapi-flow analyze [openapi-file] [--format pretty|json] [--out path] [--merge] [--flows path]",
    examples: [
      "x-openapi-flow analyze openapi.yaml",
      "x-openapi-flow analyze openapi.yaml --out openapi.x.yaml",
      "x-openapi-flow analyze openapi.yaml --merge --flows openapi.x.yaml",
    ],
  },
  "generate-sdk": {
    usage: "x-openapi-flow generate-sdk [openapi-file] --lang typescript [--output path]",
    examples: [
      "x-openapi-flow generate-sdk openapi.yaml --lang typescript --output ./sdk",
    ],
  },
  "export-doc-flows": {
    usage: "x-openapi-flow export-doc-flows [openapi-file] [--output path] [--format markdown|json]",
    examples: [
      "x-openapi-flow export-doc-flows openapi.yaml --output ./docs/api-flows.md",
    ],
  },
  "generate-postman": {
    usage: "x-openapi-flow generate-postman [openapi-file] [--output path] [--with-scripts]",
    examples: [
      "x-openapi-flow generate-postman openapi.yaml --output ./x-openapi-flow.postman_collection.json --with-scripts",
    ],
  },
  "generate-insomnia": {
    usage: "x-openapi-flow generate-insomnia [openapi-file] [--output path]",
    examples: [
      "x-openapi-flow generate-insomnia openapi.yaml --output ./x-openapi-flow.insomnia.json",
    ],
  },
  "generate-redoc": {
    usage: "x-openapi-flow generate-redoc [openapi-file] [--output path]",
    examples: [
      "x-openapi-flow generate-redoc openapi.yaml --output ./redoc-flow",
    ],
  },
  graph: {
    usage: "x-openapi-flow graph <openapi-file> [--format mermaid|json]",
    examples: [
      "x-openapi-flow graph examples/order-api.yaml",
    ],
  },
  doctor: {
    usage: "x-openapi-flow doctor [--config path]",
    examples: [
      "x-openapi-flow doctor",
    ],
  },
  completion: {
    usage: "x-openapi-flow completion [bash|zsh]",
    examples: [
      "x-openapi-flow completion bash > ~/.x-openapi-flow-completion.bash",
      "x-openapi-flow completion zsh > ~/.x-openapi-flow-completion.zsh",
    ],
  },
};

function stripGlobalFlags(args) {
  const cleaned = [];
  let verbose = false;

  for (const token of args) {
    if (token === "--verbose") {
      verbose = true;
      continue;
    }
    cleaned.push(token);
  }

  return { args: cleaned, verbose };
}

function printVerbose(parsed) {
  if (!parsed || !parsed.verbose) {
    return;
  }

  const printable = { ...parsed };
  console.error("[verbose] Parsed CLI arguments:");
  console.error(JSON.stringify(printable, null, 2));
}

function buildCompletionScript(shell) {
  const commands = [...KNOWN_COMMANDS, "help", "version"].join(" ");

  if (shell === "zsh") {
    return `#compdef x-openapi-flow
_x_openapi_flow() {
  local -a commands
  commands=(${commands})
  local -a global_opts
  global_opts=(--help --version --verbose)

  if (( CURRENT == 2 )); then
    _describe 'command' commands
    return
  fi

  case "$words[2]" in
    validate)
      _values 'options' --format --profile --strict-quality --config --help
      ;;
    init)
      _values 'options' --flows --force --dry-run --help
      ;;
    apply)
      _values 'options' --flows --out --in-place --help
      ;;
    diff)
      _values 'options' --flows --format --help
      ;;
    lint)
      _values 'options' --format --config --help
      ;;
    analyze)
      _values 'options' --format --out --merge --flows --help
      ;;
    generate-sdk)
      _values 'options' --lang --output --help
      ;;
    export-doc-flows)
      _values 'options' --output --format --help
      ;;
    generate-postman)
      _values 'options' --output --with-scripts --help
      ;;
    generate-insomnia)
      _values 'options' --output --help
      ;;
    generate-redoc)
      _values 'options' --output --help
      ;;
    graph)
      _values 'options' --format --help
      ;;
    doctor)
      _values 'options' --config --help
      ;;
    completion)
      _values 'shell' bash zsh
      ;;
    *)
      _values 'global options' $global_opts
      ;;
  esac
}
compdef _x_openapi_flow x-openapi-flow
`;
  }

  return `_x_openapi_flow()
{
  local cur prev opts
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  opts="${commands}"

  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${commands} --help --version --verbose" -- "\$cur") )
    return 0
  fi

  case "\${COMP_WORDS[1]}" in
    validate)
      COMPREPLY=( $(compgen -W "--format --profile --strict-quality --config --help --verbose" -- "\$cur") )
      ;;
    init)
      COMPREPLY=( $(compgen -W "--flows --force --dry-run --help --verbose" -- "\$cur") )
      ;;
    apply)
      COMPREPLY=( $(compgen -W "--flows --out --in-place --help --verbose" -- "\$cur") )
      ;;
    diff)
      COMPREPLY=( $(compgen -W "--flows --format --help --verbose" -- "\$cur") )
      ;;
    lint)
      COMPREPLY=( $(compgen -W "--format --config --help --verbose" -- "\$cur") )
      ;;
    analyze)
      COMPREPLY=( $(compgen -W "--format --out --merge --flows --help --verbose" -- "\$cur") )
      ;;
    generate-sdk)
      COMPREPLY=( $(compgen -W "--lang --output --help --verbose" -- "\$cur") )
      ;;
    export-doc-flows)
      COMPREPLY=( $(compgen -W "--output --format --help --verbose" -- "\$cur") )
      ;;
    generate-postman)
      COMPREPLY=( $(compgen -W "--output --with-scripts --help --verbose" -- "\$cur") )
      ;;
    generate-insomnia)
      COMPREPLY=( $(compgen -W "--output --help --verbose" -- "\$cur") )
      ;;
    generate-redoc)
      COMPREPLY=( $(compgen -W "--output --help --verbose" -- "\$cur") )
      ;;
    graph)
      COMPREPLY=( $(compgen -W "--format --help --verbose" -- "\$cur") )
      ;;
    doctor)
      COMPREPLY=( $(compgen -W "--config --help --verbose" -- "\$cur") )
      ;;
    completion)
      COMPREPLY=( $(compgen -W "bash zsh --help --verbose" -- "\$cur") )
      ;;
    *)
      COMPREPLY=( $(compgen -W "--help --version --verbose" -- "\$cur") )
      ;;
  esac
}
complete -F _x_openapi_flow x-openapi-flow
`;
}

function parseCompletionArgs(args) {
  const positional = args.filter((token) => !token.startsWith("--"));
  if (positional.length > 1) {
    return { error: `Unexpected argument: ${positional[1]}` };
  }

  const shell = positional[0] || "bash";
  if (![
    "bash",
    "zsh",
  ].includes(shell)) {
    return { error: `Invalid shell '${shell}'. Use 'bash' or 'zsh'.` };
  }

  return { shell };
}

function suggestCommand(input) {
  if (!input) return null;
  const normalized = input.toLowerCase();
  const prefix = KNOWN_COMMANDS.find((cmd) => cmd.startsWith(normalized));
  if (prefix) {
    return prefix;
  }

  const includes = KNOWN_COMMANDS.find((cmd) => cmd.includes(normalized));
  if (includes) {
    return includes;
  }

  function levenshtein(a, b) {
    const rows = a.length + 1;
    const cols = b.length + 1;
    const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

    for (let i = 0; i < rows; i += 1) {
      matrix[i][0] = i;
    }
    for (let j = 0; j < cols; j += 1) {
      matrix[0][j] = j;
    }

    for (let i = 1; i < rows; i += 1) {
      for (let j = 1; j < cols; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[a.length][b.length];
  }

  let best = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of KNOWN_COMMANDS) {
    const score = levenshtein(normalized, candidate);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return bestScore <= 3 ? best : null;
}

function buildUnknownCommandError(command) {
  const suggestion = suggestCommand(command);
  if (!suggestion) {
    return `Unknown command: ${command}`;
  }

  return `Unknown command: ${command}. Did you mean '${suggestion}'?`;
}

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

function printHelp(command) {
  if (command && COMMAND_SNIPPETS[command]) {
    const snippet = COMMAND_SNIPPETS[command];
    const examples = snippet.examples.map((item) => `  ${item}`).join("\n");
    console.log(`x-openapi-flow CLI\n\nCommand: ${command}\n\nUsage:\n  ${snippet.usage}\n\nExamples:\n${examples}\n`);
    return;
  }

  console.log(`x-openapi-flow CLI

Global options:
  --help, -h       Show help
  --version, -v    Show CLI version
  --verbose        Print parsed arguments for troubleshooting

Usage:
  x-openapi-flow <command> [options]
  x-openapi-flow validate <openapi-file> [--format pretty|json] [--profile core|relaxed|strict] [--strict-quality] [--config path]
  x-openapi-flow init [openapi-file] [--flows path] [--force] [--dry-run]
  x-openapi-flow apply [openapi-file] [--flows path] [--out path] [--in-place]
  x-openapi-flow diff [openapi-file] [--flows path] [--format pretty|json]
  x-openapi-flow lint [openapi-file] [--format pretty|json] [--config path]
  x-openapi-flow analyze [openapi-file] [--format pretty|json] [--out path] [--merge] [--flows path]
  x-openapi-flow generate-sdk [openapi-file] --lang typescript [--output path]
  x-openapi-flow export-doc-flows [openapi-file] [--output path] [--format markdown|json]
  x-openapi-flow generate-postman [openapi-file] [--output path] [--with-scripts]
  x-openapi-flow generate-insomnia [openapi-file] [--output path]
  x-openapi-flow generate-redoc [openapi-file] [--output path]
  x-openapi-flow graph <openapi-file> [--format mermaid|json]
  x-openapi-flow doctor [--config path]
  x-openapi-flow completion [bash|zsh]
  x-openapi-flow help [command]
  x-openapi-flow version
  x-openapi-flow --help
  x-openapi-flow --version

Examples:
  x-openapi-flow validate examples/order-api.yaml
  x-openapi-flow validate examples/order-api.yaml --profile relaxed
  x-openapi-flow validate examples/order-api.yaml --strict-quality
  x-openapi-flow init openapi.yaml --flows openapi.x.yaml
  x-openapi-flow init openapi.yaml --force
  x-openapi-flow init openapi.yaml --dry-run
  x-openapi-flow init
  x-openapi-flow apply openapi.yaml
  x-openapi-flow apply openapi.yaml --in-place
  x-openapi-flow apply openapi.yaml --out openapi.flow.yaml
  x-openapi-flow diff openapi.yaml
  x-openapi-flow diff openapi.yaml --format json
  x-openapi-flow lint openapi.yaml
  x-openapi-flow lint openapi.yaml --format json
  x-openapi-flow analyze openapi.yaml
  x-openapi-flow analyze openapi.yaml --out openapi.x.yaml
  x-openapi-flow analyze openapi.yaml --format json
  x-openapi-flow analyze openapi.yaml --merge --flows openapi.x.yaml
  x-openapi-flow generate-sdk openapi.yaml --lang typescript --output ./sdk
  x-openapi-flow export-doc-flows openapi.yaml --output ./docs/api-flows.md
  x-openapi-flow generate-postman openapi.yaml --output ./x-openapi-flow.postman_collection.json --with-scripts
  x-openapi-flow generate-insomnia openapi.yaml --output ./x-openapi-flow.insomnia.json
  x-openapi-flow generate-redoc openapi.yaml --output ./redoc-flow
  x-openapi-flow graph examples/order-api.yaml
  x-openapi-flow doctor

Quick Start:
  # 1) Initialize sidecar from your OpenAPI file
  x-openapi-flow init

  # 2) Apply sidecar into flow output
  x-openapi-flow apply

  # 3) Validate with strict profile
  x-openapi-flow validate --profile strict

Autocomplete:
  # Bash
  x-openapi-flow completion bash > ~/.x-openapi-flow-completion.bash
  echo 'source ~/.x-openapi-flow-completion.bash' >> ~/.bashrc

  # Zsh
  x-openapi-flow completion zsh > ~/.x-openapi-flow-completion.zsh
  echo 'source ~/.x-openapi-flow-completion.zsh' >> ~/.zshrc
`);
}

function deriveFlowOutputPath(openApiFile) {
  const parsed = path.parse(openApiFile);
  const extension = parsed.ext || ".yaml";
  return path.join(parsed.dir, `${parsed.name}.flow${extension}`);
}

function readSingleLineFromStdin() {
  const sleepBuffer = new SharedArrayBuffer(4);
  const sleepView = new Int32Array(sleepBuffer);
  const chunks = [];
  const buffer = Buffer.alloc(256);
  const maxEagainRetries = 200;
  let eagainRetries = 0;

  while (true) {
    let bytesRead;
    try {
      bytesRead = fs.readSync(0, buffer, 0, buffer.length, null);
    } catch (err) {
      if (err && (err.code === "EAGAIN" || err.code === "EWOULDBLOCK")) {
        eagainRetries += 1;
        if (eagainRetries >= maxEagainRetries) {
          const retryError = new Error("Could not read interactive input from stdin.");
          retryError.code = "EAGAIN";
          throw retryError;
        }
        Atomics.wait(sleepView, 0, 0, 25);
        continue;
      }
      throw err;
    }

    eagainRetries = 0;
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
  const unknown = findUnknownOptions(args, ["--flows"], ["--force", "--dry-run"]);
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
    if (token === "--force") {
      return false;
    }
    if (token === "--dry-run") {
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
    force: args.includes("--force"),
    dryRun: args.includes("--dry-run"),
  };
}

function summarizeSidecarDiff(existingFlowsDoc, mergedFlowsDoc) {
  const existingOps = new Map();
  for (const entry of (existingFlowsDoc && existingFlowsDoc.operations) || []) {
    if (!entry || !entry.operationId) continue;
    existingOps.set(entry.operationId, entry["x-openapi-flow"] || null);
  }

  const mergedOps = new Map();
  for (const entry of (mergedFlowsDoc && mergedFlowsDoc.operations) || []) {
    if (!entry || !entry.operationId) continue;
    mergedOps.set(entry.operationId, entry["x-openapi-flow"] || null);
  }

  let added = 0;
  let removed = 0;
  let changed = 0;
  const addedOperationIds = [];
  const removedOperationIds = [];
  const changedOperationIds = [];
  const changedOperationDetails = [];

  function collectLeafPaths(value, prefix = "") {
    if (value === null || value === undefined) {
      return [prefix || "(root)"];
    }

    if (Array.isArray(value)) {
      return [prefix || "(root)"];
    }

    if (typeof value !== "object") {
      return [prefix || "(root)"];
    }

    const keys = Object.keys(value);
    if (keys.length === 0) {
      return [prefix || "(root)"];
    }

    return keys.flatMap((key) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      return collectLeafPaths(value[key], nextPrefix);
    });
  }

  function diffPaths(left, right, prefix = "") {
    if (JSON.stringify(left) === JSON.stringify(right)) {
      return [];
    }

    const leftIsObject = left && typeof left === "object" && !Array.isArray(left);
    const rightIsObject = right && typeof right === "object" && !Array.isArray(right);

    if (leftIsObject && rightIsObject) {
      const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();
      return keys.flatMap((key) => {
        const nextPrefix = prefix ? `${prefix}.${key}` : key;
        return diffPaths(left[key], right[key], nextPrefix);
      });
    }

    if (rightIsObject && !leftIsObject) {
      return collectLeafPaths(right, prefix);
    }

    if (leftIsObject && !rightIsObject) {
      return collectLeafPaths(left, prefix);
    }

    return [prefix || "(root)"];
  }

  for (const [operationId, mergedFlow] of mergedOps.entries()) {
    if (!existingOps.has(operationId)) {
      added += 1;
      addedOperationIds.push(operationId);
      continue;
    }

    const existingFlow = existingOps.get(operationId);
    if (JSON.stringify(existingFlow) !== JSON.stringify(mergedFlow)) {
      changed += 1;
      changedOperationIds.push(operationId);
      changedOperationDetails.push({
        operationId,
        changedPaths: Array.from(new Set(diffPaths(existingFlow, mergedFlow))).sort(),
      });
    }
  }

  for (const operationId of existingOps.keys()) {
    if (!mergedOps.has(operationId)) {
      removed += 1;
      removedOperationIds.push(operationId);
    }
  }

  return {
    added,
    removed,
    changed,
    addedOperationIds: addedOperationIds.sort(),
    removedOperationIds: removedOperationIds.sort(),
    changedOperationIds: changedOperationIds.sort(),
    changedOperationDetails: changedOperationDetails.sort((a, b) => a.operationId.localeCompare(b.operationId)),
  };
}

function parseDiffArgs(args) {
  const unknown = findUnknownOptions(args, ["--flows", "--format"], []);
  if (unknown) {
    return { error: `Unknown option: ${unknown}` };
  }

  const flowsOpt = getOptionValue(args, "--flows");
  if (flowsOpt.error) {
    return { error: flowsOpt.error };
  }

  const formatOpt = getOptionValue(args, "--format");
  if (formatOpt.error) {
    return { error: `${formatOpt.error} Use 'pretty' or 'json'.` };
  }

  const format = formatOpt.found ? formatOpt.value : "pretty";
  if (!["pretty", "json"].includes(format)) {
    return { error: `Invalid --format '${format}'. Use 'pretty' or 'json'.` };
  }

  const positional = args.filter((token, index) => {
    if (token === "--flows" || token === "--format") {
      return false;
    }
    if (index > 0 && (args[index - 1] === "--flows" || args[index - 1] === "--format")) {
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
    format,
  };
}

function parseLintArgs(args) {
  const unknown = findUnknownOptions(args, ["--format", "--config"], []);
  if (unknown) {
    return { error: `Unknown option: ${unknown}` };
  }

  const formatOpt = getOptionValue(args, "--format");
  if (formatOpt.error) {
    return { error: `${formatOpt.error} Use 'pretty' or 'json'.` };
  }

  const configOpt = getOptionValue(args, "--config");
  if (configOpt.error) {
    return { error: configOpt.error };
  }

  const format = formatOpt.found ? formatOpt.value : "pretty";
  if (![
    "pretty",
    "json",
  ].includes(format)) {
    return { error: `Invalid --format '${format}'. Use 'pretty' or 'json'.` };
  }

  const positional = args.filter((token, index) => {
    if (token === "--format" || token === "--config") {
      return false;
    }
    if (index > 0 && (args[index - 1] === "--format" || args[index - 1] === "--config")) {
      return false;
    }
    return !token.startsWith("--");
  });

  if (positional.length > 1) {
    return { error: `Unexpected argument: ${positional[1]}` };
  }

  return {
    openApiFile: positional[0] ? path.resolve(positional[0]) : undefined,
    format,
    configPath: configOpt.found ? configOpt.value : undefined,
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

function parseAnalyzeArgs(args) {
  const unknown = findUnknownOptions(args, ["--format", "--out", "--flows"], ["--merge"]);
  if (unknown) {
    return { error: `Unknown option: ${unknown}` };
  }

  const formatOpt = getOptionValue(args, "--format");
  if (formatOpt.error) {
    return { error: `${formatOpt.error} Use 'pretty' or 'json'.` };
  }

  const outOpt = getOptionValue(args, "--out");
  if (outOpt.error) {
    return { error: outOpt.error };
  }

  const flowsOpt = getOptionValue(args, "--flows");
  if (flowsOpt.error) {
    return { error: flowsOpt.error };
  }

  const format = formatOpt.found ? formatOpt.value : "pretty";
  if (!["pretty", "json"].includes(format)) {
    return { error: `Invalid --format '${format}'. Use 'pretty' or 'json'.` };
  }

  const positional = args.filter((token, index) => {
    if (token === "--format" || token === "--out" || token === "--flows" || token === "--merge") {
      return false;
    }
    if (
      index > 0
      && (args[index - 1] === "--format" || args[index - 1] === "--out" || args[index - 1] === "--flows")
    ) {
      return false;
    }
    return !token.startsWith("--");
  });

  if (positional.length > 1) {
    return { error: `Unexpected argument: ${positional[1]}` };
  }

  return {
    openApiFile: positional[0] ? path.resolve(positional[0]) : undefined,
    format,
    outPath: outOpt.found ? path.resolve(outOpt.value) : undefined,
    merge: args.includes("--merge"),
    flowsPath: flowsOpt.found ? path.resolve(flowsOpt.value) : undefined,
  };
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

function parseGenerateSdkArgs(args) {
  const unknown = findUnknownOptions(args, ["--lang", "--output"], []);
  if (unknown) {
    return { error: `Unknown option: ${unknown}` };
  }

  const langOpt = getOptionValue(args, "--lang");
  if (langOpt.error) {
    return { error: `${langOpt.error} Use 'typescript'.` };
  }

  const outputOpt = getOptionValue(args, "--output");
  if (outputOpt.error) {
    return { error: outputOpt.error };
  }

  if (!langOpt.found) {
    return { error: "Missing --lang option. Usage: x-openapi-flow generate-sdk [openapi-file] --lang typescript [--output path]" };
  }

  const language = langOpt.value;
  if (language !== "typescript") {
    return { error: `Unsupported --lang '${language}'. MVP currently supports only 'typescript'.` };
  }

  const positional = args.filter((token, index) => {
    if (token === "--lang" || token === "--output") {
      return false;
    }
    if (index > 0 && (args[index - 1] === "--lang" || args[index - 1] === "--output")) {
      return false;
    }
    return !token.startsWith("--");
  });

  if (positional.length > 1) {
    return { error: `Unexpected argument: ${positional[1]}` };
  }

  return {
    openApiFile: positional[0] ? path.resolve(positional[0]) : undefined,
    language,
    outputPath: outputOpt.found ? path.resolve(outputOpt.value) : path.resolve(process.cwd(), "sdk"),
  };
}

function parseExportDocFlowsArgs(args) {
  const unknown = findUnknownOptions(args, ["--output", "--format"], []);
  if (unknown) {
    return { error: `Unknown option: ${unknown}` };
  }

  const outputOpt = getOptionValue(args, "--output");
  if (outputOpt.error) {
    return { error: outputOpt.error };
  }

  const formatOpt = getOptionValue(args, "--format");
  if (formatOpt.error) {
    return { error: `${formatOpt.error} Use 'markdown' or 'json'.` };
  }

  const format = formatOpt.found ? formatOpt.value : "markdown";
  if (!["markdown", "json"].includes(format)) {
    return { error: `Invalid --format '${format}'. Use 'markdown' or 'json'.` };
  }

  const positional = args.filter((token, index) => {
    if (token === "--output" || token === "--format") return false;
    if (index > 0 && (args[index - 1] === "--output" || args[index - 1] === "--format")) return false;
    return !token.startsWith("--");
  });

  if (positional.length > 1) {
    return { error: `Unexpected argument: ${positional[1]}` };
  }

  return {
    openApiFile: positional[0] ? path.resolve(positional[0]) : undefined,
    outputPath: outputOpt.found ? path.resolve(outputOpt.value) : path.resolve(process.cwd(), "api-flows.md"),
    format,
  };
}

function parseGeneratePostmanArgs(args) {
  const unknown = findUnknownOptions(args, ["--output"], ["--with-scripts"]);
  if (unknown) {
    return { error: `Unknown option: ${unknown}` };
  }

  const outputOpt = getOptionValue(args, "--output");
  if (outputOpt.error) {
    return { error: outputOpt.error };
  }

  const positional = args.filter((token, index) => {
    if (token === "--output" || token === "--with-scripts") return false;
    if (index > 0 && args[index - 1] === "--output") return false;
    return !token.startsWith("--");
  });

  if (positional.length > 1) {
    return { error: `Unexpected argument: ${positional[1]}` };
  }

  return {
    openApiFile: positional[0] ? path.resolve(positional[0]) : undefined,
    outputPath: outputOpt.found
      ? path.resolve(outputOpt.value)
      : path.resolve(process.cwd(), "x-openapi-flow.postman_collection.json"),
    withScripts: args.includes("--with-scripts"),
  };
}

function parseGenerateInsomniaArgs(args) {
  const unknown = findUnknownOptions(args, ["--output"], []);
  if (unknown) {
    return { error: `Unknown option: ${unknown}` };
  }

  const outputOpt = getOptionValue(args, "--output");
  if (outputOpt.error) {
    return { error: outputOpt.error };
  }

  const positional = args.filter((token, index) => {
    if (token === "--output") return false;
    if (index > 0 && args[index - 1] === "--output") return false;
    return !token.startsWith("--");
  });

  if (positional.length > 1) {
    return { error: `Unexpected argument: ${positional[1]}` };
  }

  return {
    openApiFile: positional[0] ? path.resolve(positional[0]) : undefined,
    outputPath: outputOpt.found
      ? path.resolve(outputOpt.value)
      : path.resolve(process.cwd(), "x-openapi-flow.insomnia.json"),
  };
}

function parseGenerateRedocArgs(args) {
  const unknown = findUnknownOptions(args, ["--output"], []);
  if (unknown) {
    return { error: `Unknown option: ${unknown}` };
  }

  const outputOpt = getOptionValue(args, "--output");
  if (outputOpt.error) {
    return { error: outputOpt.error };
  }

  const positional = args.filter((token, index) => {
    if (token === "--output") return false;
    if (index > 0 && args[index - 1] === "--output") return false;
    return !token.startsWith("--");
  });

  if (positional.length > 1) {
    return { error: `Unexpected argument: ${positional[1]}` };
  }

  return {
    openApiFile: positional[0] ? path.resolve(positional[0]) : undefined,
    outputPath: outputOpt.found ? path.resolve(outputOpt.value) : path.resolve(process.cwd(), "redoc-flow"),
  };
}

function parseArgs(argv) {
  const stripped = stripGlobalFlags(argv.slice(2));
  const args = stripped.args;
  const command = args[0];
  const withVerbose = (payload) => ({ ...payload, verbose: stripped.verbose });

  if (!command || command === "--help" || command === "-h") {
    return withVerbose({ help: true });
  }

  if (command === "--version" || command === "-v" || command === "version") {
    return withVerbose({ version: true });
  }

  if (command === "help") {
    const helpTarget = args[1];
    if (!helpTarget) {
      return withVerbose({ help: true });
    }

    if (!KNOWN_COMMANDS.includes(helpTarget)) {
      return withVerbose({ error: buildUnknownCommandError(helpTarget) });
    }

    return withVerbose({ help: true, command: helpTarget });
  }

  const commandArgs = args.slice(1);
  if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
    return withVerbose({ help: true, command });
  }

  if (command === "validate") {
    const parsed = parseValidateArgs(commandArgs);
    return withVerbose(parsed.error ? parsed : { command, ...parsed });
  }

  if (command === "init") {
    const parsed = parseInitArgs(commandArgs);
    return withVerbose(parsed.error ? parsed : { command, ...parsed });
  }

  if (command === "graph") {
    const parsed = parseGraphArgs(commandArgs);
    return withVerbose(parsed.error ? parsed : { command, ...parsed });
  }

  if (command === "analyze") {
    const parsed = parseAnalyzeArgs(commandArgs);
    return withVerbose(parsed.error ? parsed : { command, ...parsed });
  }

  if (command === "apply") {
    const parsed = parseApplyArgs(commandArgs);
    return withVerbose(parsed.error ? parsed : { command, ...parsed });
  }

  if (command === "diff") {
    const parsed = parseDiffArgs(commandArgs);
    return withVerbose(parsed.error ? parsed : { command, ...parsed });
  }

  if (command === "lint") {
    const parsed = parseLintArgs(commandArgs);
    return withVerbose(parsed.error ? parsed : { command, ...parsed });
  }

  if (command === "doctor") {
    const parsed = parseDoctorArgs(commandArgs);
    return withVerbose(parsed.error ? parsed : { command, ...parsed });
  }

  if (command === "generate-sdk") {
    const parsed = parseGenerateSdkArgs(commandArgs);
    return withVerbose(parsed.error ? parsed : { command, ...parsed });
  }

  if (command === "export-doc-flows") {
    const parsed = parseExportDocFlowsArgs(commandArgs);
    return withVerbose(parsed.error ? parsed : { command, ...parsed });
  }

  if (command === "generate-postman") {
    const parsed = parseGeneratePostmanArgs(commandArgs);
    return withVerbose(parsed.error ? parsed : { command, ...parsed });
  }

  if (command === "generate-insomnia") {
    const parsed = parseGenerateInsomniaArgs(commandArgs);
    return withVerbose(parsed.error ? parsed : { command, ...parsed });
  }

  if (command === "generate-redoc") {
    const parsed = parseGenerateRedocArgs(commandArgs);
    return withVerbose(parsed.error ? parsed : { command, ...parsed });
  }

  if (command === "completion") {
    const parsed = parseCompletionArgs(commandArgs);
    return withVerbose(parsed.error ? parsed : { command, ...parsed });
  }

  return withVerbose({ error: buildUnknownCommandError(command) });
}

function runCompletion(parsed) {
  console.log(buildCompletionScript(parsed.shell));
  return 0;
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
    const baseDir = path.dirname(openApiFile);
    const newFileName = `${parsed.name}.x${extension}`;
    const legacyFileName = `${parsed.name}-openapi-flow${extension}`;
    const newPath = path.join(baseDir, newFileName);
    const legacyPath = path.join(baseDir, legacyFileName);

    if (fs.existsSync(newPath)) {
      return newPath;
    }

    if (fs.existsSync(legacyPath)) {
      return legacyPath;
    }

    return newPath;
  }

  return path.resolve(process.cwd(), DEFAULT_FLOWS_FILE);
}

function looksLikeFlowsSidecar(filePath) {
  if (!filePath) return false;
  const normalized = filePath.toLowerCase();
  return normalized.endsWith(".x.yaml")
    || normalized.endsWith(".x.yml")
    || normalized.endsWith(".x.json")
    || normalized.endsWith("-openapi-flow.yaml")
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
  const trackedCount = mergedFlows.operations.length;
  const sidecarDiff = summarizeSidecarDiff(flowsDoc, mergedFlows);

  let applyMessage = "Init completed without regenerating flow output.";
  const flowOutputExists = fs.existsSync(flowOutputPath);
  let shouldRecreateFlowOutput = !flowOutputExists;
  let sidecarBackupPath = null;

  if (parsed.dryRun) {
    let dryRunFlowPlan;
    if (!flowOutputExists) {
      dryRunFlowPlan = `Would generate flow output: ${flowOutputPath}`;
    } else if (parsed.force) {
      dryRunFlowPlan = `Would recreate flow output: ${flowOutputPath} (with sidecar backup).`;
    } else {
      dryRunFlowPlan = `Flow output exists at ${flowOutputPath}; would require interactive confirmation to recreate (or use --force).`;
    }

    console.log(`[dry-run] Using existing OpenAPI file: ${targetOpenApiFile}`);
    console.log(`[dry-run] Flows sidecar target: ${flowsPath}`);
    console.log(`[dry-run] Tracked operations: ${trackedCount}`);
    console.log(`[dry-run] Sidecar changes -> added: ${sidecarDiff.added}, changed: ${sidecarDiff.changed}, removed: ${sidecarDiff.removed}`);
    console.log(`[dry-run] ${dryRunFlowPlan}`);
    console.log("[dry-run] No files were written.");
    return 0;
  }

  if (flowOutputExists) {
    if (parsed.force) {
      shouldRecreateFlowOutput = true;
      if (fs.existsSync(flowsPath)) {
        sidecarBackupPath = getNextBackupPath(flowsPath);
        fs.copyFileSync(flowsPath, sidecarBackupPath);
      }
    } else {
      const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
      if (isInteractive) {
      let shouldRecreate;
      try {
        shouldRecreate = askForConfirmation(
          `Flow output already exists at ${flowOutputPath}. Recreate it from current OpenAPI + sidecar?`
        );
      } catch (err) {
        if (err && (err.code === "EAGAIN" || err.code === "EWOULDBLOCK")) {
          console.error("ERROR: Could not read interactive confirmation from stdin (EAGAIN).");
          console.error("Run `x-openapi-flow apply` to update the existing flow output in this environment.");
          return 1;
        }
        throw err;
      }

      if (shouldRecreate) {
        shouldRecreateFlowOutput = true;
        if (fs.existsSync(flowsPath)) {
          sidecarBackupPath = getNextBackupPath(flowsPath);
          fs.copyFileSync(flowsPath, sidecarBackupPath);
        }
      } else {
        applyMessage = "Flow output kept as-is (recreate cancelled by user).";
      }
      } else {
        console.error(`ERROR: Flow output already exists at ${flowOutputPath}.`);
        console.error("Use `x-openapi-flow init --force` to recreate, or `x-openapi-flow apply` to update in non-interactive mode.");
        return 1;
      }
    }
  }

  writeFlowsFile(flowsPath, mergedFlows);

  if (shouldRecreateFlowOutput) {
    const appliedCount = applyFlowsAndWrite(targetOpenApiFile, mergedFlows, flowOutputPath);
    if (flowOutputExists) {
      applyMessage = sidecarBackupPath
        ? `Flow output recreated: ${flowOutputPath} (applied entries: ${appliedCount}). Sidecar backup: ${sidecarBackupPath}.`
        : `Flow output recreated: ${flowOutputPath} (applied entries: ${appliedCount}).`;
    } else {
      applyMessage = `Flow output generated: ${flowOutputPath} (applied entries: ${appliedCount}).`;
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

function runDiff(parsed) {
  const targetOpenApiFile = parsed.openApiFile || findOpenApiFile(process.cwd());

  if (!targetOpenApiFile) {
    console.error("ERROR: Could not find an existing OpenAPI file in this repository.");
    console.error("Expected one of: openapi.yaml|yml|json, swagger.yaml|yml|json");
    return 1;
  }

  const flowsPath = resolveFlowsPath(targetOpenApiFile, parsed.flowsPath);

  let api;
  let existingFlows;
  try {
    api = loadApi(targetOpenApiFile);
  } catch (err) {
    console.error(`ERROR: Could not parse OpenAPI file — ${err.message}`);
    return 1;
  }

  try {
    existingFlows = readFlowsFile(flowsPath);
  } catch (err) {
    console.error(`ERROR: Could not parse flows file — ${err.message}`);
    return 1;
  }

  const mergedFlows = mergeFlowsWithOpenApi(api, existingFlows);
  const diff = summarizeSidecarDiff(existingFlows, mergedFlows);

  if (parsed.format === "json") {
    console.log(JSON.stringify({
      openApiFile: targetOpenApiFile,
      flowsPath,
      trackedOperations: mergedFlows.operations.length,
      exists: fs.existsSync(flowsPath),
      diff,
    }, null, 2));
    return 0;
  }

  const addedText = diff.addedOperationIds.length ? diff.addedOperationIds.join(", ") : "-";
  const changedText = diff.changedOperationIds.length ? diff.changedOperationIds.join(", ") : "-";
  const removedText = diff.removedOperationIds.length ? diff.removedOperationIds.join(", ") : "-";

  console.log(`OpenAPI source: ${targetOpenApiFile}`);
  console.log(`Flows sidecar: ${flowsPath}${fs.existsSync(flowsPath) ? "" : " (not found; treated as empty)"}`);
  console.log(`Tracked operations: ${mergedFlows.operations.length}`);
  console.log(`Sidecar diff -> added: ${diff.added}, changed: ${diff.changed}, removed: ${diff.removed}`);
  console.log(`Added operationIds: ${addedText}`);
  console.log(`Changed operationIds: ${changedText}`);
  if (diff.changedOperationDetails.length > 0) {
    console.log("Changed details:");
    diff.changedOperationDetails.forEach((detail) => {
      const paths = detail.changedPaths.length ? detail.changedPaths.join(", ") : "(root)";
      console.log(`- ${detail.operationId}: ${paths}`);
    });
  }
  console.log(`Removed operationIds: ${removedText}`);
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

function collectOperationIds(api) {
  const operationsById = new Map();
  const paths = (api && api.paths) || {};
  const methods = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation || !operation.operationId) {
        continue;
      }
      operationsById.set(operation.operationId, {
        endpoint: `${method.toUpperCase()} ${pathKey}`,
      });
    }
  }

  return operationsById;
}

function runLint(parsed, configData = {}) {
  const targetOpenApiFile = parsed.openApiFile || findOpenApiFile(process.cwd());
  if (!targetOpenApiFile) {
    console.error("ERROR: Could not find an existing OpenAPI file in this repository.");
    console.error("Expected one of: openapi.yaml|yml|json, swagger.yaml|yml|json");
    return 1;
  }

  let api;
  try {
    api = loadApi(targetOpenApiFile);
  } catch (err) {
    console.error(`ERROR: Could not parse OpenAPI file — ${err.message}`);
    return 1;
  }

  const flows = extractFlows(api);
  const lintConfig = (configData && configData.lint && configData.lint.rules) || {};
  const ruleConfig = {
    next_operation_id_exists: lintConfig.next_operation_id_exists !== false,
    prerequisite_operation_ids_exist: lintConfig.prerequisite_operation_ids_exist !== false,
    duplicate_transitions: lintConfig.duplicate_transitions !== false,
    terminal_path: lintConfig.terminal_path !== false,
  };

  const operationsById = collectOperationIds(api);
  const graph = buildStateGraph(flows);
  const invalidOperationReferences = detectInvalidOperationReferences(operationsById, flows);
  const duplicateTransitions = detectDuplicateTransitions(flows);
  const terminalCoverage = detectTerminalCoverage(graph);

  const nextOperationIssues = invalidOperationReferences
    .filter((entry) => entry.type === "next_operation_id")
    .map((entry) => ({
      operation_id: entry.operation_id,
      declared_in: entry.declared_in,
    }));

  const prerequisiteIssues = invalidOperationReferences
    .filter((entry) => entry.type === "prerequisite_operation_ids")
    .map((entry) => ({
      operation_id: entry.operation_id,
      declared_in: entry.declared_in,
    }));

  const issues = {
    next_operation_id_exists: ruleConfig.next_operation_id_exists ? nextOperationIssues : [],
    prerequisite_operation_ids_exist: ruleConfig.prerequisite_operation_ids_exist ? prerequisiteIssues : [],
    duplicate_transitions: ruleConfig.duplicate_transitions ? duplicateTransitions : [],
    terminal_path: {
      terminal_states: ruleConfig.terminal_path ? terminalCoverage.terminal_states : [],
      non_terminating_states: ruleConfig.terminal_path ? terminalCoverage.non_terminating_states : [],
    },
  };

  const errorCount =
    issues.next_operation_id_exists.length +
    issues.prerequisite_operation_ids_exist.length +
    issues.duplicate_transitions.length +
    issues.terminal_path.non_terminating_states.length;

  const result = {
    ok: errorCount === 0,
    path: targetOpenApiFile,
    flowCount: flows.length,
    ruleConfig,
    issues,
    summary: {
      errors: errorCount,
      violated_rules: Object.entries({
        next_operation_id_exists: issues.next_operation_id_exists.length,
        prerequisite_operation_ids_exist: issues.prerequisite_operation_ids_exist.length,
        duplicate_transitions: issues.duplicate_transitions.length,
        terminal_path: issues.terminal_path.non_terminating_states.length,
      })
        .filter(([, count]) => count > 0)
        .map(([rule]) => rule),
    },
  };

  if (parsed.format === "json") {
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }

  console.log(`Linting: ${targetOpenApiFile}`);
  console.log(`Found ${flows.length} x-openapi-flow definition(s).`);
  console.log("Rules:");
  Object.entries(ruleConfig).forEach(([ruleName, enabled]) => {
    console.log(`- ${ruleName}: ${enabled ? "enabled" : "disabled"}`);
  });

  if (flows.length === 0) {
    console.log("No x-openapi-flow definitions found.");
    return 0;
  }

  if (issues.next_operation_id_exists.length === 0) {
    console.log("✔ next_operation_id_exists: no invalid references.");
  } else {
    console.error(`✘ next_operation_id_exists: ${issues.next_operation_id_exists.length} invalid reference(s).`);
    issues.next_operation_id_exists.forEach((entry) => {
      console.error(`  - ${entry.operation_id} (declared in ${entry.declared_in})`);
    });
  }

  if (issues.prerequisite_operation_ids_exist.length === 0) {
    console.log("✔ prerequisite_operation_ids_exist: no invalid references.");
  } else {
    console.error(`✘ prerequisite_operation_ids_exist: ${issues.prerequisite_operation_ids_exist.length} invalid reference(s).`);
    issues.prerequisite_operation_ids_exist.forEach((entry) => {
      console.error(`  - ${entry.operation_id} (declared in ${entry.declared_in})`);
    });
  }

  if (issues.duplicate_transitions.length === 0) {
    console.log("✔ duplicate_transitions: none found.");
  } else {
    console.error(`✘ duplicate_transitions: ${issues.duplicate_transitions.length} duplicate transition group(s).`);
    issues.duplicate_transitions.forEach((entry) => {
      console.error(`  - ${entry.from} -> ${entry.to} (${entry.trigger_type}), count=${entry.count}`);
    });
  }

  if (issues.terminal_path.non_terminating_states.length === 0) {
    console.log("✔ terminal_path: all states can reach a terminal state.");
  } else {
    console.error(
      `✘ terminal_path: states without path to terminal -> ${issues.terminal_path.non_terminating_states.join(", ")}`
    );
  }

  if (result.ok) {
    console.log("Lint checks passed ✔");
  } else {
    console.error("Lint checks finished with errors.");
  }

  return result.ok ? 0 : 1;
}

function buildMermaidGraph(filePath) {
  const flows = extractFlowsForGraph(filePath);
  if (flows.length === 0) {
    throw new Error("No x-openapi-flow definitions found in OpenAPI or sidecar file");
  }

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
    }
  }

  const sortedNodes = [...nodes].sort((a, b) => a.localeCompare(b));
  const sortedEdges = [...edges].sort((left, right) => {
    const leftKey = [
      left.from,
      left.to,
      left.next_operation_id || "",
      (left.prerequisite_operation_ids || []).join(","),
    ].join("::");
    const rightKey = [
      right.from,
      right.to,
      right.next_operation_id || "",
      (right.prerequisite_operation_ids || []).join(","),
    ].join("::");
    return leftKey.localeCompare(rightKey);
  });

  const lines = ["stateDiagram-v2"];
  for (const state of sortedNodes) {
    lines.push(`  state ${state}`);
  }
  for (const edge of sortedEdges) {
    const labelParts = [];
    if (edge.next_operation_id) {
      labelParts.push(`next:${edge.next_operation_id}`);
    }
    if (Array.isArray(edge.prerequisite_operation_ids) && edge.prerequisite_operation_ids.length > 0) {
      labelParts.push(`requires:${edge.prerequisite_operation_ids.join(",")}`);
    }
    const label = labelParts.join(" | ");
    lines.push(`  ${edge.from} --> ${edge.to}${label ? `: ${label}` : ""}`);
  }

  return {
    format_version: "1.0",
    flowCount: flows.length,
    nodes: sortedNodes,
    edges: sortedEdges,
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

function toKebabCase(value) {
  if (!value) {
    return "operation";
  }

  const normalized = String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return normalized || "operation";
}

function deriveResourceKey(pathKey) {
  const tokens = String(pathKey || "")
    .split("/")
    .filter((token) => token && !token.startsWith("{") && !token.endsWith("}"));

  return tokens[0] || "root";
}

function inferCurrentState(entry) {
  const fingerprint = [entry.method, entry.path, entry.resolvedOperationId]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const keywordToState = [
    { match: /cancel|void/, state: "CANCELED" },
    { match: /refund/, state: "REFUNDED" },
    { match: /fail|error|decline|reject/, state: "FAILED" },
    { match: /deliver|received/, state: "DELIVERED" },
    { match: /ship|dispatch/, state: "SHIPPED" },
    { match: /complete|done|close|finish/, state: "COMPLETED" },
    { match: /pay|charge|collect/, state: "PAID" },
    { match: /confirm|approve|accept/, state: "CONFIRMED" },
    { match: /process|fulfill/, state: "PROCESSING" },
    { match: /create|submit|register/, state: "CREATED" },
    { match: /get|list|find|fetch|read/, state: "OBSERVED" },
  ];

  for (const rule of keywordToState) {
    if (rule.match.test(fingerprint)) {
      return rule.state;
    }
  }

  if (entry.method === "post") {
    return "CREATED";
  }
  if (entry.method === "delete") {
    return "CANCELED";
  }
  if (entry.method === "patch" || entry.method === "put") {
    return "PROCESSING";
  }

  return "OBSERVED";
}

function inferTriggerType(fromEntry, toEntry) {
  const toFingerprint = `${toEntry.method} ${toEntry.path} ${toEntry.resolvedOperationId}`.toLowerCase();
  if (/(webhook|callback|event)/.test(toFingerprint)) {
    return "webhook";
  }

  if (fromEntry.method === "get" || fromEntry.method === "head") {
    return "polling";
  }

  return "synchronous";
}

function buildAnalyzedFlowsDoc(api) {
  const stateOrder = {
    CREATED: 10,
    CONFIRMED: 20,
    PAID: 30,
    PROCESSING: 40,
    SHIPPED: 50,
    DELIVERED: 60,
    COMPLETED: 70,
    REFUNDED: 80,
    CANCELED: 90,
    FAILED: 100,
    OBSERVED: 1000,
  };

  const terminalStates = new Set(["COMPLETED", "DELIVERED", "REFUNDED", "CANCELED", "FAILED"]);
  const entries = extractOperationEntries(api);

  const inferred = entries.map((entry) => ({
    ...entry,
    resourceKey: deriveResourceKey(entry.path),
    inferredState: inferCurrentState(entry),
    inferredRank: stateOrder[inferCurrentState(entry)] || 1000,
  }));

  const transitionInsights = [];

  const operations = inferred.map((entry) => {
    const sameResource = inferred.filter((candidate) => candidate.resourceKey === entry.resourceKey);
    const prioritized = sameResource.length > 1 ? sameResource : inferred;

    let transition = null;
    if (!terminalStates.has(entry.inferredState)) {
      const nextCandidates = prioritized
        .filter((candidate) => candidate.resolvedOperationId !== entry.resolvedOperationId)
        .filter((candidate) => candidate.inferredRank > entry.inferredRank)
        .sort((left, right) => {
          const rankDelta = (left.inferredRank - entry.inferredRank) - (right.inferredRank - entry.inferredRank);
          if (rankDelta !== 0) {
            return rankDelta;
          }
          return left.resolvedOperationId.localeCompare(right.resolvedOperationId);
        });

      const next = nextCandidates[0];
      if (next) {
        const confidence = Math.min(
          0.95,
          0.55
            + (sameResource.length > 1 ? 0.25 : 0)
            + (entry.inferredRank < 1000 && next.inferredRank < 1000 ? 0.1 : 0)
            + (nextCandidates.length === 1 ? 0.1 : 0)
        );

        const confidenceReasons = [];
        if (sameResource.length > 1) {
          confidenceReasons.push("same_resource");
        }
        if (entry.inferredRank < 1000 && next.inferredRank < 1000) {
          confidenceReasons.push("known_state_progression");
        }
        if (nextCandidates.length === 1) {
          confidenceReasons.push("single_candidate");
        }
        if (confidenceReasons.length === 0) {
          confidenceReasons.push("fallback_ordering");
        }

        transition = {
          target_state: next.inferredState,
          trigger_type: inferTriggerType(entry, next),
          next_operation_id: next.resolvedOperationId,
        };

        transitionInsights.push({
          from_operation_id: entry.resolvedOperationId,
          to_operation_id: next.resolvedOperationId,
          from_state: entry.inferredState,
          target_state: next.inferredState,
          trigger_type: transition.trigger_type,
          confidence: Number(confidence.toFixed(2)),
          confidence_reasons: confidenceReasons,
        });
      }
    }

    return {
      operationId: entry.resolvedOperationId,
      "x-openapi-flow": {
        version: "1.0",
        id: toKebabCase(entry.resolvedOperationId),
        current_state: entry.inferredState,
        description: "Auto-generated by x-openapi-flow analyze",
        transitions: transition ? [transition] : [],
      },
    };
  });

  return {
    version: "1.0",
    operations,
    analysis: {
      operationCount: inferred.length,
      uniqueStates: Array.from(new Set(inferred.map((entry) => entry.inferredState))).sort(),
      inferredTransitions: operations.reduce((total, operation) => {
        const transitions = operation["x-openapi-flow"].transitions || [];
        return total + transitions.length;
      }, 0),
      transitionConfidence: transitionInsights,
    },
  };
}

function mergeSidecarOperations(existingDoc, inferredDoc) {
  const existingOps = Array.isArray(existingDoc && existingDoc.operations)
    ? existingDoc.operations
    : [];
  const inferredOps = Array.isArray(inferredDoc && inferredDoc.operations)
    ? inferredDoc.operations
    : [];

  const existingByOperationId = new Map();
  for (const operationEntry of existingOps) {
    if (operationEntry && operationEntry.operationId) {
      existingByOperationId.set(operationEntry.operationId, operationEntry);
    }
  }

  const mergedOps = [];
  const consumedExisting = new Set();

  for (const inferredEntry of inferredOps) {
    const existingEntry = existingByOperationId.get(inferredEntry.operationId);
    if (!existingEntry) {
      mergedOps.push(inferredEntry);
      continue;
    }

    consumedExisting.add(inferredEntry.operationId);

    const existingFlow = existingEntry["x-openapi-flow"] || {};
    const inferredFlow = inferredEntry["x-openapi-flow"] || {};
    const existingTransitions = Array.isArray(existingFlow.transitions) ? existingFlow.transitions : [];

    mergedOps.push({
      operationId: inferredEntry.operationId,
      "x-openapi-flow": {
        ...inferredFlow,
        ...existingFlow,
        transitions: existingTransitions.length > 0
          ? existingTransitions
          : (Array.isArray(inferredFlow.transitions) ? inferredFlow.transitions : []),
      },
    });
  }

  for (const existingEntry of existingOps) {
    if (!existingEntry || !existingEntry.operationId) {
      continue;
    }
    if (!consumedExisting.has(existingEntry.operationId)) {
      mergedOps.push(existingEntry);
    }
  }

  return {
    version: "1.0",
    operations: mergedOps,
    mergeStats: {
      existingOperations: existingOps.length,
      inferredOperations: inferredOps.length,
      mergedOperations: mergedOps.length,
      preservedExistingOnly: Math.max(0, mergedOps.length - inferredOps.length),
    },
  };
}

function runAnalyze(parsed) {
  const targetOpenApiFile = parsed.openApiFile || findOpenApiFile(process.cwd());
  if (!targetOpenApiFile) {
    console.error("ERROR: Could not find an existing OpenAPI file in this repository.");
    console.error("Expected one of: openapi.yaml|yml|json, swagger.yaml|yml|json");
    return 1;
  }

  let api;
  try {
    api = loadApi(targetOpenApiFile);
  } catch (err) {
    console.error(`ERROR: Could not parse OpenAPI file — ${err.message}`);
    return 1;
  }

  const analysisResult = buildAnalyzedFlowsDoc(api);
  let sidecarDoc = {
    version: analysisResult.version,
    operations: analysisResult.operations,
  };
  let mergeStats = null;

  if (parsed.merge) {
    const mergeFlowsPath = resolveFlowsPath(targetOpenApiFile, parsed.flowsPath);
    let existingFlows = { version: "1.0", operations: [] };
    if (fs.existsSync(mergeFlowsPath)) {
      try {
        existingFlows = readFlowsFile(mergeFlowsPath);
      } catch (err) {
        console.error(`ERROR: Could not parse flows file for merge — ${err.message}`);
        return 1;
      }
    }

    const merged = mergeSidecarOperations(existingFlows, sidecarDoc);
    sidecarDoc = {
      version: merged.version,
      operations: merged.operations,
    };
    mergeStats = {
      enabled: true,
      flowsPath: mergeFlowsPath,
      ...merged.mergeStats,
    };
  }

  if (parsed.outPath) {
    writeFlowsFile(parsed.outPath, sidecarDoc);
  }

  if (parsed.format === "json") {
    console.log(JSON.stringify({
      openApiFile: targetOpenApiFile,
      outputPath: parsed.outPath || null,
      merge: mergeStats || { enabled: false },
      analysis: analysisResult.analysis,
      sidecar: sidecarDoc,
    }, null, 2));
    return 0;
  }

  console.log(`Analyzed OpenAPI source: ${targetOpenApiFile}`);
  console.log(`Inferred operations: ${analysisResult.analysis.operationCount}`);
  console.log(`Inferred transitions: ${analysisResult.analysis.inferredTransitions}`);
  console.log(`States: ${analysisResult.analysis.uniqueStates.join(", ") || "-"}`);
  if (mergeStats && mergeStats.enabled) {
    console.log(`Merged with sidecar: ${mergeStats.flowsPath}`);
    console.log(`Merged operations total: ${mergeStats.mergedOperations}`);
  }

  if (parsed.outPath) {
    console.log(`Suggested sidecar written to: ${parsed.outPath}`);
    return 0;
  }

  console.log("---");
  console.log(yaml.dump(sidecarDoc, { noRefs: true, lineWidth: -1 }).trimEnd());
  return 0;
}

function runGenerateSdk(parsed) {
  const targetOpenApiFile = parsed.openApiFile || findOpenApiFile(process.cwd());
  if (!targetOpenApiFile) {
    console.error("ERROR: Could not find an existing OpenAPI file in this repository.");
    console.error("Expected one of: openapi.yaml|yml|json, swagger.yaml|yml|json");
    return 1;
  }

  try {
    const result = generateSdk({
      apiPath: targetOpenApiFile,
      language: parsed.language,
      outputDir: parsed.outputPath,
    });

    console.log(`OpenAPI source: ${targetOpenApiFile}`);
    console.log(`SDK language: ${result.language}`);
    console.log(`Output directory: ${result.outputDir}`);
    console.log(`Flow definitions processed: ${result.flowCount}`);
    console.log(`Resources generated: ${result.resourceCount}`);
    for (const resource of result.resources) {
      console.log(`- ${resource.name}: operations=${resource.operations}, states=${resource.states}, initial=[${resource.initialStates.join(", ")}]`);
    }
    return 0;
  } catch (err) {
    console.error(`ERROR: Could not generate SDK — ${err.message}`);
    return 1;
  }
}

function runExportDocFlows(parsed) {
  const targetOpenApiFile = parsed.openApiFile || findOpenApiFile(process.cwd());
  if (!targetOpenApiFile) {
    console.error("ERROR: Could not find an existing OpenAPI file in this repository.");
    console.error("Expected one of: openapi.yaml|yml|json, swagger.yaml|yml|json");
    return 1;
  }

  try {
    const result = exportDocFlows({
      apiPath: targetOpenApiFile,
      outputPath: parsed.outputPath,
      format: parsed.format,
    });

    console.log(`OpenAPI source: ${targetOpenApiFile}`);
    console.log(`Output: ${result.outputPath}`);
    console.log(`Format: ${result.format}`);
    console.log(`Resources: ${result.resources}`);
    console.log(`Flow definitions: ${result.flowCount}`);
    return 0;
  } catch (err) {
    console.error(`ERROR: Could not export doc flows — ${err.message}`);
    return 1;
  }
}

function runGeneratePostman(parsed) {
  const targetOpenApiFile = parsed.openApiFile || findOpenApiFile(process.cwd());
  if (!targetOpenApiFile) {
    console.error("ERROR: Could not find an existing OpenAPI file in this repository.");
    console.error("Expected one of: openapi.yaml|yml|json, swagger.yaml|yml|json");
    return 1;
  }

  try {
    const result = generatePostmanCollection({
      apiPath: targetOpenApiFile,
      outputPath: parsed.outputPath,
      withScripts: parsed.withScripts,
    });

    console.log(`OpenAPI source: ${targetOpenApiFile}`);
    console.log(`Output: ${result.outputPath}`);
    console.log(`Resources: ${result.resources}`);
    console.log(`Flow definitions: ${result.flowCount}`);
    console.log(`Scripts enabled: ${result.withScripts}`);
    return 0;
  } catch (err) {
    console.error(`ERROR: Could not generate Postman collection — ${err.message}`);
    return 1;
  }
}

function runGenerateInsomnia(parsed) {
  const targetOpenApiFile = parsed.openApiFile || findOpenApiFile(process.cwd());
  if (!targetOpenApiFile) {
    console.error("ERROR: Could not find an existing OpenAPI file in this repository.");
    console.error("Expected one of: openapi.yaml|yml|json, swagger.yaml|yml|json");
    return 1;
  }

  try {
    const result = generateInsomniaWorkspace({
      apiPath: targetOpenApiFile,
      outputPath: parsed.outputPath,
    });

    console.log(`OpenAPI source: ${targetOpenApiFile}`);
    console.log(`Output: ${result.outputPath}`);
    console.log(`Resources: ${result.resources}`);
    console.log(`Flow definitions: ${result.flowCount}`);
    return 0;
  } catch (err) {
    console.error(`ERROR: Could not generate Insomnia workspace — ${err.message}`);
    return 1;
  }
}

function runGenerateRedoc(parsed) {
  const targetOpenApiFile = parsed.openApiFile || findOpenApiFile(process.cwd());
  if (!targetOpenApiFile) {
    console.error("ERROR: Could not find an existing OpenAPI file in this repository.");
    console.error("Expected one of: openapi.yaml|yml|json, swagger.yaml|yml|json");
    return 1;
  }

  try {
    const result = generateRedocPackage({
      apiPath: targetOpenApiFile,
      outputDir: parsed.outputPath,
    });

    console.log(`OpenAPI source: ${targetOpenApiFile}`);
    console.log(`Output directory: ${result.outputDir}`);
    console.log(`Redoc index: ${result.indexPath}`);
    console.log(`Resources: ${result.resources}`);
    console.log(`Flow definitions: ${result.flowCount}`);
    return 0;
  } catch (err) {
    console.error(`ERROR: Could not generate Redoc package — ${err.message}`);
    return 1;
  }
}

function main() {
  const parsed = parseArgs(process.argv);
  printVerbose(parsed);

  if (parsed.version) {
    console.log(pkg.version);
    process.exit(0);
  }

  if (parsed.help) {
    if (parsed.command && !KNOWN_COMMANDS.includes(parsed.command)) {
      console.error(`ERROR: ${buildUnknownCommandError(parsed.command)}`);
      process.exit(1);
    }
    printHelp(parsed.command);
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

  if (parsed.command === "analyze") {
    process.exit(runAnalyze(parsed));
  }

  if (parsed.command === "generate-sdk") {
    process.exit(runGenerateSdk(parsed));
  }

  if (parsed.command === "export-doc-flows") {
    process.exit(runExportDocFlows(parsed));
  }

  if (parsed.command === "generate-postman") {
    process.exit(runGeneratePostman(parsed));
  }

  if (parsed.command === "generate-insomnia") {
    process.exit(runGenerateInsomnia(parsed));
  }

  if (parsed.command === "generate-redoc") {
    process.exit(runGenerateRedoc(parsed));
  }

  if (parsed.command === "completion") {
    process.exit(runCompletion(parsed));
  }

  if (parsed.command === "apply") {
    process.exit(runApply(parsed));
  }

  if (parsed.command === "diff") {
    process.exit(runDiff(parsed));
  }

  if (parsed.command === "lint") {
    const config = loadConfig(parsed.configPath);
    if (config.error) {
      console.error(`ERROR: ${config.error}`);
      process.exit(1);
    }
    process.exit(runLint(parsed, config.data));
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
