"use strict";

const { createRuntimeFlowGuard, toErrorPayload } = require("./core");

function resolveNestOperationId(context) {
  const req = context && context.req;

  if (req && req.openapi && req.openapi.operationId) {
    return req.openapi.operationId;
  }

  if (req && req.operation && req.operation.operationId) {
    return req.operation.operationId;
  }

  return null;
}

function defaultNestPath(req) {
  if (!req) {
    return "/";
  }

  if (req.route && typeof req.route.path === "string") {
    return req.route.path;
  }

  if (typeof req.path === "string") {
    return req.path;
  }

  if (typeof req.originalUrl === "string") {
    return req.originalUrl.split("?")[0];
  }

  if (typeof req.url === "string") {
    return req.url.split("?")[0];
  }

  return "/";
}

function createNestFlowMiddleware(options = {}) {
  const guard = createRuntimeFlowGuard({
    ...options,
    resolveOperationId: options.resolveOperationId || resolveNestOperationId,
  });

  return async function xOpenApiFlowNestMiddleware(req, res, next) {
    try {
      await guard.enforce({
        req,
        res,
        method: req && req.method,
        path: defaultNestPath(req),
        params: (req && req.params) || {},
      });
      return next();
    } catch (error) {
      const payload = {
        error: toErrorPayload(error),
      };

      const statusCode = (error && error.statusCode) || 500;
      if (res && typeof res.status === "function" && typeof res.json === "function") {
        return res.status(statusCode).json(payload);
      }

      return next(error);
    }
  };
}

function createNestFlowCanActivate(options = {}) {
  const guard = createRuntimeFlowGuard({
    ...options,
    resolveOperationId: options.resolveOperationId || resolveNestOperationId,
  });

  return async function xOpenApiFlowNestCanActivate(executionContext) {
    const http = executionContext
      && typeof executionContext.switchToHttp === "function"
      ? executionContext.switchToHttp()
      : null;

    const req = http && typeof http.getRequest === "function"
      ? http.getRequest()
      : null;

    const res = http && typeof http.getResponse === "function"
      ? http.getResponse()
      : null;

    try {
      await guard.enforce({
        req,
        res,
        executionContext,
        method: req && req.method,
        path: defaultNestPath(req),
        params: (req && req.params) || {},
      });
      return true;
    } catch (error) {
      const payload = {
        error: toErrorPayload(error),
      };

      const statusCode = (error && error.statusCode) || 500;
      if (res && typeof res.status === "function" && typeof res.json === "function") {
        res.status(statusCode).json(payload);
        return false;
      }

      throw error;
    }
  };
}

module.exports = {
  createNestFlowMiddleware,
  createNestFlowCanActivate,
};
