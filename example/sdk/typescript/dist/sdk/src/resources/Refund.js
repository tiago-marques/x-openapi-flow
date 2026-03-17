"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefundResource = exports.RefundRefundRequested = exports.RefundRefundApproved = exports.RefundResourceInstance = void 0;
const ensurePrerequisites = (completedOperations, requiredOperationIds, methodName) => {
    const missing = requiredOperationIds.filter((operationId) => !completedOperations.has(operationId));
    if (missing.length > 0) {
        throw new Error(`Cannot call ${methodName} before prerequisites are satisfied: ${missing.join(", ")}`);
    }
};
class RefundResourceInstance {
    constructor(service, id, completedOperations = new Set()) {
        this.service = service;
        this.id = id;
        this.completedOperations = completedOperations;
    }
    get resourceId() {
        return this.id;
    }
}
exports.RefundResourceInstance = RefundResourceInstance;
class RefundRefundApproved extends RefundResourceInstance {
}
exports.RefundRefundApproved = RefundRefundApproved;
class RefundRefundRequested extends RefundResourceInstance {
    async approve(params = {}) {
        ensurePrerequisites(this.completedOperations, ["createRefund"], "approve");
        const mergedParams = this.id ? { ...params, id: this.id } : { ...params };
        return this.service._executeTransition("approveRefund", mergedParams, this.completedOperations);
    }
}
exports.RefundRefundRequested = RefundRefundRequested;
class RefundResource {
    constructor(httpClient) {
        this.httpClient = httpClient;
    }
    async create(params = {}) {
        const mergedParams = { ...params };
        return this.executeOperation("createRefund", mergedParams, { autoPrerequisites: false, prerequisiteParams: {}, context: undefined });
    }
    async approve(id, params = {}, options = {}) {
        const mergedParams = { ...params, id };
        return this.executeOperation("approveRefund", mergedParams, {
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
                "createRefund": [],
                "approveRefund": [
                    "createRefund"
                ]
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
            case "createRefund": {
                const requestPath = `/refunds`;
                return this.httpClient.request("POST", requestPath, {
                    body: params.body,
                    headers: params.headers,
                });
            }
            case "approveRefund": {
                const id = params["id"];
                if (!id) {
                    throw new Error("Missing required path parameter 'id'.");
                }
                const resolvedPathParams = { id, };
                const requestPath = `/refunds/${resolvedPathParams["id"]}/approve`;
                return this.httpClient.request("POST", requestPath, {
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
            case "createRefund":
                return new RefundRefundRequested(this, instanceId, completed);
            case "approveRefund":
                return new RefundRefundApproved(this, instanceId, completed);
            default:
                return new RefundResourceInstance(this, instanceId, completed);
        }
    }
}
exports.RefundResource = RefundResource;
