// Type definitions for x-openapi-flow
// Covers: runtime-guard, state-machine-engine, openapi-state-machine-adapter, validator

export {};

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export interface FlowContext {
  operationId?: string;
  method?: string;
  path?: string;
  params?: Record<string, string>;
  resourceId?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// runtime-guard – core
// ---------------------------------------------------------------------------

export interface RuntimeFlowGuardOptions {
  /** Loaded OpenAPI document (object) or path to OpenAPI file */
  openapi: object | string;
  /**
   * Resolve the current state of a resource.
   * Return null/undefined when the resource has no state yet (initial creation).
   */
  getCurrentState: (ctx: FlowContext & { operation: FlowOperation; resourceId: string | null }) => Promise<string | null>;
  /**
   * Optional: resolve resourceId from a request context.
   * Defaults to ctx.params.id || ctx.params.resourceId.
   */
  resolveResourceId?: (ctx: FlowContext) => string | null;
  resolveOperationId?: (ctx: FlowContext) => Promise<string | null>;
  allowUnknownOperations?: boolean;
  allowIdempotentState?: boolean;
  allowMissingStateForInitial?: boolean;
  requireResourceIdForTransitions?: boolean;
}

export interface FlowOperation {
  operationId: string;
  method: string;
  path: string;
  routeRegex: RegExp;
  incomingFromStates: Set<string>;
  currentState?: string;
}

export interface EnforceResult {
  ok: true;
  operationId: string;
  resourceId: string | null;
  currentState: string | null;
  skipped?: boolean;
  reason?: string;
}

export interface FlowGuardErrorPayload {
  error: {
    code: "INVALID_STATE_TRANSITION" | "UNKNOWN_OPERATION" | "MISSING_RESOURCE_ID" | "MISSING_STATE_RESOLVER";
    message: string;
    operation_id?: string;
    current_state?: string | null;
    allowed_from_states?: string[];
    resource_id?: string | null;
  };
}

export declare class FlowGuardError extends Error {
  code: string;
  payload: FlowGuardErrorPayload;
}

export declare class RuntimeFlowGuard {
  constructor(options: RuntimeFlowGuardOptions);
  resolveOperation(ctx: { operationId?: string; method?: string; path?: string }): FlowOperation | null;
  enforce(context?: FlowContext): Promise<EnforceResult>;
}

export declare function createRuntimeFlowGuard(options: RuntimeFlowGuardOptions): RuntimeFlowGuard;
export declare function toErrorPayload(error: FlowGuardError): FlowGuardErrorPayload;

// ---------------------------------------------------------------------------
// runtime-guard – Express / Fastify
// ---------------------------------------------------------------------------

export type ExpressMiddleware = (req: object, res: object, next: (err?: unknown) => void) => void;
export type FastifyPreHandler = (request: object, reply: object) => Promise<void>;

export declare function createExpressFlowGuard(options: RuntimeFlowGuardOptions): ExpressMiddleware;
export declare function createFastifyFlowGuard(options: RuntimeFlowGuardOptions): FastifyPreHandler;

// ---------------------------------------------------------------------------
// runtime-guard – Persistence adapters
// ---------------------------------------------------------------------------

export interface AdapterStateContext {
  resourceId: string | null;
  operationId?: string;
  [key: string]: unknown;
}

export interface AdapterSetContext {
  resourceId: string | null;
  state: string;
}

export interface GuardAdapterMethods {
  getCurrentState: (ctx: AdapterStateContext) => Promise<string | null>;
  setState: (ctx: AdapterSetContext) => Promise<void>;
}

export declare class MemoryAdapter {
  getCurrentState(ctx: AdapterStateContext): Promise<string | null>;
  setState(ctx: AdapterSetContext): Promise<void>;
  deleteState(ctx: { resourceId: string | null }): Promise<void>;
  forGuard(): GuardAdapterMethods;
}

export interface FileAdapterOptions {
  filePath?: string;
}
export declare class FileAdapter {
  constructor(options?: FileAdapterOptions);
  getCurrentState(ctx: AdapterStateContext): Promise<string | null>;
  setState(ctx: AdapterSetContext): Promise<void>;
  deleteState(ctx: { resourceId: string | null }): Promise<void>;
  forGuard(): GuardAdapterMethods;
}

export interface RedisAdapterOptions {
  /** An ioredis (or compatible) client instance */
  client: object;
  prefix?: string;
  /** TTL in seconds; 0 = no expiry */
  ttl?: number;
}
export declare class RedisAdapter {
  constructor(options: RedisAdapterOptions);
  getCurrentState(ctx: AdapterStateContext): Promise<string | null>;
  setState(ctx: AdapterSetContext): Promise<void>;
  deleteState(ctx: { resourceId: string | null }): Promise<void>;
  forGuard(): GuardAdapterMethods;
}

export interface GenericSQLAdapterOptions {
  /**
   * Execute a parameterised query and return rows.
   * Example (pg): (sql, params) => pool.query(sql, params).then(r => r.rows)
   */
  query: (sql: string, params: unknown[]) => Promise<Array<Record<string, unknown>>>;
  /** Table name (default: "xflow_state") */
  table?: string;
  /** Placeholder style: "pg" ($1, $2…) or "mysql" (?) — default: "pg" */
  dialect?: "pg" | "mysql";
}
export declare class GenericSQLAdapter {
  constructor(options: GenericSQLAdapterOptions);
  getCurrentState(ctx: AdapterStateContext): Promise<string | null>;
  setState(ctx: AdapterSetContext): Promise<void>;
  deleteState(ctx: { resourceId: string | null }): Promise<void>;
  forGuard(): GuardAdapterMethods;
  /** Run CREATE TABLE IF NOT EXISTS for the state table */
  ensureTable(): Promise<void>;
}

// ---------------------------------------------------------------------------
// state-machine-engine
// ---------------------------------------------------------------------------

export interface StateMachineTransition {
  from: string;
  action: string;
  to: string;
}

export interface StateMachineEngineOptions {
  transitions: StateMachineTransition[];
}

export interface StateMachineEngine {
  canTransition(currentState: string, action: string): boolean;
  getNextState(currentState: string, action: string): string | null;
  validateFlow(opts: { startState: string; actions: string[] }): { valid: boolean; errors: string[] };
}

export declare function createStateMachineEngine(options: StateMachineEngineOptions): StateMachineEngine;

// ---------------------------------------------------------------------------
// openapi-state-machine-adapter
// ---------------------------------------------------------------------------

export interface StateMachineAdapterModel {
  definition: StateMachineEngineOptions;
  operations: Array<{ operationId: string; method: string; path: string; currentState: string }>;
}

export declare function createStateMachineAdapterModel(opts: { openapiPath: string }): StateMachineAdapterModel;

// ---------------------------------------------------------------------------
// validator (programmatic API)
// ---------------------------------------------------------------------------

export interface ValidateOptions {
  output?: "pretty" | "json";
  profile?: "core" | "relaxed" | "strict";
  strictQuality?: boolean;
  semantic?: boolean;
}

export interface ValidateResult {
  ok: boolean;
  errors?: unknown[];
  warnings?: unknown[];
}

export declare function run(filePath: string, options?: ValidateOptions): ValidateResult;
