"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowApiClient = void 0;
const Order_1 = require("./resources/Order");
const Refund_1 = require("./resources/Refund");
class FlowApiClient {
    constructor(httpClient) {
        this.orders = new Order_1.OrderResource(httpClient);
        this.refunds = new Refund_1.RefundResource(httpClient);
    }
}
exports.FlowApiClient = FlowApiClient;
