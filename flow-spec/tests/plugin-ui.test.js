"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const PLUGIN_PATH = path.resolve(__dirname, "..", "lib", "swagger-ui", "x-openapi-flow-plugin.js");

function loadUiInternals() {
  const source = fs.readFileSync(PLUGIN_PATH, "utf8");

  const windowMock = {
    addEventListener: () => {},
    requestAnimationFrame: (callback) => callback(),
    setTimeout,
    clearTimeout,
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
  };

  const documentMock = {
    head: { appendChild: () => {} },
    body: {},
    getElementById: () => null,
    createElement: () => ({
      style: {},
      set id(_value) {},
      set className(_value) {},
      appendChild: () => {},
    }),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  };

  const context = {
    window: windowMock,
    document: documentMock,
    MutationObserver: function MutationObserver() {
      this.observe = () => {};
    },
    React: { createElement: () => ({}) },
    console,
    setTimeout,
    clearTimeout,
  };

  vm.runInNewContext(source, context, { filename: "x-openapi-flow-plugin.js" });
  return context.window.XOpenApiFlowUiInternals;
}

test("plugin internals detect no-op when spec has no x-openapi-flow", () => {
  const internals = loadUiInternals();
  const spec = {
    openapi: "3.0.3",
    paths: {
      "/health": {
        get: {
          operationId: "healthCheck",
          responses: { "200": { description: "ok" } },
        },
      },
    },
  };

  assert.equal(internals.hasFlowData(spec), false);
  assert.equal(internals.extractFlowsFromSpec(spec).length, 0);
});

test("plugin internals extract flow and build overview graph", () => {
  const internals = loadUiInternals();
  const spec = {
    openapi: "3.0.3",
    paths: {
      "/orders": {
        post: {
          operationId: "createOrder",
          "x-openapi-flow": {
            version: "1.0",
            id: "create-order",
            current_state: "CREATED",
            transitions: [
              {
                trigger_type: "synchronous",
                target_state: "CONFIRMED",
                next_operation_id: "confirmOrder",
              },
            ],
          },
        },
      },
    },
  };

  const flows = internals.extractFlowsFromSpec(spec);
  assert.equal(flows.length, 1);
  assert.equal(flows[0].operationId, "createOrder");

  const mermaid = internals.buildOverviewMermaid(flows);
  assert.match(mermaid, /stateDiagram-v2/);
  assert.match(mermaid, /state "CREATED" as s_created_\d+/);
  assert.match(mermaid, /state "CONFIRMED" as s_confirmed_\d+/);
  assert.match(mermaid, /s_created_\d+ --> s_confirmed_\d+: next confirmOrder/);
});

test("plugin internals provide actionable Mermaid fallback message", () => {
  const internals = loadUiInternals();
  const message = internals.getMermaidFallbackMessage();

  assert.match(message, /Could not render Mermaid image/);
  assert.match(message, /CDN\/network access/);
});

test("plugin internals build overview title from API info.title", () => {
  const internals = loadUiInternals();
  const title = internals.getOverviewTitleFromSpec({
    info: { title: "Kickstart Swagger API" },
  });

  assert.equal(title, "Kickstart Swagger API — Flow Overview (x-openapi-flow)");
});

test("plugin internals support pre_operation_id compatibility in overview graph", () => {
  const internals = loadUiInternals();
  const flows = [
    {
      operationId: "shipOrder",
      flow: {
        current_state: "PACKED",
        transitions: [
          {
            trigger_type: "async",
            target_state: "SHIPPED",
            pre_operation_id: "authorizePayment",
          },
        ],
      },
    },
  ];

  const mermaid = internals.buildOverviewMermaid(flows);
  assert.match(mermaid, /state "PACKED" as s_packed_\d+/);
  assert.match(mermaid, /state "SHIPPED" as s_shipped_\d+/);
  assert.match(mermaid, /s_packed_\d+ --> s_shipped_\d+: requires authorizePayment/);
});

test("plugin internals detect when overview has no transitions", () => {
  const internals = loadUiInternals();
  const flows = [
    {
      operationId: "createOrder",
      flow: {
        current_state: "CREATED",
        transitions: [],
      },
    },
  ];

  assert.equal(internals.hasOverviewTransitionData(flows), false);
});
