"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MemoryAdapter,
  MongoAdapter,
} = require("../../lib/runtime-guard/adapters");

function createFakeMongoCollection() {
  const docs = new Map();

  return {
    docs,
    async findOne(query) {
      return docs.get(query._id) || null;
    },
    async updateOne(query, update, options) {
      const existing = docs.get(query._id);
      if (!existing && !(options && options.upsert)) {
        return { matchedCount: 0 };
      }
      const next = { _id: query._id, ...(existing || {}), ...update.$set };
      docs.set(query._id, next);
      return { matchedCount: existing ? 1 : 0, upsertedCount: existing ? 0 : 1 };
    },
    async deleteOne(query) {
      const existed = docs.delete(query._id);
      return { deletedCount: existed ? 1 : 0 };
    },
  };
}

test("MemoryAdapter stores, reads, and deletes state", async () => {
  const adapter = new MemoryAdapter();

  assert.equal(await adapter.getCurrentState({ resourceId: "res_1" }), null);

  await adapter.setState({ resourceId: "res_1", state: "CREATED" });
  assert.equal(await adapter.getCurrentState({ resourceId: "res_1" }), "CREATED");

  await adapter.deleteState({ resourceId: "res_1" });
  assert.equal(await adapter.getCurrentState({ resourceId: "res_1" }), null);
});

test("MongoAdapter throws without a collection", () => {
  assert.throws(() => new MongoAdapter(), /requires a MongoDB Collection instance/);
  assert.throws(() => new MongoAdapter({}), /requires a MongoDB Collection instance/);
});

test("MongoAdapter returns null for unknown resources", async () => {
  const collection = createFakeMongoCollection();
  const adapter = new MongoAdapter({ collection });

  assert.equal(await adapter.getCurrentState({ resourceId: "ord_1" }), null);
  assert.equal(await adapter.getCurrentState({ resourceId: null }), null);
});

test("MongoAdapter upserts and reads back state via setState/getCurrentState", async () => {
  const collection = createFakeMongoCollection();
  const adapter = new MongoAdapter({ collection });

  await adapter.setState({ resourceId: "ord_1", state: "CREATED" });
  assert.equal(await adapter.getCurrentState({ resourceId: "ord_1" }), "CREATED");

  await adapter.setState({ resourceId: "ord_1", state: "PAID" });
  assert.equal(await adapter.getCurrentState({ resourceId: "ord_1" }), "PAID");

  const stored = collection.docs.get("ord_1");
  assert.equal(stored.state, "PAID");
  assert.ok(stored.updatedAt instanceof Date);
});

test("MongoAdapter deleteState removes the document", async () => {
  const collection = createFakeMongoCollection();
  const adapter = new MongoAdapter({ collection });

  await adapter.setState({ resourceId: "ord_1", state: "CREATED" });
  await adapter.deleteState({ resourceId: "ord_1" });

  assert.equal(await adapter.getCurrentState({ resourceId: "ord_1" }), null);
});

test("MongoAdapter supports a custom stateField", async () => {
  const collection = createFakeMongoCollection();
  const adapter = new MongoAdapter({ collection, stateField: "status" });

  await adapter.setState({ resourceId: "ord_1", state: "SHIPPED" });

  assert.equal(await adapter.getCurrentState({ resourceId: "ord_1" }), "SHIPPED");
  assert.equal(collection.docs.get("ord_1").status, "SHIPPED");
  assert.equal(collection.docs.get("ord_1").state, undefined);
});

test("MongoAdapter.forGuard() wires getCurrentState/setState for the runtime guard", async () => {
  const collection = createFakeMongoCollection();
  const adapter = new MongoAdapter({ collection });
  const guardOptions = adapter.forGuard();

  assert.equal(typeof guardOptions.getCurrentState, "function");
  assert.equal(typeof guardOptions.setState, "function");

  await guardOptions.setState({ resourceId: "ord_2", state: "CREATED" });
  assert.equal(await guardOptions.getCurrentState({ resourceId: "ord_2" }), "CREATED");
});
