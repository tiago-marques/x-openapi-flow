"use strict";

const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
const { loadApi, extractFlows, buildStateGraph } = require("./validator");

const HTTP_METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

function splitWords(value) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

function toPascalCase(value) {
  return splitWords(value)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join("") || "Resource";
}

function toCamelCase(value) {
  const words = splitWords(value);
  if (words.length === 0) {
    return "resource";
  }

  return words
    .map((word, index) => {
      if (index === 0) return word;
      return word[0].toUpperCase() + word.slice(1);
    })
    .join("");
}

function singularize(value) {
  if (!value) return "resource";
  if (value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.endsWith("ses") || value.endsWith("xes")) return value.slice(0, -2);
  if (value.endsWith("s") && value.length > 1) return value.slice(0, -1);
  return value;
}

function parsePathSegments(pathKey) {
  return String(pathKey || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => ({
      raw: segment,
      value: segment.replace(/[{}]/g, ""),
      isParam: segment.startsWith("{") && segment.endsWith("}"),
    }));
}

function deriveResourceName(pathKey) {
  const firstNonParam = parsePathSegments(pathKey).find((segment) => !segment.isParam);
  return (firstNonParam && firstNonParam.value) || "resource";
}

function deriveMethodName(operationId, resourceName, pathKey, httpMethod) {
  const operationWords = splitWords(operationId || "");
  const singularResourceWords = splitWords(singularize(resourceName));
  const pluralResourceWords = splitWords(resourceName);

  const trimmed = operationWords.filter((word) => {
    return !singularResourceWords.includes(word) && !pluralResourceWords.includes(word);
  });

  if (trimmed.length > 0) {
    return toCamelCase(trimmed.join(" "));
  }

  const staticSegments = parsePathSegments(pathKey)
    .filter((segment) => !segment.isParam)
    .map((segment) => segment.value);

  if (staticSegments.length > 1) {
    return toCamelCase(staticSegments[staticSegments.length - 1]);
  }

  return httpMethod === "post" ? "create" : toCamelCase(httpMethod);
}

function parsePathParams(pathKey) {
  return parsePathSegments(pathKey)
    .filter((segment) => segment.isParam)
    .map((segment) => segment.value);
}

function buildPathTemplate(pathKey, paramSource) {
  return String(pathKey).replace(/\{([^}]+)\}/g, (_full, paramName) => `\${${paramSource}["${paramName}"]}`);
}

function classifyOperation(operation) {
  const segments = parsePathSegments(operation.path);
  const staticSegments = segments.filter((segment) => !segment.isParam).map((segment) => segment.value);
  const hasPrimaryResource = staticSegments[0] === operation.resourceName;

  if (hasPrimaryResource && segments.length === 1 && operation.httpMethod === "post") {
    return "create";
  }
  if (hasPrimaryResource && segments.length === 1 && operation.httpMethod === "get") {
    return "list";
  }
  if (
    hasPrimaryResource
    && segments.length === 2
    && segments[1].isParam
    && operation.httpMethod === "get"
  ) {
    return "retrieve";
  }
  if (
    hasPrimaryResource
    && segments.length === 2
    && segments[1].isParam
    && (operation.httpMethod === "put" || operation.httpMethod === "patch")
  ) {
    return "update";
  }
  if (
    hasPrimaryResource
    && segments.length === 2
    && segments[1].isParam
    && operation.httpMethod === "delete"
  ) {
    return "delete";
  }
  if (hasPrimaryResource && segments.length >= 3 && segments[1].isParam) {
    return "action";
  }

  return "custom";
}

function extractOpenApiOperations(api) {
  const operations = [];
  const paths = (api && api.paths) || {};

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) {
        continue;
      }

      const operationId = operation.operationId || `${method}_${pathKey.replace(/[^a-zA-Z0-9]+/g, "_")}`;
      const resourceName = deriveResourceName(pathKey);
      const methodName = deriveMethodName(operationId, resourceName, pathKey, method);
      const hasFlow = !!operation["x-openapi-flow"];

      operations.push({
        operationId,
        path: pathKey,
        httpMethod: method,
        flow: hasFlow ? operation["x-openapi-flow"] : null,
        hasFlow,
        resourceName,
        methodName,
        pathParams: parsePathParams(pathKey),
      });
    }
  }

  return operations.map((operation) => ({
    ...operation,
    kind: classifyOperation(operation),
  }));
}

function resolveNextOperationId(transition, flowOperationsByResource, resourceName) {
  if (transition.next_operation_id) {
    return transition.next_operation_id;
  }

  const resourceOperations = flowOperationsByResource.get(resourceName) || [];
  const byState = resourceOperations.find((operation) => operation.flow.current_state === transition.target_state);
  return byState ? byState.operationId : null;
}

