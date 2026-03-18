"use strict";

const { createRuntimeFlowGuard, toErrorPayload } = require("./core");

function resolveFastifyOperationId(request) {
  const routeConfig = request
    && request.routeOptions
    && request.routeOptions.config;

  if (routeConfig && typeof routeConfig.operationId === "string") {
    return routeConfig.operationId;
  }

  return null;
}

function defaultFastifyPath(request) {
  if (!request) {
    return "/";
  }

  if (request.routeOptions && request.routeOptions.url) {
    return request.routeOptions.url;
  }

  if (typeof request.routerPath === "string") {
    return request.routerPath;
  }

  if (typeof request.url === "string") {
    return request.url.split("?")[0];
  }

  return "/";
}

function createFastifyFlowGuard(options = {}) {
  const guard = createRuntimeFlowGuard({
    ...options,
    resolveOperationId: options.resolveOperationId || ((context) => resolveFastifyOperationId(context.req)),
  });

  return async function xOpenApiFlowFastifyGuard(request, reply) {
    try {
      await guard.enforce({
        req: request,
        reply,
        method: request && request.method,
        path: defaultFastifyPath(request),
        params: (request && request.params) || {},
      });
    } catch (error) {
      const statusCode = (error && error.statusCode) || 500;
      return reply.code(statusCode).send({
        error: toErrorPayload(error),
      });
    }

    return undefined;
  };
}

module.exports = {
  createFastifyFlowGuard,
};
