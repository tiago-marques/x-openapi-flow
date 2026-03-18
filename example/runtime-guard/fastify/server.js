"use strict";

const fs = require("node:fs");
const path = require("node:path");
const fastify = require("fastify")({ logger: false });
const { createFastifyFlowGuard } = require("x-openapi-flow/lib/runtime-guard");

const PORT = Number(process.env.PORT || 3102);
const specPath = path.join(__dirname, "openapi.flow.json");

if (!fs.existsSync(specPath)) {
  console.error("Missing openapi.flow.json. Run: npm run apply");
  process.exit(1);
}

const openapi = JSON.parse(fs.readFileSync(specPath, "utf8"));
const paymentStore = new Map();

fastify.addHook(
  "preHandler",
  createFastifyFlowGuard({
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

fastify.post(
  "/payments",
  {
    config: {
      operationId: "createPayment",
    },
  },
  async (request, reply) => {
    const id = `pay_${Date.now()}`;
    const payment = {
      id,
      state: "AUTHORIZED",
      amount: request.body && request.body.amount ? request.body.amount : null,
      currency: request.body && request.body.currency ? request.body.currency : null,
    };

    paymentStore.set(id, payment);
    return reply.code(201).send(payment);
  }
);

fastify.post(
  "/payments/:id/capture",
  {
    config: {
      operationId: "capturePayment",
    },
  },
  async (request, reply) => {
    const payment = paymentStore.get(request.params.id);
    if (!payment) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Payment not found." } });
    }

    payment.state = "CAPTURED";
    paymentStore.set(payment.id, payment);
    return reply.code(200).send(payment);
  }
);

fastify.get(
  "/payments/:id",
  {
    config: {
      operationId: "getPayment",
    },
  },
  async (request, reply) => {
    const payment = paymentStore.get(request.params.id);
    if (!payment) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Payment not found." } });
    }

    return reply.code(200).send(payment);
  }
);

fastify.post("/debug/payments/:id/state", async (request, reply) => {
  const payment = paymentStore.get(request.params.id);
  if (!payment) {
    return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Payment not found." } });
  }

  const nextState = request.body && request.body.state ? String(request.body.state) : null;
  if (!nextState) {
    return reply.code(400).send({ error: { code: "INVALID_INPUT", message: "state is required." } });
  }

  payment.state = nextState;
  paymentStore.set(payment.id, payment);
  return reply.code(200).send(payment);
});

fastify.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
  console.log(`Runtime guard Fastify demo listening on http://localhost:${PORT}`);
});
