"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderResource = exports.OrderPaid = exports.OrderOrderObserved = exports.OrderFulfilled = exports.OrderCreated = exports.OrderResourceInstance = void 0;
const ensurePrerequisites = (completedOperations, requiredOperationIds, methodName) => {
    const missing = requiredOperationIds.filter((operationId) => !completedOperations.has(operationId));
    if (missing.length > 0) {
        throw new Error(`Cannot call ${methodName} before prerequisites are satisfied: ${missing.join(", ")}`);
    }
};
class OrderResourceInstance {
    constructor(service, id, completedOperations = new Set()) {
        this.service = service;
        this.id = id;
        this.completedOperations = completedOperations;
    }
    get resourceId() {
        return this.id;
    }
}
exports.OrderResourceInstance = OrderResourceInstance;
class OrderCreated extends OrderResourceInstance {
    async pay(params = {}) {
        ensurePrerequisites(this.completedOperations, ["createOrder", "getOrder"], "pay");
        const mergedParams = this.id ? { ...params, id: this.id } : { ...params };
        return this.service._executeTransition("payOrder", mergedParams, this.completedOperations);
    }
}
exports.OrderCreated = OrderCreated;
class OrderFulfilled extends OrderResourceInstance {
}
exports.OrderFulfilled = OrderFulfilled;
class OrderOrderObserved extends OrderResourceInstance {
    async pay(params = {}) {
        ensurePrerequisites(this.completedOperations, ["createOrder", "getOrder"], "pay");
        const mergedParams = this.id ? { ...params, id: this.id } : { ...params };
        return this.service._executeTransition("payOrder", mergedParams, this.completedOperations);
    }
}
exports.OrderOrderObserved = OrderOrderObserved;
class OrderPaid extends OrderResourceInstance {
    async fulfill(params = {}) {
        ensurePrerequisites(this.completedOperations, ["payOrder", "createOrder"], "fulfill");
        const mergedParams = this.id ? { ...params, id: this.id } : { ...params };
        return this.service._executeTransition("fulfillOrder", mergedParams, this.completedOperations);
    }
}
exports.OrderPaid = OrderPaid;
class OrderResource {
    constructor(httpClient) {
        this.httpClient = httpClient;
    }
    async create(params = {}) {
        const mergedParams = { ...params };
        return this.executeOperation("createOrder", mergedParams, { autoPrerequisites: false, prerequisiteParams: {}, context: undefined });
    }
    async get(id, params = {}) {
        const mergedParams = { ...params, id };
        return this.executeOperation("getOrder", mergedParams, { autoPrerequisites: false, prerequisiteParams: {}, context: undefined });
    }
    async pay(id, params = {}, options = {}) {
        const mergedParams = { ...params, id };
        return this.executeOperation("payOrder", mergedParams, {
            autoPrerequisites: options.autoPrerequisites ?? true,
            prerequisiteParams: options.prerequisiteParams || {},
            context: options.context,
        });
    }
    async fulfill(id, params = {}, options = {}) {
        const mergedParams = { ...params, id };
        return this.executeOperation("fulfillOrder", mergedParams, {
            autoPrerequisites: options.autoPrerequisites ?? true,
            prerequisiteParams: options.prerequisiteParams || {},
            context: options.context,
        });
    }
    async _executeTransition(operationId, params, completedOperations) {
        return this.executeOperation(operationId, params, {
            autoPrerequisites: false,
            prerequisiteParams: {},
            context: { executed: new Set(completedOperations) },
        });
    }
    async executeOperation(operationId, params, options) {
        const context = options.context || { executed: new Set() };
        if (options.autoPrerequisites) {
            const prerequisitesByOperation = {
                "createOrder": [],
                "payOrder": [
                    "createOrder",
                    "getOrder"
                ],
                "fulfillOrder": [
                    "payOrder",
                    "createOrder"
                ],
                "getOrder": []
            };
            const required = prerequisitesByOperation[operationId] || [];
            for (const prerequisiteOperationId of required) {
                if (context.executed.has(prerequisiteOperationId))
                    continue;
                const prerequisiteParams = options.prerequisiteParams[prerequisiteOperationId] || params;
                await this.executeOperation(prerequisiteOperationId, prerequisiteParams, {
                    autoPrerequisites: true,
                    prerequisiteParams: options.prerequisiteParams,
                    context,
                });
            }
        }
        const response = await this.callOperation(operationId, params);
        context.executed.add(operationId);
        return this.buildResourceInstance(operationId, response, context.executed, params);
    }
    async callOperation(operationId, params) {
        switch (operationId) {
            case "createOrder": {
                const requestPath = `/orders`;
                return this.httpClient.request("POST", requestPath, {
                    body: params.body,
                    headers: params.headers,
                });
            }
            case "payOrder": {
                const id = params["id"];
                if (!id) {
                    throw new Error("Missing required path parameter 'id'.");
                }
                const resolvedPathParams = { id, };
                const requestPath = `/orders/${resolvedPathParams["id"]}/pay`;
                return this.httpClient.request("POST", requestPath, {
                    body: params.body,
                    headers: params.headers,
                });
            }
            case "fulfillOrder": {
                const id = params["id"];
                if (!id) {
                    throw new Error("Missing required path parameter 'id'.");
                }
                const resolvedPathParams = { id, };
                const requestPath = `/orders/${resolvedPathParams["id"]}/fulfill`;
                return this.httpClient.request("POST", requestPath, {
                    body: params.body,
                    headers: params.headers,
                });
            }
            case "getOrder": {
                const id = params["id"];
                if (!id) {
                    throw new Error("Missing required path parameter 'id'.");
                }
                const resolvedPathParams = { id, };
                const requestPath = `/orders/${resolvedPathParams["id"]}`;
                return this.httpClient.request("GET", requestPath, {
                    body: params.body,
                    headers: params.headers,
                });
            }
            default:
                throw new Error(`Unknown operationId '${operationId}' for resource.`);
        }
    }
    buildResourceInstance(operationId, response, completedOperations, params) {
        const responseId = response?.id;
        const instanceId = responseId ?? params["id"];
        const completed = new Set(completedOperations);
        completed.add(operationId);
        switch (operationId) {
            case "createOrder":
                return new OrderCreated(this, instanceId, completed);
            case "payOrder":
                return new OrderPaid(this, instanceId, completed);
            case "fulfillOrder":
                return new OrderFulfilled(this, instanceId, completed);
            case "getOrder":
                return new OrderOrderObserved(this, instanceId, completed);
            default:
                return new OrderResourceInstance(this, instanceId, completed);
        }
    }
}
exports.OrderResource = OrderResource;
