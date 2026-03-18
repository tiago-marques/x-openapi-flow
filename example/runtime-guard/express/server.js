"use strict";

const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const { createExpressFlowGuard } = require("x-openapi-flow/lib/runtime-guard");

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3101);
const specPath = path.join(__dirname, "openapi.flow.json");

if (!fs.existsSync(specPath)) {
  console.error("Missing openapi.flow.json. Run: npm run apply");
  process.exit(1);
}

const openapi = JSON.parse(fs.readFileSync(specPath, "utf8"));

const paymentStore = new Map();

app.use(
  createExpressFlowGuard({
    openapi,
    async getCurrentState({ resourceId }) {
      if (!resourceId) {
        return null;
      }

      const item = paymentStore.get(resourceId);
      return item ? item.state : null;
    },
    resolveResourceId: ({ params }) => (params && params.id ? String(params.id) : null),
    allowUnknownOperations: true,
  })
);

app.post("/payments", (req, res) => {
  const id = `pay_${Date.now()}`;
  const payment = {
    id,
    state: "AUTHORIZED",
    amount: req.body && req.body.amount ? req.body.amount : null,
    currency: req.body && req.body.currency ? req.body.currency : null,
  };

  paymentStore.set(id, payment);
  res.status(201).json(payment);
});

app.post("/payments/:id/capture", (req, res) => {
  const payment = paymentStore.get(req.params.id);
  if (!payment) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Payment not found." } });
  }

  payment.state = "CAPTURED";
  paymentStore.set(payment.id, payment);
  return res.status(200).json(payment);
});

app.get("/payments/:id", (req, res) => {
  const payment = paymentStore.get(req.params.id);
  if (!payment) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Payment not found." } });
  }

  return res.status(200).json(payment);
});

app.post("/debug/payments/:id/state", (req, res) => {
  const payment = paymentStore.get(req.params.id);
  if (!payment) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Payment not found." } });
  }

  const nextState = req.body && req.body.state ? String(req.body.state) : null;
  if (!nextState) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: "state is required." } });
  }

  payment.state = nextState;
  paymentStore.set(payment.id, payment);
  return res.status(200).json(payment);
});

app.listen(PORT, () => {
  console.log(`Runtime guard Express demo listening on http://localhost:${PORT}`);
});
