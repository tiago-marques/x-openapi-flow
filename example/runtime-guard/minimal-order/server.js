"use strict";

const express = require("express");
const openapi = require("./openapi.flow.json");
const { createExpressFlowGuard } = require("x-openapi-flow/lib/runtime-guard");

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3110);
const orderStore = new Map();

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
  console.log(`Minimal runtime block demo listening on http://localhost:${PORT}`);
});
