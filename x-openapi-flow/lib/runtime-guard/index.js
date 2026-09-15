"use strict";

const { createRuntimeFlowGuard, RuntimeFlowGuard, toErrorPayload } = require("./core");
const { createExpressFlowGuard } = require("./express");
const { createFastifyFlowGuard } = require("./fastify");
const { createHonoFlowGuard } = require("./hono");
const { createNestFlowMiddleware, createNestFlowCanActivate } = require("./nestjs");
const { FlowGuardError } = require("./errors");
const { MemoryAdapter, FileAdapter, RedisAdapter, GenericSQLAdapter, MongoAdapter } = require("./adapters");

module.exports = {
  createRuntimeFlowGuard,
  RuntimeFlowGuard,
  createExpressFlowGuard,
  createFastifyFlowGuard,
  createHonoFlowGuard,
  createNestFlowMiddleware,
  createNestFlowCanActivate,
  FlowGuardError,
  toErrorPayload,
  MemoryAdapter,
  FileAdapter,
  RedisAdapter,
  GenericSQLAdapter,
  MongoAdapter,
};
