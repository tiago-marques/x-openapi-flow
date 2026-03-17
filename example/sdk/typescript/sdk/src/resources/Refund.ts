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

export class RefundResourceInstance {
  constructor(
    protected readonly service: RefundResource,
    protected readonly id?: string,
    protected readonly completedOperations: Set<string> = new Set(),
  ) {}

  get resourceId(): string | undefined {
    return this.id;
  }
}

export class RefundRefundApproved extends RefundResourceInstance {
}

export class RefundRefundRequested extends RefundResourceInstance {
  async approve(params: OperationParams = {}): Promise<RefundRefundApproved> {
    ensurePrerequisites(this.completedOperations, ["createRefund"], "approve");
    const mergedParams: OperationParams = this.id ? { ...params, id: this.id } : { ...params };
    return this.service._executeTransition("approveRefund", mergedParams, this.completedOperations) as Promise<RefundRefundApproved>;
  }
}

export class RefundResource {
  constructor(private readonly httpClient: HttpClient) {}

  async create(params: OperationParams = {}): Promise<RefundRefundRequested> {
    const mergedParams: OperationParams = { ...params };
    return this.executeOperation("createRefund", mergedParams, { autoPrerequisites: false, prerequisiteParams: {}, context: undefined }) as Promise<RefundRefundRequested>;
  }

  async approve(id: string, params: OperationParams = {}, options: LifecycleOptions = {}): Promise<RefundRefundApproved> {
    const mergedParams: OperationParams = { ...params, id };
    return this.executeOperation("approveRefund", mergedParams, {
      autoPrerequisites: options.autoPrerequisites ?? true,
      prerequisiteParams: options.prerequisiteParams || {},
      context: options.context,
    }) as Promise<RefundRefundApproved>;
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
      "createRefund": [],
      "approveRefund": [
        "createRefund"
      ]
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

      case "createRefund": {
        const requestPath = `/refunds`;
        return this.httpClient.request("POST", requestPath, {
          body: params.body,
          headers: params.headers as Record<string, string> | undefined,
        });
      }

      case "approveRefund": {
        const id = params["id"] as string | undefined;
    if (!id) { throw new Error("Missing required path parameter 'id'."); }
    const resolvedPathParams = { id, };
    const requestPath = `/refunds/${resolvedPathParams["id"]}/approve`;
        return this.httpClient.request("POST", requestPath, {
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

      case "createRefund":
        return new RefundRefundRequested(this, instanceId, completed);
      case "approveRefund":
        return new RefundRefundApproved(this, instanceId, completed);

      default:

        return new RefundResourceInstance(this, instanceId, completed);

    }

  }
}
