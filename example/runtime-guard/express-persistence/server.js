"use strict";

const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const openapi = require("./openapi.flow.json");
const { createExpressFlowGuard } = require("x-openapi-flow/lib/runtime-guard");

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3120);
const DATA_DIR = path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "orders.json");

function ensureStoreFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, "{}\n", "utf8");
  }
}

function readStore() {
  ensureStoreFile();
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_err) {
    return {};
  }
}

function writeStore(nextStore) {
  ensureStoreFile();
  const tempPath = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(nextStore, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, STORE_FILE);
}

function getOrder(id) {
  const store = readStore();
  return store[id] || null;
}

function upsertOrder(order) {
  const store = readStore();
  store[order.id] = order;
  writeStore(store);
}

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

      const order = getOrder(resourceId);
      return order ? order.state : null;
    },
    resolveResourceId: ({ req }) => resolveOrderIdFromPath(req),
    allowUnknownOperations: true,
  })
);

app.post("/orders", (_req, res) => {
  const id = `ord_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const order = {
    id,
    state: "CREATED",
    created_at: new Date().toISOString(),
  };

  upsertOrder(order);
  return res.status(201).json(order);
});

app.post("/orders/:id/pay", (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Order not found." } });
  }

  order.state = "PAID";
  order.paid_at = new Date().toISOString();
  upsertOrder(order);
  return res.status(200).json(order);
});

app.post("/orders/:id/ship", (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Order not found." } });
  }

  order.state = "SHIPPED";
  order.shipped_at = new Date().toISOString();
  upsertOrder(order);
  return res.status(200).json(order);
});

app.get("/orders/:id", (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Order not found." } });
  }

  return res.status(200).json(order);
});

app.post("/debug/reset", (_req, res) => {
  writeStore({});
  return res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  ensureStoreFile();
  console.log(`Runtime guard persistence demo listening on http://localhost:${PORT}`);
  console.log(`Persisting order state in ${STORE_FILE}`);
});
