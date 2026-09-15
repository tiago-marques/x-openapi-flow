"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const PLUGIN_PATH = path.resolve(__dirname, "..", "..", "adapters", "ui", "redoc", "x-openapi-flow-redoc-plugin.js");

function loadRedocInternals() {
  const source = fs.readFileSync(PLUGIN_PATH, "utf8");

  const windowMock = {
    addEventListener: () => {},
    requestAnimationFrame: (callback) => callback(),
    setTimeout,
    clearTimeout,
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    location: { hash: "" },
  };

  const documentMock = {
    head: { appendChild: () => {} },
    body: { appendChild: () => {} },
    getElementById: () => null,
    createElement: () => ({
      style: {},
      appendChild: () => {},
      setAttribute: () => {},
      addEventListener: () => {},
    }),
    querySelector: () => null,
    querySelectorAll: () => [],
  };

  const context = {
    window: windowMock,
    document: documentMock,
    console,
    setTimeout,
    clearTimeout,
    unescape,
    encodeURIComponent,
    Promise,
    Map,
    Set,
  };

  vm.runInNewContext(source, context, { filename: "x-openapi-flow-redoc-plugin.js" });
  return context.window.XOpenApiFlowRedocInternals;
}

function createModel() {
  return {
    flowCount: 2,
    resources: [
      {
        resource: "order",
        resourcePlural: "orders",
        states: ["created", "paid", "fulfilled"],
        operations: [
          {
            operationId: "createOrder",
            hasFlow: true,
            httpMethod: "post",
            path: "/orders",
            kind: "create",
            currentState: "created",
            prerequisites: [],
            nextOperations: [
              {
                targetState: "paid",
                triggerType: "sync",
                nextOperationId: "payOrder",
                prerequisites: ["createOrder"],
              },
            ],
          },
          {
            operationId: "payOrder",
            hasFlow: true,
            httpMethod: "post",
            path: "/orders/{id}/pay",
            kind: "action",
            currentState: "paid",
            prerequisites: ["createOrder"],
            nextOperations: [
              {
                targetState: "fulfilled",
                triggerType: "webhook",
                nextOperationId: "fulfillOrder",
                prerequisites: ["payOrder"],
              },
            ],
          },
        ],
      },
    ],
  };
}

test("redoc plugin internals build Mermaid overview from lifecycle model", () => {
  const internals = loadRedocInternals();
  const mermaid = internals.buildOverviewMermaid(createModel());

  assert.match(mermaid, /stateDiagram-v2/);
  assert.match(mermaid, /state "created" as s_created_\d+/);
  assert.match(mermaid, /state "paid" as s_paid_\d+/);
  assert.match(mermaid, /next payOrder/);
  assert.match(mermaid, /requires createOrder/);
});

test("redoc plugin internals locate operations in intermediate model", () => {
  const internals = loadRedocInternals();
  const match = internals.findOperationInModel(createModel(), "payOrder");

  assert.equal(match.operation.operationId, "payOrder");
  assert.equal(match.operation.path, "/orders/{id}/pay");
  assert.equal(match.resource.resource, "order");
});

test("redoc plugin internals report transition availability", () => {
  const internals = loadRedocInternals();
  assert.equal(internals.hasOverviewTransitions(createModel()), true);
  assert.equal(internals.hasOverviewTransitions({ flowCount: 0, resources: [] }), false);
});

test("redoc plugin internals provide Mermaid fallback guidance", () => {
  const internals = loadRedocInternals();
  const message = internals.getMermaidFallbackMessage();

  assert.match(message, /Could not render Mermaid image/);
  assert.match(message, /ReDoc/);
});

test("redoc plugin renders decision_rule, async_contract and failure_paths on enriched transitions", () => {
  const internals = loadRedocInternals();
  const nextOperation = {
    targetState: "PAID",
    triggerType: "synchronous",
    nextOperationId: "payOrder",
    prerequisites: ["createOrder"],
    condition: "Payment is confirmed",
    decisionRule: "payOrder:response.200.body.payment_status == 'approved'",
    evidenceRefs: ["payOrder:response.200.body.payment_status"],
    propagatedFieldRefs: ["createOrder:response.201.body.order_id"],
    asyncContract: { timeout_ms: 120000, max_retries: 3, backoff: "exponential" },
    compensationOperationId: "cancelOrder",
    failurePaths: [{ reason: "Payment gateway denied authorization", target_state: "PAYMENT_FAILED", next_operation_id: "getOrder" }],
  };

  const details = internals.renderTransitionDetails(nextOperation);
  assert.match(details, /decision: payOrder:response\.200\.body\.payment_status/);
  assert.match(details, /evidence: payOrder:response\.200\.body\.payment_status/);
  assert.match(details, /propagates: createOrder:response\.201\.body\.order_id/);
  assert.match(details, /timeout: 120000ms/);
  assert.match(details, /max_retries: 3/);
  assert.match(details, /backoff: exponential/);
  assert.match(details, /compensation: cancelOrder/);
  assert.match(details, /on failure -> PAYMENT_FAILED \(next: getOrder\)/);

  const operation = { currentState: "CREATED", nextOperations: [nextOperation] };
  const list = internals.renderTransitionList(operation);
  assert.match(list, /Payment is confirmed/);
  assert.match(list, /decision: payOrder/);
});

test("redoc plugin omits the detail list when a transition has no extra fields", () => {
  const internals = loadRedocInternals();
  const details = internals.renderTransitionDetails({ targetState: "PAID", triggerType: "synchronous" });
  assert.equal(details, "");
});