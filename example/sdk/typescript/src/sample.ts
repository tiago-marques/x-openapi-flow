import { FlowApiClient } from "../sdk/src/index.js";
import { FetchHttpClient } from "../sdk/src/http-client.js";

async function main() {
  const httpClient = new FetchHttpClient("http://localhost:3000");
  const api = new FlowApiClient(httpClient);

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
