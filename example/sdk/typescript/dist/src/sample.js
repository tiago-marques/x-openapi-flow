"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("../sdk/src/index.js");
const http_client_js_1 = require("../sdk/src/http-client.js");
async function main() {
    const httpClient = new http_client_js_1.FetchHttpClient("http://localhost:3000");
    const api = new index_js_1.FlowApiClient(httpClient);
    // Example flow-oriented call sequence. It will only work when your API is running.
    const order = await api.orders.create({
        body: {
            customer_id: "cust_001",
            amount: 120.5,
        },
    });
    console.log("Order resource id", order.resourceId);
}
main().catch((error) => {
    console.error("Sample failed", error);
    throw error;
});
