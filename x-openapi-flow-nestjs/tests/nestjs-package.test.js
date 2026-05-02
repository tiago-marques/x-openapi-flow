"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createFlowMiddleware,
  createFlowGuard,
} = require("../index");

const OPENAPI = {
  openapi: "3.0.3",
  info: { title: "Nest package test", version: "1.0.0" },
  paths: {
    "/orders": {
      post: {
        operationId: "createOrder",
        responses: { 201: { description: "ok" } },
        "x-openapi-flow": {
          version: "1.0",
          id: "create-order",
          current_state: "CREATED",
          transitions: [],
        },
      },
    },
  },
};

test("createFlowMiddleware exposes use function", async () => {
  const middleware = createFlowMiddleware({
    openapi: OPENAPI,
    getCurrentState: async () => null,
  });

  assert.equal(typeof middleware.use, "function");

  const req = { method: "POST", route: { path: "/orders" }, params: {} };
  const res = {
    status() { return this; },
    json() { return this; },
  };

  let called = false;
  await middleware.use(req, res, () => {
    called = true;
  });

  assert.equal(called, true);
});

test("createFlowGuard exposes canActivate function", async () => {
  const guard = createFlowGuard({
    openapi: OPENAPI,
    getCurrentState: async () => null,
  });

  const context = {
    switchToHttp() {
      return {
        getRequest() {
          return { method: "POST", route: { path: "/orders" }, params: {} };
        },
        getResponse() {
          return {
            status() { return this; },
            json() { return this; },
          };
        },
      };
    },
  };

  const allowed = await guard.canActivate(context);
  assert.equal(allowed, true);
});