function buildIntermediateModel(api) {
  const flows = extractFlows(api);
  const operations = extractOpenApiOperations(api);

  const operationsByResource = new Map();
  for (const operation of operations) {
    if (!operationsByResource.has(operation.resourceName)) {
      operationsByResource.set(operation.resourceName, []);
    }
    operationsByResource.get(operation.resourceName).push(operation);
  }

  const flowOperationsByResource = new Map();
  for (const [resourceName, resourceOperations] of operationsByResource.entries()) {
    flowOperationsByResource.set(
      resourceName,
      resourceOperations.filter((operation) => operation.hasFlow)
    );
  }

  const resources = [];

  for (const [resourceName, resourceOperations] of operationsByResource.entries()) {
    const flowOperations = resourceOperations.filter((operation) => operation.hasFlow);
    if (flowOperations.length === 0) {
      continue;
    }

    const operationsById = new Map(resourceOperations.map((operation) => [operation.operationId, operation]));

    const resourceFlows = flowOperations.map((operation) => ({
      endpoint: `${operation.httpMethod.toUpperCase()} ${operation.path}`,
      operation_id: operation.operationId,
      flow: operation.flow,
    }));

    const graph = buildStateGraph(resourceFlows);
    const initialStates = [...graph.nodes].filter((state) => (graph.indegree.get(state) || 0) === 0);
    const terminalStates = [...graph.nodes].filter((state) => (graph.outdegree.get(state) || 0) === 0);

    const incomingPrerequisites = new Map();
    const nextOperationsMap = new Map();

    for (const operation of flowOperations) {
      const transitions = Array.isArray(operation.flow.transitions) ? operation.flow.transitions : [];
      const nextOps = transitions
        .map((transition) => {
          const nextOperationId = resolveNextOperationId(transition, flowOperationsByResource, resourceName);
          if (!nextOperationId) {
            return null;
          }

          const prerequisiteSet = new Set([
            operation.operationId,
            ...((Array.isArray(transition.prerequisite_operation_ids)
              ? transition.prerequisite_operation_ids
              : [])),
          ]);

          if (!incomingPrerequisites.has(nextOperationId)) {
            incomingPrerequisites.set(nextOperationId, new Set());
          }
          prerequisiteSet.forEach((prereq) => incomingPrerequisites.get(nextOperationId).add(prereq));

          return {
            targetState: transition.target_state || null,
            triggerType: transition.trigger_type || null,
            nextOperationId,
            prerequisites: [...prerequisiteSet],
          };
        })
        .filter(Boolean);

      nextOperationsMap.set(operation.operationId, nextOps);
    }

    const operationModels = resourceOperations.map((operation) => ({
      operationId: operation.operationId,
      methodName: operation.methodName,
      helperMethodName: operation.kind === "action" ? operation.methodName : null,
      kind: operation.kind,
      httpMethod: operation.httpMethod,
      path: operation.path,
      pathParams: operation.pathParams,
      hasFlow: operation.hasFlow,
      currentState: operation.hasFlow ? operation.flow.current_state : null,
      prerequisites: [...(incomingPrerequisites.get(operation.operationId) || [])],
      nextOperations: operation.hasFlow ? (nextOperationsMap.get(operation.operationId) || []) : [],
    }));

    const stateSet = Array.from(
      new Set(flowOperations.map((operation) => operation.flow.current_state))
    ).sort();

    resources.push({
      resource: singularize(resourceName),
      resourcePlural: resourceName,
      resourceClassName: toPascalCase(singularize(resourceName)),
      resourcePropertyName: toCamelCase(resourceName),
      operations: operationModels,
      states: stateSet,
      prerequisites: operationModels.reduce((acc, operation) => {
        acc[operation.operationId] = operation.prerequisites;
        return acc;
      }, {}),
      nextOperations: operationModels.reduce((acc, operation) => {
        acc[operation.operationId] = operation.nextOperations;
        return acc;
      }, {}),
      graph: {
        initialStates,
        terminalStates,
        nodes: [...graph.nodes],
      },
    });
  }

  return {
    flowCount: flows.length,
    resources,
  };
}

function renderTemplate(templatePath, data) {
  const template = fs.readFileSync(templatePath, "utf8");
  return Handlebars.compile(template, { noEscape: true })(data);
}

