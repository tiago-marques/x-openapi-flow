import type { HttpClient, RequestOptions } from "../http-client";

const ensurePrerequisites = (
  completedOperations: Set<string>,
  requiredOperationIds: string[],
  methodName: string,
): void => {
  const missing = requiredOperationIds.filter((operationId) => !completedOperations.has(operationId));
  if (missing.length > 0) {
    throw new Error(
      `Cannot call ${methodName} before prerequisites are satisfied: ${missing.join(", ")}`,
    );
  }
};

type OperationParams = {
  body?: unknown;
  headers?: Record<string, string>;
  [key: string]: unknown;
};

type LifecycleContext = {
  executed: Set<string>;
};

type LifecycleOptions = {
  autoPrerequisites?: boolean;
  prerequisiteParams?: Record<string, OperationParams>;
  context?: LifecycleContext;
};

export class OrderResourceInstance {
  constructor(
    protected readonly service: OrderResource,
    protected readonly id?: string,
    protected readonly completedOperations: Set<string> = new Set(),
  ) {}

  get resourceId(): string | undefined {
    return this.id;
  }
}

export class OrderCreated extends OrderResourceInstance {
  async pay(params: OperationParams = {}): Promise<OrderPaid> {
    ensurePrerequisites(this.completedOperations, ["createOrder","getOrder"], "pay");
    const mergedParams: OperationParams = this.id ? { ...params, id: this.id } : { ...params };
    return this.service._executeTransition("payOrder", mergedParams, this.completedOperations) as Promise<OrderPaid>;
  }
}

export class OrderFulfilled extends OrderResourceInstance {
}

export class OrderOrderObserved extends OrderResourceInstance {
  async pay(params: OperationParams = {}): Promise<OrderPaid> {
    ensurePrerequisites(this.completedOperations, ["createOrder","getOrder"], "pay");
    const mergedParams: OperationParams = this.id ? { ...params, id: this.id } : { ...params };
    return this.service._executeTransition("payOrder", mergedParams, this.completedOperations) as Promise<OrderPaid>;
  }
}

export class OrderPaid extends OrderResourceInstance {
  async fulfill(params: OperationParams = {}): Promise<OrderFulfilled> {
    ensurePrerequisites(this.completedOperations, ["payOrder","createOrder"], "fulfill");
    const mergedParams: OperationParams = this.id ? { ...params, id: this.id } : { ...params };
    return this.service._executeTransition("fulfillOrder", mergedParams, this.completedOperations) as Promise<OrderFulfilled>;
  }
}

export class OrderResource {
  constructor(private readonly httpClient: HttpClient) {}

  async create(params: OperationParams = {}): Promise<OrderCreated> {
    const mergedParams: OperationParams = { ...params };
    return this.executeOperation("createOrder", mergedParams, { autoPrerequisites: false, prerequisiteParams: {}, context: undefined }) as Promise<OrderCreated>;
  }

  async get(id: string, params: OperationParams = {}): Promise<OrderResourceInstance> {
    const mergedParams: OperationParams = { ...params, id };
    return this.executeOperation("getOrder", mergedParams, { autoPrerequisites: false, prerequisiteParams: {}, context: undefined }) as Promise<OrderResourceInstance>;
  }

  async pay(id: string, params: OperationParams = {}, options: LifecycleOptions = {}): Promise<OrderPaid> {
    const mergedParams: OperationParams = { ...params, id };
    return this.executeOperation("payOrder", mergedParams, {
      autoPrerequisites: options.autoPrerequisites ?? true,
      prerequisiteParams: options.prerequisiteParams || {},
      context: options.context,
    }) as Promise<OrderPaid>;
  }

  async fulfill(id: string, params: OperationParams = {}, options: LifecycleOptions = {}): Promise<OrderFulfilled> {
    const mergedParams: OperationParams = { ...params, id };
    return this.executeOperation("fulfillOrder", mergedParams, {
      autoPrerequisites: options.autoPrerequisites ?? true,
      prerequisiteParams: options.prerequisiteParams || {},
      context: options.context,
    }) as Promise<OrderFulfilled>;
  }



  async _executeTransition(operationId: string, params: OperationParams, completedOperations: Set<string>): Promise<unknown> {

    return this.executeOperation(operationId, params, {

      autoPrerequisites: false,

      prerequisiteParams: {},

      context: { executed: new Set(completedOperations) },

    });

  }



  private async executeOperation(

    operationId: string,

    params: OperationParams,

    options: { autoPrerequisites: boolean; prerequisiteParams: Record<string, OperationParams>; context?: LifecycleContext },

  ): Promise<unknown> {

    const context = options.context || { executed: new Set<string>() };



    if (options.autoPrerequisites) {

      const prerequisitesByOperation: Record<string, string[]> =

            {
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

        if (context.executed.has(prerequisiteOperationId)) continue;

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



  private async callOperation(operationId: string, params: OperationParams): Promise<unknown> {

    switch (operationId) {

      case "createOrder": {
        const requestPath = `/orders`;
        return this.httpClient.request("POST", requestPath, {
          body: params.body,
          headers: params.headers as Record<string, string> | undefined,
        });
      }

      case "payOrder": {
        const id = params["id"] as string | undefined;
    if (!id) { throw new Error("Missing required path parameter 'id'."); }
    const resolvedPathParams = { id, };
    const requestPath = `/orders/${resolvedPathParams["id"]}/pay`;
        return this.httpClient.request("POST", requestPath, {
          body: params.body,
          headers: params.headers as Record<string, string> | undefined,
        });
      }

      case "fulfillOrder": {
        const id = params["id"] as string | undefined;
    if (!id) { throw new Error("Missing required path parameter 'id'."); }
    const resolvedPathParams = { id, };
    const requestPath = `/orders/${resolvedPathParams["id"]}/fulfill`;
        return this.httpClient.request("POST", requestPath, {
          body: params.body,
          headers: params.headers as Record<string, string> | undefined,
        });
      }

      case "getOrder": {
        const id = params["id"] as string | undefined;
    if (!id) { throw new Error("Missing required path parameter 'id'."); }
    const resolvedPathParams = { id, };
    const requestPath = `/orders/${resolvedPathParams["id"]}`;
        return this.httpClient.request("GET", requestPath, {
          body: params.body,
          headers: params.headers as Record<string, string> | undefined,
        });
      }

      default:

        throw new Error(`Unknown operationId '${operationId}' for resource.`);

    }

  }



  private buildResourceInstance(

    operationId: string,

    response: unknown,

    completedOperations: Set<string>,

    params: OperationParams,

  ): unknown {

    const responseId = (response as { id?: string } | undefined)?.id;

    const instanceId = responseId ?? (params["id"] as string | undefined);

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
