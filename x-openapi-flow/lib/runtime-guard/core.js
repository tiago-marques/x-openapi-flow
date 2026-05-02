"use strict";

const {
  FlowGuardError,
  invalidTransitionError,
  unknownOperationError,
  missingStateResolverError,
  missingResourceIdError,
} = require("./errors");
const { loadRuntimeModel, normalizePathTemplate, routeKey } = require("./model");

function defaultResolveResourceId(context) {
  const params = context && context.params;
  if (!params || typeof params !== "object") {
    return null;
  }

  if (params.id != null) {
    return String(params.id);
  }

  if (params.resourceId != null) {
    return String(params.resourceId);
  }

  return null;
}

function safeEmitDecision(hook, payload) {
  if (typeof hook !== "function") {
    return;
  }

  try {
    hook(payload);
  } catch (_err) {
    // Observability hook must never break request handling.
  }
}

class RuntimeFlowGuard {
  constructor(options = {}) {
    const runtimeModel = loadRuntimeModel(options);

    this.operations = runtimeModel.operations;
    this.byOperationId = runtimeModel.byOperationId;
    this.byRouteKey = runtimeModel.byRouteKey;
    this.stateMachine = runtimeModel.stateMachine;

    this.getCurrentState = options.getCurrentState;
    this.resolveResourceId = options.resolveResourceId || defaultResolveResourceId;
    this.resolveOperationId = options.resolveOperationId || null;
    this.onDecision = typeof options.onDecision === "function" ? options.onDecision : null;

    this.allowUnknownOperations = options.allowUnknownOperations === true;
    this.allowIdempotentState = options.allowIdempotentState !== false;
    this.allowMissingStateForInitial = options.allowMissingStateForInitial !== false;
    this.requireResourceIdForTransitions = options.requireResourceIdForTransitions !== false;
  }

  resolveOperation({ operationId, method, path }) {
    if (operationId && this.byOperationId.has(operationId)) {
      return this.byOperationId.get(operationId);
    }

    const normalizedPath = normalizePathTemplate(path || "/");
    const byKey = this.byRouteKey.get(routeKey(method, normalizedPath));
    if (byKey) {
      return byKey;
    }

    const methodUpper = String(method || "").toUpperCase();
    for (const operation of this.operations) {
      if (operation.method !== methodUpper) {
        continue;
      }

      if (operation.routeRegex.test(normalizedPath)) {
        return operation;
      }
    }

    return null;
  }

  async enforce(context = {}) {
    const startedAt = Date.now();
    const emitDecision = (decision) => {
      safeEmitDecision(this.onDecision, {
        method: context.method,
        path: context.path,
        durationMs: Date.now() - startedAt,
        ...decision,
      });
    };

    if (typeof this.getCurrentState !== "function") {
      emitDecision({
        decision: "denied_missing_state_resolver",
      });
      throw missingStateResolverError();
    }

    const operationFromResolver = this.resolveOperationId
      ? await this.resolveOperationId(context)
      : null;

    const operation = this.resolveOperation({
      operationId: context.operationId || operationFromResolver,
      method: context.method,
      path: context.path,
    });

    if (!operation) {
      if (this.allowUnknownOperations) {
        emitDecision({
          decision: "skipped_unknown_operation",
          operationId: context.operationId || operationFromResolver || null,
        });
        return { ok: true, skipped: true, reason: "unknown_operation" };
      }

      emitDecision({
        decision: "denied_unknown_operation",
        operationId: context.operationId || operationFromResolver || null,
      });

      throw unknownOperationError({
        operationId: context.operationId || operationFromResolver,
        method: context.method,
        path: context.path,
      });
    }

    const resourceId = this.resolveResourceId(context);
    if (!resourceId && operation.incomingFromStates.size > 0 && this.requireResourceIdForTransitions) {
      emitDecision({
        decision: "denied_missing_resource_id",
        operationId: operation.operationId,
      });
      throw missingResourceIdError({
        operationId: operation.operationId,
        method: context.method,
        path: context.path,
      });
    }

    const currentState = await this.getCurrentState({
      operation,
      operationId: operation.operationId,
      resourceId,
      context,
    });

    if (currentState == null) {
      if (operation.incomingFromStates.size === 0 && this.allowMissingStateForInitial) {
        emitDecision({
          decision: "allowed_initial_state",
          operationId: operation.operationId,
          resourceId,
          currentState: null,
          nextState: operation.currentState || null,
        });
        return {
          ok: true,
          operationId: operation.operationId,
          resourceId,
          currentState: null,
        };
      }

      emitDecision({
        decision: "denied_missing_current_state",
        operationId: operation.operationId,
        resourceId,
        currentState: null,
      });

      throw invalidTransitionError({
        operationId: operation.operationId,
        currentState: null,
        allowedFromStates: operation.incomingFromStates,
        resourceId,
      });
    }

    const normalizedState = String(currentState);
    const isAllowedFrom = this.stateMachine.canTransition(normalizedState, operation.operationId);
    const isSameState = this.allowIdempotentState && normalizedState === String(operation.currentState);
    const nextState = this.stateMachine.getNextState(normalizedState, operation.operationId);

    if (!isAllowedFrom && !isSameState) {
      emitDecision({
        decision: "denied_invalid_transition",
        operationId: operation.operationId,
        resourceId,
        currentState: normalizedState,
      });
      throw invalidTransitionError({
        operationId: operation.operationId,
        currentState: normalizedState,
        allowedFromStates: operation.incomingFromStates,
        resourceId,
      });
    }

    emitDecision({
      decision: isAllowedFrom ? "allowed_transition" : "allowed_idempotent_state",
      operationId: operation.operationId,
      resourceId,
      currentState: normalizedState,
      nextState,
    });

    return {
      ok: true,
      operationId: operation.operationId,
      resourceId,
      currentState: normalizedState,
      nextState,
    };
  }
}

function createRuntimeFlowGuard(options) {
  return new RuntimeFlowGuard(options);
}

function toErrorPayload(error) {
  if (error instanceof FlowGuardError) {
    return error.toJSON();
  }

  return {
    code: "INTERNAL_RUNTIME_GUARD_ERROR",
    message: error && error.message ? error.message : "Unknown runtime guard error.",
  };
}

module.exports = {
  RuntimeFlowGuard,
  createRuntimeFlowGuard,
  toErrorPayload,
};
