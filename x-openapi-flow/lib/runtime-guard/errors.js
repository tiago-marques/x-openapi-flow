"use strict";

class FlowGuardError extends Error {
  constructor(message, details = {}, statusCode = 409) {
    super(message);
    this.name = "FlowGuardError";
    this.code = details.code || "FLOW_GUARD_ERROR";
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...this.details,
    };
  }
}

function invalidTransitionError({
  operationId,
  currentState,
  allowedFromStates,
  resourceId,
}) {
  const allowed = [...allowedFromStates].sort();
  const current = currentState == null ? null : String(currentState);

  return new FlowGuardError(
    `Blocked invalid transition for operation '${operationId}'. Current state '${current}' cannot transition to this operation.`,
    {
      code: "INVALID_STATE_TRANSITION",
      operation_id: operationId,
      current_state: current,
      allowed_from_states: allowed,
      resource_id: resourceId || null,
    },
    409
  );
}

function unknownOperationError({ operationId, method, path }) {
  return new FlowGuardError(
    `Runtime guard could not resolve operation for '${method} ${path}'.`,
    {
      code: "UNKNOWN_OPERATION",
      operation_id: operationId || null,
      method: method || null,
      path: path || null,
    },
    500
  );
}

function missingStateResolverError() {
  return new FlowGuardError(
    "Runtime guard requires 'getCurrentState' callback to enforce transitions.",
    {
      code: "MISSING_STATE_RESOLVER",
    },
    500
  );
}

function missingResourceIdError({ operationId, method, path }) {
  return new FlowGuardError(
    `Runtime guard requires a resource id to enforce operation '${operationId}'.`,
    {
      code: "MISSING_RESOURCE_ID",
      operation_id: operationId || null,
      method: method || null,
      path: path || null,
    },
    400
  );
}

module.exports = {
  FlowGuardError,
  invalidTransitionError,
  unknownOperationError,
  missingStateResolverError,
  missingResourceIdError,
};
