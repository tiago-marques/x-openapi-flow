"use strict";

/**
 * Built-in persistence adapters for the x-openapi-flow runtime guard.
 *
 * Each adapter implements the two-function contract expected by RuntimeFlowGuard:
 *   getCurrentState({ resourceId, operationId }) => Promise<string|null>
 *   setState({ resourceId, state })              => Promise<void>
 *
 * Usage:
 *   const { MemoryAdapter } = require("x-openapi-flow/lib/runtime-guard/adapters");
 *   const adapter = new MemoryAdapter();
 *   app.use(createExpressFlowGuard({ openapi, ...adapter.forGuard() }));
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// MemoryAdapter – in-process Map, suitable for testing and single-instance dev
// ---------------------------------------------------------------------------

class MemoryAdapter {
  constructor() {
    this._store = new Map();
  }

  async getCurrentState({ resourceId }) {
    if (!resourceId) return null;
    return this._store.get(String(resourceId)) || null;
  }

  async setState({ resourceId, state }) {
    if (!resourceId) return;
    this._store.set(String(resourceId), String(state));
  }

  /** Delete a resource's state (e.g. after a terminal transition). */
  async deleteState({ resourceId }) {
    if (!resourceId) return;
    this._store.delete(String(resourceId));
  }

  /** Returns the { getCurrentState, setState } object expected by guard options. */
  forGuard() {
    return {
      getCurrentState: (ctx) => this.getCurrentState(ctx),
      setState: (ctx) => this.setState(ctx),
    };
  }
}

// ---------------------------------------------------------------------------
// FileAdapter – JSON file on disk, suitable for demos and local dev servers
// ---------------------------------------------------------------------------

class FileAdapter {
  /**
   * @param {object} options
   * @param {string} [options.filePath] - Path to the JSON state file (default: ./x-flow-state.json)
   */
  constructor(options = {}) {
    this._filePath = options.filePath
      ? path.resolve(options.filePath)
      : path.resolve(process.cwd(), "x-flow-state.json");
    this._cache = null;
  }

  _load() {
    if (!fs.existsSync(this._filePath)) {
      return {};
    }
    try {
      const raw = fs.readFileSync(this._filePath, "utf8");
      return JSON.parse(raw) || {};
    } catch (_err) {
      return {};
    }
  }

  _save(data) {
    fs.mkdirSync(path.dirname(this._filePath), { recursive: true });
    fs.writeFileSync(this._filePath, JSON.stringify(data, null, 2), "utf8");
  }

  async getCurrentState({ resourceId }) {
    if (!resourceId) return null;
    const data = this._load();
    return data[String(resourceId)] || null;
  }

  async setState({ resourceId, state }) {
    if (!resourceId) return;
    const data = this._load();
    data[String(resourceId)] = String(state);
    this._save(data);
  }

  async deleteState({ resourceId }) {
    if (!resourceId) return;
    const data = this._load();
    delete data[String(resourceId)];
    this._save(data);
  }

  forGuard() {
    return {
      getCurrentState: (ctx) => this.getCurrentState(ctx),
      setState: (ctx) => this.setState(ctx),
    };
  }
}

// ---------------------------------------------------------------------------
// RedisAdapter – requires `ioredis` as a peer dependency
// ---------------------------------------------------------------------------

class RedisAdapter {
  /**
   * @param {object} options
   * @param {object} options.client  - An ioredis (or compatible) client instance
   * @param {string} [options.prefix] - Key prefix (default: "xflow:")
   * @param {number} [options.ttl]    - TTL in seconds (optional; 0 = no expiry)
   */
  constructor(options = {}) {
    if (!options.client) {
      throw new Error(
        "RedisAdapter requires an ioredis client. Pass { client: new Redis() }. " +
        "Install peer dependency: npm install ioredis"
      );
    }
    this._client = options.client;
    this._prefix = options.prefix || "xflow:";
    this._ttl = options.ttl || 0;
  }

