import type { HttpClient } from "./http-client";
import { OrderResource } from "./resources/Order";
import { RefundResource } from "./resources/Refund";

export class FlowApiClient {
  public readonly orders: OrderResource;
  public readonly refunds: RefundResource;

  constructor(httpClient: HttpClient) {
    this.orders = new OrderResource(httpClient);
    this.refunds = new RefundResource(httpClient);
  }
}
