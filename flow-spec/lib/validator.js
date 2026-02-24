"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const Ajv = require("ajv");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const SCHEMA_PATH = path.join(__dirname, "..", "schema", "flow-schema.json");
const DEFAULT_API_PATH = path.join(
  __dirname,
  "..",
  "examples",
  "payment-api.yaml"
);

// ---------------------------------------------------------------------------
// Load & compile schema
// ---------------------------------------------------------------------------
const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load an OAS document from a YAML file.
 * @param {string} filePath - Absolute or relative path to the YAML file.
 * @returns {object} Parsed OAS document.
 */
function loadApi(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return yaml.load(content);
}

/**
 * Extract every x-flow object found in the `paths` section of an OAS document.
 * @param {object} api - Parsed OAS document.
 * @returns {{ endpoint: string, flow: object }[]}
 */
function extractFlows(api) {
  const entries = [];
  const paths = (api && api.paths) || {};

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    const HTTP_METHODS = [
      "get",
      "put",
      "post",
      "delete",
      "options",
      "head",
      "patch",
      "trace",
    ];
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (operation && operation["x-flow"]) {
        entries.push({
          endpoint: `${method.toUpperCase()} ${pathKey}`,
          flow: operation["x-flow"],
        });
      }
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate all x-flow objects against the JSON Schema.
 * @param {{ endpoint: string, flow: object }[]} flows
 * @returns {{ endpoint: string, errors: object[] }[]} Array of validation failures.
 */
function validateFlows(flows) {
  const failures = [];

  for (const { endpoint, flow } of flows) {
    const valid = validate(flow);
    if (!valid) {
      failures.push({ endpoint, errors: validate.errors });
    }
  }

  return failures;
}

/**
 * Verify that every target_state referenced in transitions corresponds to a
 * current_state defined in at least one endpoint of the same API.
 *
 * An "orphan state" is a target_state that has no matching current_state
 * anywhere in the API, meaning the lifecycle graph has a dangling edge.
 *
 * @param {{ endpoint: string, flow: object }[]} flows
 * @returns {{ target_state: string, declared_in: string }[]} Orphan states.
 */
function detectOrphanStates(flows) {
  // Collect every current_state declared across all endpoints.
  const knownStates = new Set(flows.map(({ flow }) => flow.current_state));

  const orphans = [];

  for (const { endpoint, flow } of flows) {
    const transitions = flow.transitions || [];
    for (const transition of transitions) {
      if (
        transition.target_state &&
        !knownStates.has(transition.target_state)
      ) {
        orphans.push({
          target_state: transition.target_state,
          declared_in: endpoint,
        });
      }
    }
  }

  return orphans;
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

/**
 * Run all validations against an OAS file and print results.
 * Exits with code 1 if any errors are found.
 * @param {string} [apiPath] - Path to the OAS YAML file (defaults to payment-api.yaml).
 */
function run(apiPath) {
  const resolvedPath = apiPath
    ? path.resolve(apiPath)
    : DEFAULT_API_PATH;

  console.log(`\nValidating: ${resolvedPath}\n`);

  // 1. Load API
  let api;
  try {
    api = loadApi(resolvedPath);
  } catch (err) {
    console.error(`ERROR: Could not load API file — ${err.message}`);
    process.exit(1);
  }

  // 2. Extract x-flow objects
  const flows = extractFlows(api);

  if (flows.length === 0) {
    console.warn("WARNING: No x-flow extensions found in the API paths.");
    process.exit(0);
  }

  console.log(`Found ${flows.length} x-flow definition(s).\n`);

  let hasErrors = false;

  // 3. Schema validation
  const schemaFailures = validateFlows(flows);
  if (schemaFailures.length === 0) {
    console.log("✔  Schema validation passed for all x-flow definitions.");
  } else {
    hasErrors = true;
    console.error("✘  Schema validation FAILED:");
    for (const { endpoint, errors } of schemaFailures) {
      console.error(`   [${endpoint}]`);
      for (const err of errors) {
        console.error(`     - ${err.instancePath || "(root)"}: ${err.message}`);
      }
    }
  }

  // 4. Orphan state detection
  const orphans = detectOrphanStates(flows);
  if (orphans.length === 0) {
    console.log("✔  Graph validation passed — no orphan states detected.");
  } else {
    hasErrors = true;
    console.error("✘  Graph validation FAILED — orphan state(s) detected:");
    for (const { target_state, declared_in } of orphans) {
      console.error(
        `   target_state "${target_state}" (declared in ${declared_in}) has no matching current_state in any endpoint.`
      );
    }
  }

  console.log("");

  if (hasErrors) {
    process.exit(1);
  } else {
    console.log("All validations passed ✔");
    process.exit(0);
  }
}

// Allow the module to be required by tests without side-effects.
if (require.main === module) {
  run(process.argv[2]);
}

module.exports = { loadApi, extractFlows, validateFlows, detectOrphanStates };
