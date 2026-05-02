"use strict";

function loadRuntimeGuard() {
  try {
    return require("x-openapi-flow/lib/runtime-guard");
  } catch (_err) {
    return require("../x-openapi-flow/lib/runtime-guard");
  }
}

const {
  createNestFlowMiddleware,
  createNestFlowCanActivate,
  MemoryAdapter,
  FileAdapter,
  RedisAdapter,
  GenericSQLAdapter,
} = loadRuntimeGuard();

function createFlowMiddleware(options = {}) {
  const middleware = createNestFlowMiddleware(options);

  return {
    use(req, res, next) {
      return middleware(req, res, next);
    },
  };
}

function createFlowGuard(options = {}) {
  const canActivate = createNestFlowCanActivate(options);

  return {
    canActivate(executionContext) {
      return canActivate(executionContext);
    },
  };
}

module.exports = {
  createFlowMiddleware,
  createFlowGuard,
  createNestFlowMiddleware,
  createNestFlowCanActivate,
  MemoryAdapter,
  FileAdapter,
  RedisAdapter,
  GenericSQLAdapter,
};
