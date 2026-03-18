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
    if (typeof this.getCurrentState !== "function") {
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
        return { ok: true, skipped: true, reason: "unknown_operation" };
      }

      throw unknownOperationError({
        operationId: context.operationId || operationFromResolver,
        method: context.method,
        path: context.path,
      });
    }

    const resourceId = this.resolveResourceId(context);
    if (!resourceId && operation.incomingFromStates.size > 0 && this.requireResourceIdForTransitions) {
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
        return {
          ok: true,
          operationId: operation.operationId,
          resourceId,
          currentState: null,
        };
      }

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

    if (!isAllowedFrom && !isSameState) {
      throw invalidTransitionError({
        operationId: operation.operationId,
        currentState: normalizedState,
        allowedFromStates: operation.incomingFromStates,
        resourceId,
      });
    }

    return {
      ok: true,
      operationId: operation.operationId,
      resourceId,
      currentState: normalizedState,
      nextState: this.stateMachine.getNextState(normalizedState, operation.operationId),
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
