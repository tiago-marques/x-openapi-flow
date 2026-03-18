"use strict";

function normalizeState(value) {
  return value == null ? null : String(value);
}

function normalizeAction(value) {
  return value == null ? null : String(value);
}

function validateDefinition(definition) {
  const errors = [];

  if (!definition || typeof definition !== "object") {
    return {
      ok: false,
      errors: ["State machine definition must be an object."],
    };
  }

  if (!Array.isArray(definition.transitions)) {
    return {
      ok: false,
      errors: ["State machine definition requires a transitions array."],
    };
  }

  for (let index = 0; index < definition.transitions.length; index += 1) {
    const transition = definition.transitions[index];

    if (!transition || typeof transition !== "object") {
      errors.push(`Transition at index ${index} must be an object.`);
      continue;
    }

    const from = normalizeState(transition.from);
    const action = normalizeAction(transition.action);
    const to = normalizeState(transition.to);

    if (!from) {
      errors.push(`Transition at index ${index} has invalid 'from' state.`);
    }
    if (!action) {
      errors.push(`Transition at index ${index} has invalid 'action'.`);
    }
    if (!to) {
      errors.push(`Transition at index ${index} has invalid 'to' state.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

class StateMachineEngine {
  constructor(definition) {
    const validation = validateDefinition(definition);
    if (!validation.ok) {
      throw new Error(`Invalid state machine definition: ${validation.errors.join(" ")}`);
    }

    this._transitions = [];
    this._states = new Set();
    this._actionsByState = new Map();
    this._nextStateByStateAndAction = new Map();

    for (const transition of definition.transitions) {
      const from = normalizeState(transition.from);
      const action = normalizeAction(transition.action);
      const to = normalizeState(transition.to);

      const key = `${from}::${action}`;
      const existing = this._nextStateByStateAndAction.get(key);
      if (existing && existing !== to) {
        throw new Error(
          `Non-deterministic transition detected for state '${from}' and action '${action}': '${existing}' vs '${to}'.`
        );
      }

      if (!existing) {
        this._nextStateByStateAndAction.set(key, to);
        this._transitions.push({ from, action, to });
      }

      if (!this._actionsByState.has(from)) {
        this._actionsByState.set(from, new Set());
      }
      this._actionsByState.get(from).add(action);

      this._states.add(from);
      this._states.add(to);
    }

    this._transitions.sort((a, b) => {
      if (a.from !== b.from) return a.from.localeCompare(b.from);
      if (a.action !== b.action) return a.action.localeCompare(b.action);
      return a.to.localeCompare(b.to);
    });
  }

  canTransition(currentState, action) {
    const from = normalizeState(currentState);
    const op = normalizeAction(action);
    if (!from || !op) {
      return false;
    }

    return this._nextStateByStateAndAction.has(`${from}::${op}`);
  }

  getNextState(currentState, action) {
    const from = normalizeState(currentState);
    const op = normalizeAction(action);
    if (!from || !op) {
      return null;
    }

    return this._nextStateByStateAndAction.get(`${from}::${op}`) || null;
  }

  getAvailableActions(currentState) {
    const from = normalizeState(currentState);
    if (!from) {
      return [];
    }

    const actions = this._actionsByState.get(from);
    if (!actions) {
      return [];
    }

    return [...actions].sort((a, b) => a.localeCompare(b));
  }

  validateFlow(options = {}) {
    const actions = Array.isArray(options.actions) ? options.actions : [];
    const startState = normalizeState(options.startState);

    if (!startState) {
      return {
        ok: false,
        error: {
          code: "INVALID_START_STATE",
          message: "startState is required.",
          index: -1,
        },
      };
    }

    let currentState = startState;

    for (let index = 0; index < actions.length; index += 1) {
      const action = normalizeAction(actions[index]);
      if (!action) {
        return {
          ok: false,
          error: {
            code: "INVALID_ACTION",
            message: `Action at index ${index} is invalid.`,
            index,
            state: currentState,
          },
        };
      }

      if (!this.canTransition(currentState, action)) {
        return {
          ok: false,
          error: {
            code: "INVALID_TRANSITION",
            message: `Cannot apply action '${action}' from state '${currentState}'.`,
            index,
            state: currentState,
            action,
            availableActions: this.getAvailableActions(currentState),
          },
        };
      }

      currentState = this.getNextState(currentState, action);
    }

    return {
      ok: true,
      finalState: currentState,
    };
  }

  getTransitions() {
    return this._transitions.map((transition) => ({ ...transition }));
  }

  getStates() {
    return [...this._states].sort((a, b) => a.localeCompare(b));
  }
}

function createStateMachineEngine(definition) {
  return new StateMachineEngine(definition);
}

module.exports = {
  StateMachineEngine,
  createStateMachineEngine,
  validateDefinition,
};