function buildPathResolutionCode(pathParams, pathPattern, sourceVar) {
  if (pathParams.length === 0) {
    return `const requestPath = \`${pathPattern}\`;`;
  }

  const lines = [];
  for (const param of pathParams) {
    lines.push(`const ${param} = ${sourceVar}["${param}"] as string | undefined;`);
    lines.push(`if (!${param}) { throw new Error("Missing required path parameter '${param}'."); }`);
  }
  const mapping = pathParams.map((param) => `${param},`).join(" ");
  lines.push(`const resolvedPathParams = { ${mapping} };`);
  lines.push(`const requestPath = \`${buildPathTemplate(pathPattern, "resolvedPathParams")}\`;`);
  return lines.join("\n    ");
}

function buildOperationCallCase(operation) {
  const pathCode = buildPathResolutionCode(operation.pathParams, operation.path, "params");
  return [
    `      case "${operation.operationId}": {`,
    `        ${pathCode}`,
    `        return this.httpClient.request("${operation.httpMethod.toUpperCase()}", requestPath, {`,
    "          body: params.body,",
    "          headers: params.headers as Record<string, string> | undefined,",
    "        });",
    "      }",
  ].join("\n");
}

function buildServiceMethod(operation, returnType, defaults) {
  const needsId = operation.pathParams.includes("id");
  const args = [];
  if (needsId) {
    args.push("id: string");
  }
  args.push("params: OperationParams = {}");
  if (defaults.withLifecycleOptions) {
    args.push("options: LifecycleOptions = {}");
  }

  const mergedParamsLine = needsId
    ? "const mergedParams: OperationParams = { ...params, id };"
    : "const mergedParams: OperationParams = { ...params };";

  const lifecycleOptions = defaults.withLifecycleOptions
    ? `{
      autoPrerequisites: options.autoPrerequisites ?? ${defaults.autoPrerequisitesDefault ? "true" : "false"},
      prerequisiteParams: options.prerequisiteParams || {},
      context: options.context,
    }`
    : "{ autoPrerequisites: false, prerequisiteParams: {}, context: undefined }";

  return [
    `  async ${operation.methodName}(${args.join(", ")}): Promise<${returnType}> {`,
    `    ${mergedParamsLine}`,
    `    return this.executeOperation("${operation.operationId}", mergedParams, ${lifecycleOptions}) as Promise<${returnType}>;`,
    "  }",
  ].join("\n");
}

function buildTransitionMethod(transitionOperation, targetStateClassName) {
  const prerequisites = JSON.stringify(transitionOperation.prerequisites || []);
  const mergeId = transitionOperation.pathParams.includes("id")
    ? "const mergedParams: OperationParams = this.id ? { ...params, id: this.id } : { ...params };"
    : "const mergedParams: OperationParams = { ...params };";

  return [
    `  async ${transitionOperation.methodName}(params: OperationParams = {}): Promise<${targetStateClassName}> {`,
    `    ensurePrerequisites(this.completedOperations, ${prerequisites}, "${transitionOperation.methodName}");`,
    `    ${mergeId}`,
    `    return this.service._executeTransition("${transitionOperation.operationId}", mergedParams, this.completedOperations) as Promise<${targetStateClassName}>;`,
    "  }",
  ].join("\n");
}

