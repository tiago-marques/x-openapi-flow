"use strict";

const fs = require("fs");
const path = require("path");
const { loadApi } = require("../../lib/validator");
const { createStateMachineAdapterModel } = require("../../lib/openapi-state-machine-adapter");
const { createStateMachineEngine } = require("../../lib/state-machine-engine");
const { generatePostmanCollection } = require("../collections/postman-adapter");

function getFormat(options) {
  const format = String(options.format || "jest").toLowerCase();
  if (!["jest", "vitest", "postman"].includes(format)) {
    throw new Error(`Unsupported test format '${format}'. Use 'jest', 'vitest', or 'postman'.`);
  }
  return format;
}

function getDefaultOutputPath(format) {
  if (format === "postman") {
    return path.resolve(process.cwd(), "x-openapi-flow.flow-tests.postman_collection.json");
  }

  if (format === "vitest") {
    return path.resolve(process.cwd(), "x-openapi-flow.flow.generated.vitest.test.js");
  }

  return path.resolve(process.cwd(), "x-openapi-flow.flow.generated.jest.test.js");
}

function buildHappyPaths(engine) {
  const transitions = engine.getTransitions();
  const outgoing = new Map();
  const indegree = new Map();
  const states = engine.getStates();

  for (const state of states) {
    outgoing.set(state, []);
    indegree.set(state, 0);
  }

  for (const transition of transitions) {
    if (!outgoing.has(transition.from)) {
      outgoing.set(transition.from, []);
    }
    outgoing.get(transition.from).push(transition);
    indegree.set(transition.to, (indegree.get(transition.to) || 0) + 1);
  }

  for (const transitionList of outgoing.values()) {
    transitionList.sort((left, right) => left.action.localeCompare(right.action));
  }

  const starts = states.filter((state) => (indegree.get(state) || 0) === 0);
  const roots = starts.length > 0 ? starts : states;
  const maxDepth = Math.max(3, states.length + 2);
  const maxPaths = 50;
  const paths = [];

  function walk(currentState, actions, visitedKeys, depth) {
    if (paths.length >= maxPaths) {
      return;
    }

    const nextTransitions = outgoing.get(currentState) || [];
    if (nextTransitions.length === 0 || depth >= maxDepth) {
      if (actions.length > 0) {
        paths.push({
          startState: actions[0].from,
          actions: actions.map((entry) => entry.action),
          finalState: currentState,
        });
      }
      return;
    }

    for (const transition of nextTransitions) {
      const visitKey = `${transition.from}::${transition.action}::${transition.to}`;
      if (visitedKeys.has(visitKey)) {
        continue;
      }

      const nextVisited = new Set(visitedKeys);
      nextVisited.add(visitKey);

      walk(
        transition.to,
        actions.concat([{ from: transition.from, action: transition.action }]),
        nextVisited,
        depth + 1
      );
    }
  }

  for (const root of roots) {
    walk(root, [], new Set(), 0);
  }

  const dedup = new Map();
  for (const entry of paths) {
    const key = `${entry.startState}::${entry.actions.join(",")}`;
    if (!dedup.has(key)) {
      dedup.set(key, entry);
    }
  }

  return [...dedup.values()];
}

function buildInvalidCases(engine) {
  const transitions = engine.getTransitions();
  const states = engine.getStates();
  const knownActions = [...new Set(transitions.map((transition) => transition.action))].sort();
  const cases = [];

  for (const state of states) {
    const available = engine.getAvailableActions(state);
    const disallowedAction = knownActions.find((action) => !available.includes(action));

    if (disallowedAction) {
      cases.push({
        state,
        action: disallowedAction,
        availableActions: available,
      });
      continue;
    }

    cases.push({
      state,
      action: "__invalid_action__",
      availableActions: available,
    });
  }

  return cases;
}

function buildJestOrVitestContent({ format, sourcePath, definition, happyPaths, invalidCases }) {
  const frameworkPrelude = format === "vitest"
    ? "const { describe, test, expect } = require(\"vitest\");\n"
    : "";

  const title = format === "vitest" ? "Vitest" : "Jest";

  return `"use strict";

${frameworkPrelude}const { createStateMachineEngine } = require("x-openapi-flow/lib/state-machine-engine");

const definition = ${JSON.stringify(definition, null, 2)};
const happyPaths = ${JSON.stringify(happyPaths, null, 2)};
const invalidCases = ${JSON.stringify(invalidCases, null, 2)};

describe("x-openapi-flow generated tests (${title})", () => {
  const engine = createStateMachineEngine(definition);

  test("has transitions in definition", () => {
    expect(Array.isArray(definition.transitions)).toBe(true);
    expect(definition.transitions.length).toBeGreaterThan(0);
  });

  describe("happy paths", () => {
    for (const pathCase of happyPaths) {
      test(
        \`valid flow: \${pathCase.startState} -> \${pathCase.actions.join(" -> ")}\`,
        () => {
          const result = engine.validateFlow({
            startState: pathCase.startState,
            actions: pathCase.actions,
          });

          expect(result.ok).toBe(true);
          expect(result.finalState).toBe(pathCase.finalState);
        }
      );
    }
  });

  describe("invalid transitions", () => {
    for (const invalidCase of invalidCases) {
      test(
        \`blocks invalid action \${invalidCase.action} from state \${invalidCase.state}\`,
        () => {
          expect(engine.canTransition(invalidCase.state, invalidCase.action)).toBe(false);

          const result = engine.validateFlow({
            startState: invalidCase.state,
            actions: [invalidCase.action],
          });

          expect(result.ok).toBe(false);
          expect(result.error.code).toBe("INVALID_TRANSITION");
          expect(Array.isArray(result.error.availableActions)).toBe(true);
        }
      );
    }
  });
});

// Generated from: ${sourcePath}
`;
}

function generateFlowTests(options) {
  const format = getFormat(options || {});
  const apiPath = path.resolve(options.apiPath);
  const outputPath = path.resolve(options.outputPath || getDefaultOutputPath(format));

  if (format === "postman") {
    const postman = generatePostmanCollection({
      apiPath,
      outputPath,
      withScripts: options.withScripts !== false,
    });

    return {
      format,
      outputPath: postman.outputPath,
      flowCount: postman.flowCount,
      happyPathTests: null,
      invalidCaseTests: null,
      withScripts: postman.withScripts,
    };
  }

  const api = loadApi(apiPath);
  const model = createStateMachineAdapterModel({ openapi: api });
  const engine = createStateMachineEngine(model.definition);

  const happyPaths = buildHappyPaths(engine);
  const invalidCases = buildInvalidCases(engine);
  const content = buildJestOrVitestContent({
    format,
    sourcePath: apiPath,
    definition: model.definition,
    happyPaths,
    invalidCases,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, "utf8");

  return {
    format,
    outputPath,
    flowCount: model.definition.transitions.length,
    happyPathTests: happyPaths.length,
    invalidCaseTests: invalidCases.length,
    withScripts: null,
  };
}

module.exports = {
  generateFlowTests,
};
