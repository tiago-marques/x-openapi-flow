"use strict";

const express = require("express");
const client = require("prom-client");
const openapi = require("./openapi.flow.json");
const { createExpressFlowGuard } = require("x-openapi-flow/lib/runtime-guard");

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3120);
const orderStore = new Map();

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const decisionsTotal = new client.Counter({
  name: "x_openapi_flow_decisions_total",
  help: "Runtime guard decisions, labeled by outcome and operation.",
  labelNames: ["decision", "operation_id", "method"],
  registers: [registry],
});

const decisionDurationMs = new client.Histogram({
  name: "x_openapi_flow_decision_duration_ms",
  help: "Time spent evaluating a runtime guard decision, in milliseconds.",
  labelNames: ["decision", "operation_id"],
  buckets: [0.5, 1, 2, 5, 10, 25, 50, 100],
  registers: [registry],
});

function resolveOrderIdFromPath(req) {
  const fromParams = req && req.params && req.params.id ? String(req.params.id) : null;
  if (fromParams) {
    return fromParams;
  }

  const rawPath = req && (req.path || (req.originalUrl ? req.originalUrl.split("?")[0] : null));
  if (!rawPath) {
    return null;
  }

  const match = String(rawPath).match(/^\/orders\/([^/]+)\/(pay|ship)$/);
  return match ? match[1] : null;
}

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});

app.use(
  createExpressFlowGuard({
    openapi,
    async getCurrentState({ resourceId }) {
      if (!resourceId) {
        return null;
      }

      const order = orderStore.get(resourceId);
      return order ? order.state : null;
    },
    resolveResourceId: ({ req }) => resolveOrderIdFromPath(req),
    allowUnknownOperations: true,
    onDecision(event) {
      decisionsTotal.inc({
        decision: event.decision,
        operation_id: event.operationId || "unknown",
        method: event.method || "unknown",
      });

      decisionDurationMs.observe(
        {
          decision: event.decision,
          operation_id: event.operationId || "unknown",
        },
        event.durationMs
      );
    },
  })
);

app.post("/orders", (_req, res) => {
  const id = `ord_${Date.now()}`;
  const order = { id, state: "CREATED" };
  orderStore.set(id, order);
  return res.status(201).json(order);
});

app.post("/orders/:id/pay", (req, res) => {
  const order = orderStore.get(req.params.id);
  if (!order) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Order not found." } });
  }

  order.state = "PAID";
  orderStore.set(order.id, order);
  return res.status(200).json(order);
});

app.post("/orders/:id/ship", (req, res) => {
  const order = orderStore.get(req.params.id);
  if (!order) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Order not found." } });
  }

  order.state = "SHIPPED";
  orderStore.set(order.id, order);
  return res.status(200).json(order);
});

app.get("/orders/:id", (req, res) => {
  const order = orderStore.get(req.params.id);
  if (!order) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Order not found." } });
  }

  return res.status(200).json(order);
});

app.listen(PORT, () => {
  console.log(`Runtime guard observability demo listening on http://localhost:${PORT}`);
  console.log(`Prometheus metrics exposed at http://localhost:${PORT}/metrics`);
});