  _key(resourceId) {
    return `${this._prefix}${resourceId}`;
  }

  async getCurrentState({ resourceId }) {
    if (!resourceId) return null;
    const value = await this._client.get(this._key(resourceId));
    return value || null;
  }

  async setState({ resourceId, state }) {
    if (!resourceId) return;
    const key = this._key(resourceId);
    if (this._ttl > 0) {
      await this._client.set(key, String(state), "EX", this._ttl);
    } else {
      await this._client.set(key, String(state));
    }
  }

  async deleteState({ resourceId }) {
    if (!resourceId) return;
    await this._client.del(this._key(resourceId));
  }

  forGuard() {
    return {
      getCurrentState: (ctx) => this.getCurrentState(ctx),
      setState: (ctx) => this.setState(ctx),
    };
  }
}

// ---------------------------------------------------------------------------
// GenericSQLAdapter – uses any query callback; works with pg, mysql2, knex, etc.
// ---------------------------------------------------------------------------

class GenericSQLAdapter {
  /**
   * @param {object} options
   * @param {function} options.query   - async (sql, params) => rows[]
   *   Must support parameterised queries with $1/$2 (pg) or ? (mysql).
   *   Use `dialect` to select placeholder style.
   * @param {string} [options.table]   - State table name (default: "xflow_state")
   * @param {string} [options.dialect] - "pg" (default) | "mysql"
   *
   * Table schema (run once in migrations):
   *   CREATE TABLE IF NOT EXISTS xflow_state (
   *     resource_id TEXT PRIMARY KEY,
   *     state       TEXT NOT NULL,
   *     updated_at  TIMESTAMPTZ DEFAULT now()
   *   );
   */
  constructor(options = {}) {
    if (typeof options.query !== "function") {
      throw new Error(
        "GenericSQLAdapter requires a { query: async (sql, params) => rows } callback. " +
        "Example with pg: { query: (sql, params) => pool.query(sql, params).then(r => r.rows) }"
      );
    }
    this._query = options.query;
    this._table = options.table || "xflow_state";
    this._dialect = options.dialect || "pg";
  }

  _p(n) {
    return this._dialect === "mysql" ? "?" : `$${n}`;
  }

  async getCurrentState({ resourceId }) {
    if (!resourceId) return null;
    const rows = await this._query(
      `SELECT state FROM ${this._table} WHERE resource_id = ${this._p(1)} LIMIT 1`,
      [String(resourceId)]
    );
    return (rows && rows[0] && rows[0].state) || null;
  }

  async setState({ resourceId, state }) {
    if (!resourceId) return;
    if (this._dialect === "mysql") {
      await this._query(
        `INSERT INTO ${this._table} (resource_id, state) VALUES (?, ?) ` +
        `ON DUPLICATE KEY UPDATE state = VALUES(state)`,
        [String(resourceId), String(state)]
      );
    } else {
      await this._query(
        `INSERT INTO ${this._table} (resource_id, state) VALUES ($1, $2) ` +
        `ON CONFLICT (resource_id) DO UPDATE SET state = EXCLUDED.state`,
        [String(resourceId), String(state)]
      );
    }
  }

  async deleteState({ resourceId }) {
    if (!resourceId) return;
    await this._query(
      `DELETE FROM ${this._table} WHERE resource_id = ${this._p(1)}`,
      [String(resourceId)]
    );
  }

  forGuard() {
    return {
      getCurrentState: (ctx) => this.getCurrentState(ctx),
      setState: (ctx) => this.setState(ctx),
    };
  }

  /** Convenience: create the table if it does not exist yet */
  async ensureTable() {
    await this._query(
      `CREATE TABLE IF NOT EXISTS ${this._table} (
        resource_id TEXT PRIMARY KEY,
        state       TEXT NOT NULL,
        updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      []
    );
  }
}

module.exports = {
  MemoryAdapter,
  FileAdapter,
  RedisAdapter,
  GenericSQLAdapter,
};
