"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createRuntimeFlowGuard,
  createExpressFlowGuard,
  createFastifyFlowGuard,
  createNestFlowMiddleware,
  createNestFlowCanActivate,
} = require("../../lib/runtime-guard");

const OPENAPI = {
  openapi: "3.0.3",
  info: {
    title: "Payments API",
    version: "1.0.0",
  },
  paths: {
    "/payments": {
      post: {
        operationId: "createPayment",
        responses: {
          201: { description: "Created" },
        },
        "x-openapi-flow": {
          version: "1.0",
          id: "create-payment-flow",
          current_state: "AUTHORIZED",
          transitions: [
            {
              trigger_type: "synchronous",
              target_state: "CAPTURED",
              next_operation_id: "capturePayment",
            },
          ],
        },
      },
    },
    "/payments/{id}/capture": {
      post: {
        operationId: "capturePayment",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Captured" },
        },
        "x-openapi-flow": {
          version: "1.0",
          id: "capture-payment-flow",
          current_state: "CAPTURED",
          transitions: [],
        },
      },
    },
  },
};

function buildStateResolver(map) {
  return async ({ resourceId }) => {
    if (!resourceId) {
      return null;
    }
    return map[resourceId] || null;
  };
}

test("runtime guard allows initial operation when resource state does not exist", async () => {
  const guard = createRuntimeFlowGuard({
    openapi: OPENAPI,
    getCurrentState: buildStateResolver({}),
  });

  const result = await guard.enforce({
    method: "POST",
    path: "/payments",
    params: {},
  });

  assert.equal(result.ok, true);
  assert.equal(result.operationId, "createPayment");
});

test("runtime guard allows valid transition based on current persisted state", async () => {
  const guard = createRuntimeFlowGuard({
    openapi: OPENAPI,
    getCurrentState: buildStateResolver({ pay_123: "AUTHORIZED" }),
  });

  const result = await guard.enforce({
    method: "POST",
    path: "/payments/pay_123/capture",
    params: { id: "pay_123" },
  });

  assert.equal(result.ok, true);
  assert.equal(result.operationId, "capturePayment");
});

test("runtime guard blocks invalid transition with explicit details", async () => {
  const guard = createRuntimeFlowGuard({
    openapi: OPENAPI,
    getCurrentState: buildStateResolver({ pay_123: "CREATED" }),
  });

  await assert.rejects(
    () =>
      guard.enforce({
        method: "POST",
        path: "/payments/pay_123/capture",
        params: { id: "pay_123" },
      }),
    (error) => {
      assert.equal(error.code, "INVALID_STATE_TRANSITION");
      assert.equal(error.statusCode, 409);
      assert.equal(error.details.operation_id, "capturePayment");
      assert.deepEqual(error.details.allowed_from_states, ["AUTHORIZED"]);
      return true;
    }
  );
});

test("express guard returns 409 payload when transition is invalid", async () => {
  const middleware = createExpressFlowGuard({
    openapi: OPENAPI,
    getCurrentState: buildStateResolver({ pay_123: "CREATED" }),
  });

  const req = {
    method: "POST",
    path: "/payments/pay_123/capture",
    params: { id: "pay_123" },
  };

  let responseStatus = null;
  let responseBody = null;
  const res = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return body;
    },
  };

  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  await middleware(req, res, next);

  assert.equal(nextCalled, false);
  assert.equal(responseStatus, 409);
  assert.equal(responseBody.error.code, "INVALID_STATE_TRANSITION");
  assert.equal(responseBody.error.operation_id, "capturePayment");
});

test("fastify guard returns 409 payload when transition is invalid", async () => {
  const guard = createFastifyFlowGuard({
    openapi: OPENAPI,
    getCurrentState: buildStateResolver({ pay_123: "CREATED" }),
  });

  const request = {
    method: "POST",
    routeOptions: {
      url: "/payments/:id/capture",
    },
    params: {
      id: "pay_123",
    },
  };

  let statusCode = null;
  let payload = null;
  const reply = {
    code(code) {
      statusCode = code;
      return this;
    },
    send(body) {
      payload = body;
      return body;
    },
  };

  await guard(request, reply);

  assert.equal(statusCode, 409);
  assert.equal(payload.error.code, "INVALID_STATE_TRANSITION");
  assert.equal(payload.error.allowed_from_states.includes("AUTHORIZED"), true);
});

test("nestjs middleware returns 409 payload when transition is invalid", async () => {
  const middleware = createNestFlowMiddleware({
    openapi: OPENAPI,
    getCurrentState: buildStateResolver({ pay_123: "CREATED" }),
  });

  const req = {
    method: "POST",
    route: {
      path: "/payments/:id/capture",
    },
    params: { id: "pay_123" },
  };

  let responseStatus = null;
  let responseBody = null;
  const res = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return body;
    },
  };

  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  await middleware(req, res, next);

  assert.equal(nextCalled, false);
  assert.equal(responseStatus, 409);
  assert.equal(responseBody.error.code, "INVALID_STATE_TRANSITION");
});

test("nestjs canActivate returns true for valid transition", async () => {
  const canActivate = createNestFlowCanActivate({
    openapi: OPENAPI,
    getCurrentState: buildStateResolver({ pay_123: "AUTHORIZED" }),
  });

  const req = {
    method: "POST",
    route: {
      path: "/payments/:id/capture",
    },
    params: { id: "pay_123" },
  };

  const res = {
    status() {
      return this;
    },
    json() {
      return this;
    },
  };

  const executionContext = {
    switchToHttp() {
      return {
        getRequest() {
          return req;
        },
        getResponse() {
          return res;
        },
      };
    },
  };

  const allowed = await canActivate(executionContext);
  assert.equal(allowed, true);
});

test("nestjs canActivate writes 409 payload and returns false for invalid transition", async () => {
  const canActivate = createNestFlowCanActivate({
    openapi: OPENAPI,
    getCurrentState: buildStateResolver({ pay_123: "CREATED" }),
  });

  const req = {
    method: "POST",
    route: {
      path: "/payments/:id/capture",
    },
    params: { id: "pay_123" },
  };

  let responseStatus = null;
  let responseBody = null;
  const res = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return body;
    },
  };

  const executionContext = {
    switchToHttp() {
      return {
        getRequest() {
          return req;
        },
        getResponse() {
          return res;
        },
      };
    },
  };

  const allowed = await canActivate(executionContext);
  assert.equal(allowed, false);
  assert.equal(responseStatus, 409);
  assert.equal(responseBody.error.code, "INVALID_STATE_TRANSITION");
});
