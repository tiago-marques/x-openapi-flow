export interface FlowContext {
  operationId?: string;
  method?: string;
  path?: string;
  params?: Record<string, string>;
  resourceId?: string;
  [key: string]: unknown;
}

export interface RuntimeFlowGuardOptions {
  openapi: object | string;
  getCurrentState: (ctx: FlowContext & { operation: unknown; resourceId: string | null }) => Promise<string | null>;
  resolveResourceId?: (ctx: FlowContext) => string | null;
  resolveOperationId?: (ctx: FlowContext) => Promise<string | null> | string | null;
  allowUnknownOperations?: boolean;
  allowIdempotentState?: boolean;
  allowMissingStateForInitial?: boolean;
  requireResourceIdForTransitions?: boolean;
}

export interface NestHttpContextLike {
  getRequest: () => object;
  getResponse: () => object;
}

export interface NestExecutionContextLike {
  switchToHttp: () => NestHttpContextLike;
}

export type NestCanActivateFunction = (executionContext: NestExecutionContextLike) => Promise<boolean>;
export type NestMiddlewareFunction = (req: object, res: object, next: (err?: unknown) => void) => void;

export declare function createNestFlowMiddleware(options: RuntimeFlowGuardOptions): NestMiddlewareFunction;
export declare function createNestFlowCanActivate(options: RuntimeFlowGuardOptions): NestCanActivateFunction;

export declare function createFlowMiddleware(options: RuntimeFlowGuardOptions): {
  use(req: object, res: object, next: (err?: unknown) => void): void;
};

export declare function createFlowGuard(options: RuntimeFlowGuardOptions): {
  canActivate(executionContext: NestExecutionContextLike): Promise<boolean>;
};

export declare class MemoryAdapter {
  getCurrentState(ctx: { resourceId: string | null }): Promise<string | null>;
  setState(ctx: { resourceId: string | null; state: string }): Promise<void>;
  deleteState(ctx: { resourceId: string | null }): Promise<void>;
  forGuard(): {
    getCurrentState: (ctx: { resourceId: string | null }) => Promise<string | null>;
    setState: (ctx: { resourceId: string | null; state: string }) => Promise<void>;
  };
}

export declare class FileAdapter extends MemoryAdapter {}
export declare class RedisAdapter extends MemoryAdapter {}
export declare class GenericSQLAdapter extends MemoryAdapter {}
