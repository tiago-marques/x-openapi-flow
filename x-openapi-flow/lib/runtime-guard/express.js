"use strict";

const { createRuntimeFlowGuard, toErrorPayload } = require("./core");

function resolveExpressOperationId(req) {
  if (req && req.openapi && req.openapi.operationId) {
    return req.openapi.operationId;
  }

  if (req && req.operation && req.operation.operationId) {
    return req.operation.operationId;
  }

  return null;
}

function defaultExpressPath(req) {
  if (!req) {
    return "/";
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

function createExpressFlowGuard(options = {}) {
  const guard = createRuntimeFlowGuard({
    ...options,
    resolveOperationId: options.resolveOperationId || ((context) => resolveExpressOperationId(context.req)),
  });

  return async function xOpenApiFlowExpressGuard(req, res, next) {
    try {
      await guard.enforce({
        req,
        res,
        method: req && req.method,
        path: defaultExpressPath(req),
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

module.exports = {
  createExpressFlowGuard,
};
