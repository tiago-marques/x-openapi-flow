"use strict";

const { createRuntimeFlowGuard, toErrorPayload } = require("./core");

function resolveHonoOperationId(c) {
  if (c && typeof c.get === "function") {
    const operationId = c.get("operationId");
    if (typeof operationId === "string" && operationId) {
      return operationId;
    }
  }

  return null;
}

function defaultHonoPath(c) {
  if (!c || !c.req) {
    return "/";
  }

  if (typeof c.req.routePath === "string") {
    return c.req.routePath;
  }

  if (typeof c.req.path === "string") {
    return c.req.path;
  }

  return "/";
}

function defaultHonoParams(c) {
  if (!c || !c.req || typeof c.req.param !== "function") {
    return {};
  }

  try {
    return c.req.param() || {};
  } catch (_err) {
    return {};
  }
}

function createHonoFlowGuard(options = {}) {
  const guard = createRuntimeFlowGuard({
    ...options,
    resolveOperationId: options.resolveOperationId || ((context) => resolveHonoOperationId(context.req)),
  });

  return async function xOpenApiFlowHonoGuard(c, next) {
    try {
      await guard.enforce({
        req: c,
        method: c && c.req && c.req.method,
        path: defaultHonoPath(c),
        params: defaultHonoParams(c),
      });
    } catch (error) {
      const statusCode = (error && error.statusCode) || 500;
      return c.json(
        {
          error: toErrorPayload(error),
        },
        statusCode
      );
    }

    await next();
    return undefined;
  };
}

module.exports = {
  createHonoFlowGuard,
};
