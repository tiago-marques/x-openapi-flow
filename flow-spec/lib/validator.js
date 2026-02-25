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
 * Build human-friendly fix suggestions from AJV errors.
 * @param {object[]} errors
 * @returns {string[]}
 */
function suggestFixes(errors = []) {
  const suggestions = new Set();

  for (const err of errors) {
    if (err.keyword === "required" && err.params && err.params.missingProperty) {
      const missing = err.params.missingProperty;
      if (missing === "version") {
        suggestions.add("Add `version: \"1.0\"` to the x-flow object.");
      } else if (missing === "id") {
        suggestions.add("Add a unique `id` to the x-flow object.");
      } else if (missing === "current_state") {
        suggestions.add("Add `current_state` to describe the operation state.");
      } else {
        suggestions.add(`Add required property \`${missing}\` in x-flow.`);
      }
    }

    if (err.keyword === "enum" && err.instancePath.endsWith("/version")) {
      suggestions.add("Use supported x-flow version: `\"1.0\"`.");
    }

    if (err.keyword === "additionalProperties" && err.params && err.params.additionalProperty) {
      suggestions.add(
        `Remove unsupported property \`${err.params.additionalProperty}\` from x-flow payload.`
      );
    }
  }

  return [...suggestions];
}

function defaultResult(pathValue, ok = true) {
  return {
    ok,
    path: pathValue,
    profile: "strict",
    flowCount: 0,
    schemaFailures: [],
    orphans: [],
    graphChecks: {
      initial_states: [],
      terminal_states: [],
      unreachable_states: [],
      cycle: { has_cycle: false },
    },
    qualityChecks: {
      multiple_initial_states: [],
      duplicate_transitions: [],
      non_terminating_states: [],
      warnings: [],
    },
  };
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

/**
 * Build a directed graph from current_state -> target_state transitions.
 * @param {{ endpoint: string, flow: object }[]} flows
 * @returns {{ nodes: Set<string>, adjacency: Map<string, Set<string>>, indegree: Map<string, number>, outdegree: Map<string, number> }}
 */
function buildStateGraph(flows) {
  const nodes = new Set();
  const adjacency = new Map();
  const indegree = new Map();
  const outdegree = new Map();

  function ensureNode(state) {
    if (!nodes.has(state)) {
      nodes.add(state);
      adjacency.set(state, new Set());
      indegree.set(state, 0);
      outdegree.set(state, 0);
    }
  }

  for (const { flow } of flows) {
    ensureNode(flow.current_state);

    const transitions = flow.transitions || [];
    for (const transition of transitions) {
      if (!transition.target_state) {
        continue;
      }

      ensureNode(transition.target_state);

      const neighbors = adjacency.get(flow.current_state);
      if (!neighbors.has(transition.target_state)) {
        neighbors.add(transition.target_state);
        outdegree.set(flow.current_state, outdegree.get(flow.current_state) + 1);
        indegree.set(transition.target_state, indegree.get(transition.target_state) + 1);
      }
    }
  }

  return { nodes, adjacency, indegree, outdegree };
}

/**
 * Detect states that are unreachable from any initial state.
 * Initial states are those with indegree 0.
 * @param {{ nodes: Set<string>, adjacency: Map<string, Set<string>>, indegree: Map<string, number> }} graph
 * @returns {{ initial_states: string[], unreachable_states: string[] }}
 */
function detectUnreachableStates(graph) {
  const initialStates = [...graph.nodes].filter(
    (state) => graph.indegree.get(state) === 0
  );

  if (initialStates.length === 0) {
    return { initial_states: [], unreachable_states: [...graph.nodes] };
  }

  const visited = new Set();
  const stack = [...initialStates];

  while (stack.length > 0) {
    const current = stack.pop();
    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    const neighbors = graph.adjacency.get(current) || new Set();
    for (const next of neighbors) {
      if (!visited.has(next)) {
        stack.push(next);
      }
    }
  }

  const unreachableStates = [...graph.nodes].filter((state) => !visited.has(state));

  return {
    initial_states: initialStates,
    unreachable_states: unreachableStates,
  };
}

/**
 * Detect at least one directed cycle in the state graph.
 * @param {{ nodes: Set<string>, adjacency: Map<string, Set<string>> }} graph
 * @returns {{ has_cycle: boolean, cycle_path?: string[] }}
 */
function detectCycle(graph) {
  const visited = new Set();
  const inStack = new Set();
  const pathStack = [];

  function dfs(state) {
    visited.add(state);
    inStack.add(state);
    pathStack.push(state);

    const neighbors = graph.adjacency.get(state) || new Set();
    for (const next of neighbors) {
      if (!visited.has(next)) {
        const cycle = dfs(next);
        if (cycle) {
          return cycle;
        }
      } else if (inStack.has(next)) {
        const cycleStartIndex = pathStack.lastIndexOf(next);
        const cyclePath = pathStack.slice(cycleStartIndex).concat(next);
        return cyclePath;
      }
    }

    pathStack.pop();
    inStack.delete(state);
    return null;
  }

  for (const state of graph.nodes) {
    if (!visited.has(state)) {
      const cyclePath = dfs(state);
      if (cyclePath) {
        return { has_cycle: true, cycle_path: cyclePath };
      }
    }
  }

  return { has_cycle: false };
}

/**
 * Detect duplicate transitions with same source, target and trigger_type.
 * @param {{ endpoint: string, flow: object }[]} flows
 * @returns {{ from: string, to: string, trigger_type: string, count: number, declared_in: string[] }[]}
 */
function detectDuplicateTransitions(flows) {
  const transitionMap = new Map();

  for (const { endpoint, flow } of flows) {
    const source = flow.current_state;
    const transitions = flow.transitions || [];

    for (const transition of transitions) {
      const target = transition.target_state;
      const triggerType = transition.trigger_type;

      if (!target || !triggerType) {
        continue;
      }

      const key = `${source}::${target}::${triggerType}`;
      if (!transitionMap.has(key)) {
        transitionMap.set(key, {
          from: source,
          to: target,
          trigger_type: triggerType,
          count: 0,
          declared_in: [],
        });
      }

      const entry = transitionMap.get(key);
      entry.count += 1;
      entry.declared_in.push(endpoint);
    }
  }

  return [...transitionMap.values()].filter((entry) => entry.count > 1);
}

/**
 * Detect states that cannot reach any terminal state.
 * @param {{ nodes: Set<string>, adjacency: Map<string, Set<string>>, outdegree: Map<string, number> }} graph
 * @returns {{ terminal_states: string[], non_terminating_states: string[] }}
 */
function detectTerminalCoverage(graph) {
  const terminalStates = [...graph.nodes].filter(
    (state) => graph.outdegree.get(state) === 0
  );

  if (terminalStates.length === 0) {
    return {
      terminal_states: [],
      non_terminating_states: [...graph.nodes],
    };
  }

  const reverseAdjacency = new Map();
  for (const state of graph.nodes) {
    reverseAdjacency.set(state, new Set());
  }

  for (const [from, targets] of graph.adjacency.entries()) {
    for (const to of targets) {
      reverseAdjacency.get(to).add(from);
    }
  }

  const canReachTerminal = new Set();
  const stack = [...terminalStates];

  while (stack.length > 0) {
    const current = stack.pop();
    if (canReachTerminal.has(current)) {
      continue;
    }

    canReachTerminal.add(current);

    const previousStates = reverseAdjacency.get(current) || new Set();
    for (const previous of previousStates) {
      if (!canReachTerminal.has(previous)) {
        stack.push(previous);
      }
    }
  }

  const nonTerminatingStates = [...graph.nodes].filter(
    (state) => !canReachTerminal.has(state)
  );

  return {
    terminal_states: terminalStates,
    non_terminating_states: nonTerminatingStates,
  };
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

/**
 * Run all validations against an OAS file and print results.
 * @param {string} [apiPath] - Path to the OAS YAML file (defaults to payment-api.yaml).
 * @param {{ output?: "pretty" | "json", strictQuality?: boolean, profile?: "core" | "relaxed" | "strict" }} [options]
 * @returns {{ ok: boolean, path: string, flowCount: number, schemaFailures: object[], orphans: object[], graphChecks: object }}
 */
function run(apiPath, options = {}) {
  const output = options.output || "pretty";
  const strictQuality = options.strictQuality === true;
  const profile = options.profile || "strict";
  const profiles = {
    core: { runAdvanced: false, failAdvanced: false, runQuality: false },
    relaxed: { runAdvanced: true, failAdvanced: false, runQuality: true },
    strict: { runAdvanced: true, failAdvanced: true, runQuality: true },
  };
  const profileConfig = profiles[profile];
  const resolvedPath = apiPath
    ? path.resolve(apiPath)
    : DEFAULT_API_PATH;

  if (!profileConfig) {
    const invalidProfileResult = defaultResult(resolvedPath, false);
    invalidProfileResult.error = `Invalid profile '${profile}'. Use core, relaxed, or strict.`;
    if (output === "json") {
      console.log(JSON.stringify(invalidProfileResult, null, 2));
    } else {
      console.error(`ERROR: ${invalidProfileResult.error}`);
    }
    return invalidProfileResult;
  }

  if (output === "pretty") {
    console.log(`\nValidating: ${resolvedPath}`);
    console.log(`Profile: ${profile}\n`);
  }

  // 1. Load API
  let api;
  try {
    api = loadApi(resolvedPath);
  } catch (err) {
    if (output === "json") {
      const result = defaultResult(resolvedPath, false);
      result.profile = profile;
      result.error = `Could not load API file — ${err.message}`;
      console.log(JSON.stringify(result, null, 2));
      return result;
    }

    console.error(`ERROR: Could not load API file — ${err.message}`);
    const result = defaultResult(resolvedPath, false);
    result.profile = profile;
    result.error = `Could not load API file — ${err.message}`;
    return result;
  }

  // 2. Extract x-flow objects
  const flows = extractFlows(api);

  if (flows.length === 0) {
    const result = defaultResult(resolvedPath, true);
    result.profile = profile;

    if (output === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.warn("WARNING: No x-flow extensions found in the API paths.");
    }

    return result;
  }

  if (output === "pretty") {
    console.log(`Found ${flows.length} x-flow definition(s).\n`);
  }

  let hasErrors = false;

  // 3. Schema validation
  const schemaFailures = validateFlows(flows);
  if (schemaFailures.length > 0) {
    hasErrors = true;
  }

  if (output === "pretty") {
    if (schemaFailures.length === 0) {
      console.log("✔  Schema validation passed for all x-flow definitions.");
    } else {
      console.error("✘  Schema validation FAILED:");
      for (const { endpoint, errors } of schemaFailures) {
        console.error(`   [${endpoint}]`);
        for (const err of errors) {
          console.error(`     - ${err.instancePath || "(root)"}: ${err.message}`);
        }
        const fixes = suggestFixes(errors);
        if (fixes.length > 0) {
          console.error("     Suggested fixes:");
          for (const fix of fixes) {
            console.error(`       * ${fix}`);
          }
        }
      }
    }
  }

  // 4. Orphan state detection
  const orphans = detectOrphanStates(flows);
  if (orphans.length > 0) {
    hasErrors = true;
  }

  if (output === "pretty") {
    if (orphans.length === 0) {
      console.log("✔  Graph validation passed — no orphan states detected.");
    } else {
      console.error("✘  Graph validation FAILED — orphan state(s) detected:");
      for (const { target_state, declared_in } of orphans) {
        console.error(
          `   target_state "${target_state}" (declared in ${declared_in}) has no matching current_state in any endpoint.`
        );
      }
    }
  }

  // 5. Advanced graph checks
  const graph = buildStateGraph(flows);
  const initialStates = [...graph.nodes].filter(
    (state) => graph.indegree.get(state) === 0
  );
  const terminalStates = [...graph.nodes].filter(
    (state) => graph.outdegree.get(state) === 0
  );
  const reachability = detectUnreachableStates(graph);
  const cycle = detectCycle(graph);
  const duplicateTransitions = detectDuplicateTransitions(flows);
  const terminalCoverage = detectTerminalCoverage(graph);
  const multipleInitialStates = initialStates.length > 1 ? initialStates : [];

  if (profileConfig.runAdvanced) {
    if (profileConfig.failAdvanced && (initialStates.length === 0 || terminalStates.length === 0)) {
      hasErrors = true;
    }

    if (profileConfig.failAdvanced && reachability.unreachable_states.length > 0) {
      hasErrors = true;
    }

    if (profileConfig.failAdvanced && cycle.has_cycle) {
      hasErrors = true;
    }
  }

  const qualityWarnings = [];

  if (profileConfig.runQuality && multipleInitialStates.length > 0) {
    qualityWarnings.push(
      `Multiple initial states detected: ${multipleInitialStates.join(", ")}`
    );
  }

  if (profileConfig.runQuality && duplicateTransitions.length > 0) {
    qualityWarnings.push(
      `Duplicate transitions detected: ${duplicateTransitions.length}`
    );
  }

  if (profileConfig.runQuality && terminalCoverage.non_terminating_states.length > 0) {
    qualityWarnings.push(
      `States without path to terminal: ${terminalCoverage.non_terminating_states.join(", ")}`
    );
  }

  if (strictQuality && qualityWarnings.length > 0) {
    hasErrors = true;
  }

  if (output === "pretty") {
    if (profileConfig.runAdvanced) {
      if (initialStates.length === 0) {
        if (profileConfig.failAdvanced) {
          console.error("✘  Graph validation FAILED — no initial state detected (indegree = 0).");
        } else {
          console.warn("⚠  Graph warning — no initial state detected (indegree = 0).");
        }
      }

      if (terminalStates.length === 0) {
        if (profileConfig.failAdvanced) {
          console.error("✘  Graph validation FAILED — no terminal state detected (outdegree = 0).");
        } else {
          console.warn("⚠  Graph warning — no terminal state detected (outdegree = 0).");
        }
      }

      if (reachability.unreachable_states.length > 0) {
        if (profileConfig.failAdvanced) {
          console.error(
            `✘  Graph validation FAILED — unreachable state(s): ${reachability.unreachable_states.join(", ")}`
          );
        } else {
          console.warn(
            `⚠  Graph warning — unreachable state(s): ${reachability.unreachable_states.join(", ")}`
          );
        }
      }

      if (cycle.has_cycle) {
        if (profileConfig.failAdvanced) {
          console.error(
            `✘  Graph validation FAILED — cycle detected: ${cycle.cycle_path.join(" -> ")}`
          );
        } else {
          console.warn(
            `⚠  Graph warning — cycle detected: ${cycle.cycle_path.join(" -> ")}`
          );
        }
      }

      if (
        initialStates.length > 0 &&
        terminalStates.length > 0 &&
        reachability.unreachable_states.length === 0 &&
        !cycle.has_cycle
      ) {
        console.log("✔  Advanced graph checks passed (initial, terminal, reachability, acyclic).");
      }
    }

    if (profileConfig.runQuality) {
      if (qualityWarnings.length === 0) {
        console.log("✔  Quality checks passed (single initial, no duplicate transitions, terminal coverage).");
      } else {
        for (const warning of qualityWarnings) {
          if (strictQuality) {
            console.error(`✘  Quality check FAILED (strict): ${warning}`);
          } else {
            console.warn(`⚠  Quality warning: ${warning}`);
          }
        }
      }
    }
  }

  const result = {
    ok: !hasErrors,
    path: resolvedPath,
    profile,
    flowCount: flows.length,
    schemaFailures,
    orphans,
    graphChecks: {
      initial_states: initialStates,
      terminal_states: terminalStates,
      unreachable_states: reachability.unreachable_states,
      cycle,
    },
    qualityChecks: {
      multiple_initial_states: multipleInitialStates,
      duplicate_transitions: duplicateTransitions,
      non_terminating_states: terminalCoverage.non_terminating_states,
      warnings: qualityWarnings,
    },
  };

  if (output === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("");
    if (hasErrors) {
      console.error("Validation finished with errors.");
    } else {
      console.log("All validations passed ✔");
    }
  }

  return result;
}

// Allow the module to be required by tests without side-effects.
if (require.main === module) {
  const result = run(process.argv[2]);
  process.exit(result.ok ? 0 : 1);
}

module.exports = {
  loadApi,
  extractFlows,
  validateFlows,
  detectOrphanStates,
  buildStateGraph,
  run,
};