function buildTypeScriptResourceCode(resourceModel) {
  const flowOperations = resourceModel.operations.filter((operation) => operation.hasFlow);
  const operationsById = new Map(resourceModel.operations.map((operation) => [operation.operationId, operation]));

  const stateClassNameByState = new Map(
    resourceModel.states.map((state) => [state, `${resourceModel.resourceClassName}${toPascalCase(state)}`])
  );

  const flowStateClassByOperationId = flowOperations.reduce((acc, operation) => {
    acc[operation.operationId] = stateClassNameByState.get(operation.currentState);
    return acc;
  }, {});

  const collectionMethods = [];

  const createOp = resourceModel.operations.find((operation) => operation.kind === "create");
  if (createOp) {
    const returnType = createOp.hasFlow
      ? flowStateClassByOperationId[createOp.operationId]
      : `${resourceModel.resourceClassName}ResourceInstance`;
    collectionMethods.push(
      buildServiceMethod(createOp, returnType, {
        withLifecycleOptions: false,
        autoPrerequisitesDefault: false,
      })
    );
  }

  const retrieveOp = resourceModel.operations.find((operation) => operation.kind === "retrieve");
  if (retrieveOp) {
    collectionMethods.push(
      buildServiceMethod(retrieveOp, `${resourceModel.resourceClassName}ResourceInstance`, {
        withLifecycleOptions: false,
        autoPrerequisitesDefault: false,
      })
    );
  }

  const listOp = resourceModel.operations.find((operation) => operation.kind === "list");
  if (listOp) {
    collectionMethods.push(
      buildServiceMethod(listOp, "unknown", {
        withLifecycleOptions: false,
        autoPrerequisitesDefault: false,
      })
    );
  }

  const helperMethods = [];
  const seenHelperNames = new Set(collectionMethods.map((method) => method.match(/async\s+([a-zA-Z0-9_]+)/)[1]));
  for (const operation of flowOperations) {
    if (seenHelperNames.has(operation.methodName)) {
      continue;
    }
    helperMethods.push(
      buildServiceMethod(operation, flowStateClassByOperationId[operation.operationId], {
        withLifecycleOptions: true,
        autoPrerequisitesDefault: true,
      })
    );
    seenHelperNames.add(operation.methodName);
  }

  const operationCallCases = resourceModel.operations.map(buildOperationCallCase).join("\n\n");

  const operationPrereqMap = JSON.stringify(resourceModel.prerequisites || {}, null, 2)
    .replace(/^/gm, "    ")
    .trimEnd();

  const stateFactoryCases = resourceModel.operations.map((operation) => {
    const className = operation.hasFlow
      ? flowStateClassByOperationId[operation.operationId]
      : `${resourceModel.resourceClassName}ResourceInstance`;
    return `      case "${operation.operationId}":\n        return new ${className}(this, instanceId, completed);`;
  }).join("\n");

  const transitionMethodsByState = new Map(resourceModel.states.map((state) => [state, []]));

  for (const flowOperation of flowOperations) {
    for (const transition of flowOperation.nextOperations || []) {
      const targetOperation = operationsById.get(transition.nextOperationId);
      if (!targetOperation || !targetOperation.hasFlow) {
        continue;
      }

      const sourceState = flowOperation.currentState;
      const targetStateClassName = stateClassNameByState.get(targetOperation.currentState);
      const stateMethods = transitionMethodsByState.get(sourceState) || [];

      if (stateMethods.some((methodCode) => methodCode.includes(`async ${targetOperation.methodName}(`))) {
        continue;
      }

      stateMethods.push(buildTransitionMethod(targetOperation, targetStateClassName));
      transitionMethodsByState.set(sourceState, stateMethods);
    }
  }

  const stateClassesCode = [
    `export class ${resourceModel.resourceClassName}ResourceInstance {`,
    "  constructor(",
    `    protected readonly service: ${resourceModel.resourceClassName}Resource,`,
    "    protected readonly id?: string,",
    "    protected readonly completedOperations: Set<string> = new Set(),",
    "  ) {}",
    "",
    "  get resourceId(): string | undefined {",
    "    return this.id;",
    "  }",
    "}",
  ];

  for (const stateName of resourceModel.states) {
    const className = stateClassNameByState.get(stateName);
    const methods = transitionMethodsByState.get(stateName) || [];
    stateClassesCode.push("");
    stateClassesCode.push(`export class ${className} extends ${resourceModel.resourceClassName}ResourceInstance {`);
    if (methods.length > 0) {
      stateClassesCode.push(methods.join("\n\n"));
    }
    stateClassesCode.push("}");
  }

  const sharedTypesCode = [
    "type OperationParams = {",
    "  body?: unknown;",
    "  headers?: Record<string, string>;",
    "  [key: string]: unknown;",
    "};",
    "",
    "type LifecycleContext = {",
    "  executed: Set<string>;",
    "};",
    "",
    "type LifecycleOptions = {",
    "  autoPrerequisites?: boolean;",
    "  prerequisiteParams?: Record<string, OperationParams>;",
    "  context?: LifecycleContext;",
    "};",
  ].join("\n");

  const serviceMethodsCode = [
    ...collectionMethods,
    ...helperMethods,
    "",
    `  async _executeTransition(operationId: string, params: OperationParams, completedOperations: Set<string>): Promise<unknown> {`,
    "    return this.executeOperation(operationId, params, {",
    "      autoPrerequisites: false,",
    "      prerequisiteParams: {},",
    "      context: { executed: new Set(completedOperations) },",
    "    });",
    "  }",
    "",
    "  private async executeOperation(",
    "    operationId: string,",
    "    params: OperationParams,",
    "    options: { autoPrerequisites: boolean; prerequisiteParams: Record<string, OperationParams>; context?: LifecycleContext },",
    "  ): Promise<unknown> {",
    "    const context = options.context || { executed: new Set<string>() };",
    "",
    "    if (options.autoPrerequisites) {",
    "      const prerequisitesByOperation: Record<string, string[]> =",
    `        ${operationPrereqMap || "{}"};`,
    "      const required = prerequisitesByOperation[operationId] || [];",
    "      for (const prerequisiteOperationId of required) {",
    "        if (context.executed.has(prerequisiteOperationId)) continue;",
    "        const prerequisiteParams = options.prerequisiteParams[prerequisiteOperationId] || params;",
    "        await this.executeOperation(prerequisiteOperationId, prerequisiteParams, {",
    "          autoPrerequisites: true,",
    "          prerequisiteParams: options.prerequisiteParams,",
    "          context,",
    "        });",
    "      }",
    "    }",
    "",
    "    const response = await this.callOperation(operationId, params);",
    "    context.executed.add(operationId);",
    "    return this.buildResourceInstance(operationId, response, context.executed, params);",
    "  }",
    "",
    "  private async callOperation(operationId: string, params: OperationParams): Promise<unknown> {",
    "    switch (operationId) {",
    operationCallCases,
    "      default:",
    "        throw new Error(`Unknown operationId '${operationId}' for resource.`);",
    "    }",
    "  }",
    "",
    "  private buildResourceInstance(",
    "    operationId: string,",
    "    response: unknown,",
    "    completedOperations: Set<string>,",
    "    params: OperationParams,",
    "  ): unknown {",
    "    const responseId = (response as { id?: string } | undefined)?.id;",
    "    const instanceId = responseId ?? (params[\"id\"] as string | undefined);",
    "    const completed = new Set(completedOperations);",
    "    completed.add(operationId);",
    "",
    "    switch (operationId) {",
    stateFactoryCases,
    "      default:",
    `        return new ${resourceModel.resourceClassName}ResourceInstance(this, instanceId, completed);`,
    "    }",
    "  }",
  ].join("\n\n");

  return {
    resourceClassName: resourceModel.resourceClassName,
    sharedTypesCode,
    stateClassesCode: stateClassesCode.join("\n"),
    serviceMethodsCode,
  };
}

