"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  createExpressFlowGuard,
  createFastifyFlowGuard,
} = require("../../lib/runtime-guard");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const EXPRESS_FLOW_PATH = path.join(REPO_ROOT, "example", "runtime-guard", "express", "openapi.flow.json");
const FASTIFY_FLOW_PATH = path.join(REPO_ROOT, "example", "runtime-guard", "fastify", "openapi.flow.json");

function readOpenApi(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

test("runtime guard express example blocks invalid transition with 409", async () => {
  const openapi = readOpenApi(EXPRESS_FLOW_PATH);
  const paymentStore = new Map();
  paymentStore.set("pay_123", { id: "pay_123", state: "CREATED" });

  const middleware = createExpressFlowGuard({
    openapi,
    getCurrentState: async ({ resourceId }) => {
      const item = paymentStore.get(resourceId);
      return item ? item.state : null;
    },
    resolveResourceId: ({ params }) => params.id || null,
  });

  const req = {
    method: "POST",
    path: "/payments/pay_123/capture",
    params: { id: "pay_123" },
  };

  let statusCode = null;
  let responseBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return body;
    },
  };

  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(statusCode, 409);
  assert.equal(responseBody.error.code, "INVALID_STATE_TRANSITION");
  assert.equal(responseBody.error.operation_id, "capturePayment");
  assert.deepEqual(responseBody.error.allowed_from_states, ["AUTHORIZED"]);
});

test("runtime guard fastify example blocks invalid transition with 409", async () => {
  const openapi = readOpenApi(FASTIFY_FLOW_PATH);
  const paymentStore = new Map();
  paymentStore.set("pay_123", { id: "pay_123", state: "CREATED" });

  const hook = createFastifyFlowGuard({
    openapi,
    getCurrentState: async ({ resourceId }) => {
      const item = paymentStore.get(resourceId);
      return item ? item.state : null;
    },
    resolveResourceId: ({ params }) => params.id || null,
  });

  const request = {
    method: "POST",
    routeOptions: {
      url: "/payments/:id/capture",
      config: {
        operationId: "capturePayment",
      },
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

  await hook(request, reply);

  assert.equal(statusCode, 409);
  assert.equal(payload.error.code, "INVALID_STATE_TRANSITION");
  assert.equal(payload.error.operation_id, "capturePayment");
  assert.deepEqual(payload.error.allowed_from_states, ["AUTHORIZED"]);
});
