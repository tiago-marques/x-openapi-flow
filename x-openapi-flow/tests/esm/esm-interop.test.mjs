import { test } from "node:test";
import assert from "node:assert/strict";

test("root entrypoint is importable from ESM with named exports", async () => {
  const mod = await import("x-openapi-flow");
  assert.equal(typeof mod.loadApi, "function");
  assert.equal(typeof mod.run, "function");
});

test("subpath x-openapi-flow/lib/runtime-guard is importable from ESM", async () => {
  const mod = await import("x-openapi-flow/lib/runtime-guard");
  assert.equal(typeof mod.createExpressFlowGuard, "function");
  assert.equal(typeof mod.createFastifyFlowGuard, "function");
  assert.equal(typeof mod.MemoryAdapter, "function");
});

test("subpath x-openapi-flow/lib/state-machine-engine is importable from ESM", async () => {
  const mod = await import("x-openapi-flow/lib/state-machine-engine");
  assert.equal(typeof mod.createStateMachineEngine, "function");
});

test("subpath x-openapi-flow/lib/openapi-state-machine-adapter is importable from ESM", async () => {
  const mod = await import("x-openapi-flow/lib/openapi-state-machine-adapter");
  assert.equal(typeof mod.createStateMachineAdapterModel, "function");
});

test("nested subpath x-openapi-flow/lib/runtime-guard/adapters is importable from ESM", async () => {
  const mod = await import("x-openapi-flow/lib/runtime-guard/adapters");
  assert.equal(typeof mod.MemoryAdapter, "function");
  assert.equal(typeof mod.FileAdapter, "function");
  assert.equal(typeof mod.RedisAdapter, "function");
  assert.equal(typeof mod.GenericSQLAdapter, "function");
});
