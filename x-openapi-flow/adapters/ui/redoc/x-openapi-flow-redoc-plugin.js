(function () {
  "use strict";

  function createSectionTitle(text) {
    var title = document.createElement("h3");
    title.textContent = text;
    title.style.margin = "16px 0 8px";
    title.style.fontSize = "14px";
    title.style.fontWeight = "700";
    return title;
  }

  function listItem(text) {
    var item = document.createElement("li");
    item.textContent = text;
    item.style.marginBottom = "6px";
    return item;
  }

  function renderMermaidText(resource) {
    var lines = ["stateDiagram-v2", "  direction LR"];

    var states = Array.from(new Set((resource.states || []).filter(Boolean))).sort();
    states.forEach(function (state) {
      lines.push("  state " + state);
    });

    (resource.operations || []).forEach(function (operation) {
      (operation.nextOperations || []).forEach(function (next) {
        if (!operation.currentState || !next.targetState) return;
        var label = next.nextOperationId || operation.operationId;
        lines.push("  " + operation.currentState + " --> " + next.targetState + ": " + label);
      });
    });

    return lines.join("\n");
  }

  function renderResourceBlock(resource) {
    var container = document.createElement("div");
    container.style.border = "1px solid #e5e7eb";
    container.style.borderRadius = "8px";
    container.style.padding = "12px";
    container.style.marginBottom = "14px";

    var title = document.createElement("h4");
    title.textContent = (resource.resourcePlural || resource.resource || "Resource") + " Lifecycle";
    title.style.margin = "0 0 8px";
    title.style.fontSize = "13px";
    container.appendChild(title);

    var mermaid = document.createElement("pre");
    mermaid.textContent = renderMermaidText(resource);
    mermaid.style.background = "#f8fafc";
    mermaid.style.border = "1px solid #e2e8f0";
    mermaid.style.padding = "8px";
    mermaid.style.borderRadius = "6px";
    mermaid.style.whiteSpace = "pre-wrap";
    mermaid.style.fontSize = "11px";
    container.appendChild(mermaid);

    var operationsTitle = createSectionTitle("Operations");
    operationsTitle.style.marginTop = "10px";
    operationsTitle.style.fontSize = "12px";
    container.appendChild(operationsTitle);

    var opList = document.createElement("ul");
    opList.style.paddingLeft = "16px";

    (resource.operations || []).forEach(function (operation) {
      if (!operation.hasFlow) return;
      var prerequisites = (operation.prerequisites || []).length > 0
        ? operation.prerequisites.join(", ")
        : "-";
      var nextOps = (operation.nextOperations || [])
        .map(function (next) { return next.nextOperationId; })
        .filter(Boolean);
      var nextText = nextOps.length > 0 ? nextOps.join(", ") : "-";

      opList.appendChild(
        listItem(
          operation.operationId
          + " | state=" + (operation.currentState || "-")
          + " | prerequisites=" + prerequisites
          + " | next=" + nextText
        )
      );
    });

    container.appendChild(opList);
    return container;
  }

  function mount(options) {
    var model = options && options.model;
    if (!model || !Array.isArray(model.resources) || model.resources.length === 0) {
      return;
    }

    var target = document.querySelector(options.targetSelector || "#x-openapi-flow-panel");
    if (!target) {
      return;
    }

    target.innerHTML = "";

    var heading = document.createElement("h2");
    heading.textContent = "Flow / Lifecycle";
    heading.style.margin = "0 0 8px";
    heading.style.fontSize = "18px";
    target.appendChild(heading);

    var subtitle = document.createElement("p");
    subtitle.textContent = "Generated from x-openapi-flow metadata.";
    subtitle.style.margin = "0 0 12px";
    subtitle.style.color = "#4b5563";
    target.appendChild(subtitle);

    model.resources.forEach(function (resource) {
      target.appendChild(renderResourceBlock(resource));
    });
  }

  window.XOpenApiFlowRedocPlugin = {
    mount: mount,
  };
})();
