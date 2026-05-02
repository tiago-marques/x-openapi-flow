# x-openapi-flow-nestjs-kit

NestJS integration helpers for x-openapi-flow runtime guard.

## Install

npm install x-openapi-flow x-openapi-flow-nestjs-kit

## Middleware usage

const { createFlowMiddleware, MemoryAdapter } = require("x-openapi-flow-nestjs-kit");
const openapi = require("./openapi.flow.json");

const store = new MemoryAdapter();
const flowMiddleware = createFlowMiddleware({ openapi, ...store.forGuard() });

class FlowGuardMiddleware {
  use(req, res, next) {
    return flowMiddleware.use(req, res, next);
  }
}

## Guard usage (CanActivate)

const { createFlowGuard, MemoryAdapter } = require("x-openapi-flow-nestjs-kit");
const openapi = require("./openapi.flow.json");

const store = new MemoryAdapter();
const flowGuard = createFlowGuard({ openapi, ...store.forGuard() });

class FlowGuard {
  canActivate(context) {
    return flowGuard.canActivate(context);
  }
}

## Exports

- createFlowMiddleware
- createFlowGuard
- createNestFlowMiddleware
- createNestFlowCanActivate
- MemoryAdapter
- FileAdapter
- RedisAdapter
- GenericSQLAdapter