function generateTypeScriptSdk(intermediateModel, outputDir) {
  const templateRoot = path.join(__dirname, "..", "templates", "typescript");
  const srcDir = path.join(outputDir, "src");
  const resourcesDir = path.join(srcDir, "resources");

  fs.mkdirSync(resourcesDir, { recursive: true });

  for (const resourceModel of intermediateModel.resources) {
    const resourceTemplateData = buildTypeScriptResourceCode(resourceModel);
    const resourceOutput = renderTemplate(path.join(templateRoot, "resource.hbs"), resourceTemplateData);
    fs.writeFileSync(
      path.join(resourcesDir, `${resourceModel.resourceClassName}.ts`),
      `${resourceOutput.trimEnd()}\n`,
      "utf8"
    );
  }

  const indexOutput = renderTemplate(path.join(templateRoot, "index.hbs"), {
    resources: intermediateModel.resources,
  });
  fs.writeFileSync(path.join(srcDir, "index.ts"), `${indexOutput.trimEnd()}\n`, "utf8");

  const httpClientOutput = renderTemplate(path.join(templateRoot, "http-client.hbs"), {});
  fs.writeFileSync(path.join(srcDir, "http-client.ts"), `${httpClientOutput.trimEnd()}\n`, "utf8");

  const helpersOutput = renderTemplate(path.join(templateRoot, "flow-helpers.hbs"), {});
  fs.writeFileSync(path.join(srcDir, "flow-helpers.ts"), `${helpersOutput.trimEnd()}\n`, "utf8");

  fs.writeFileSync(
    path.join(outputDir, "flow-model.json"),
    `${JSON.stringify(intermediateModel, null, 2)}\n`,
    "utf8"
  );
}

function generateSdk(options) {
  const apiPath = path.resolve(options.apiPath);
  const outputDir = path.resolve(options.outputDir);
  const language = options.language || "typescript";

  if (language !== "typescript") {
    throw new Error(`Unsupported language '${language}'. MVP currently supports only 'typescript'.`);
  }

  const api = loadApi(apiPath);
  const model = buildIntermediateModel(api);

  if (model.resources.length === 0) {
    throw new Error("No x-openapi-flow operations found. Add x-openapi-flow metadata before generating an SDK.");
  }

  generateTypeScriptSdk(model, outputDir);

  return {
    language,
    outputDir,
    flowCount: model.flowCount,
    resourceCount: model.resources.length,
    resources: model.resources.map((resource) => ({
      name: resource.resourceClassName,
      operations: resource.operations.length,
      states: resource.states.length,
      initialStates: resource.graph.initialStates,
    })),
  };
}

module.exports = {
  buildIntermediateModel,
  generateSdk,
};
