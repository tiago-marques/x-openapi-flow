(function () {
  "use strict";

  var VIEW_REFERENCE = "reference";
  var VIEW_FLOW = "flow";
  var STYLE_ID = "x-openapi-flow-redoc-style";
  var jumpFeedbackTimeoutId = null;
  var mermaidLoaderPromise = null;

  function text(value) {
    if (value === null || value === undefined || value === "") return "-";
    if (Array.isArray(value)) return value.length ? value.join(", ") : "-";
    return String(value);
  }

  function escapeHtml(value) {
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function slugify(value) {
    return text(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item";
  }

  function normalizeText(value) {
    return text(value)
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function getPrerequisiteOperationIds(nextOperation) {
    if (!nextOperation || typeof nextOperation !== "object") return [];
    if (Array.isArray(nextOperation.prerequisites)) {
      return nextOperation.prerequisites.filter(Boolean);
    }
    return [];
  }

  function flattenOperations(model) {
    var operations = [];

    ((model && model.resources) || []).forEach(function (resource) {
      ((resource && resource.operations) || []).forEach(function (operation) {
        if (!operation || !operation.hasFlow) return;
        operations.push({
          resource: resource,
          operation: operation,
        });
      });
    });

    return operations;
  }

  function findOperationInModel(model, operationId) {
    var entries = flattenOperations(model);
    for (var index = 0; index < entries.length; index += 1) {
      if (entries[index].operation.operationId === operationId) {
        return entries[index];
      }
    }
    return null;
  }

  function operationElementId(operationId) {
    return "xofr-op-" + slugify(operationId);
  }

  function buildOverviewMermaid(model) {
    var lines = ["stateDiagram-v2", "  direction LR"];
    var statesByName = new Map();
    var seen = new Set();
    var edgeLines = [];
    var stateCounter = 0;

    function getStateId(stateName) {
      var normalized = text(stateName);
      if (statesByName.has(normalized)) {
        return statesByName.get(normalized);
      }

      stateCounter += 1;
      var safeBase = normalized
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      var candidate = safeBase ? "s_" + safeBase + "_" + stateCounter : "s_state_" + stateCounter;
      statesByName.set(normalized, candidate);
      return candidate;
    }

    function sanitizeLabel(label) {
      return text(label)
        .replace(/[|]/g, " / ")
        .replace(/[\n\r]+/g, " ")
        .replace(/\"/g, "'")
        .trim();
    }

    flattenOperations(model).forEach(function (entry) {
      var operation = entry.operation;
      var current = text(operation.currentState);
      if (!current || current === "-") return;

      var fromId = getStateId(current);
      (operation.nextOperations || []).forEach(function (nextOperation) {
        var target = text(nextOperation.targetState);
        if (!target || target === "-") return;

        var toId = getStateId(target);
        var labelParts = [];
        if (nextOperation.nextOperationId) {
          labelParts.push("next " + text(nextOperation.nextOperationId));
        }
        var prerequisiteOperationIds = getPrerequisiteOperationIds(nextOperation);
        if (prerequisiteOperationIds.length) {
          labelParts.push("requires " + prerequisiteOperationIds.join(","));
        }

        var label = sanitizeLabel(labelParts.join(" / "));
        var key = fromId + "::" + toId + "::" + label;
        if (seen.has(key)) return;
        seen.add(key);
        edgeLines.push("  " + fromId + " --> " + toId + (label ? ": " + label : ""));
      });
    });

    statesByName.forEach(function (stateId, stateName) {
      lines.push("  state \"" + stateName.replace(/\"/g, "'") + "\" as " + stateId);
    });

    lines.push.apply(lines, edgeLines);
    return lines.join("\n");
  }

  function hasOverviewTransitions(model) {
    return flattenOperations(model).some(function (entry) {
      return Array.isArray(entry.operation.nextOperations) && entry.operation.nextOperations.length > 0;
    });
  }

  function getMermaidFallbackMessage() {
    return "Could not render Mermaid image. Check CDN/network access or load mermaid manually before ReDoc.";
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = ""
      + ".xofr-stack{display:flex;flex-direction:column;gap:18px;}"
      + ".xofr-overview,.xofr-resource{border:1px solid #d1d5db;border-radius:20px;background:#fff;box-shadow:0 18px 40px rgba(15,23,42,.06);}"
      + ".xofr-overview{padding:22px;}"
      + ".xofr-resource{padding:20px;}"
      + ".xofr-heading{margin:0 0 8px;font-size:30px;line-height:1.1;}"
      + ".xofr-subtitle{margin:0 0 22px;color:#4b5563;font-size:15px;line-height:1.5;}"
      + ".xofr-overview-head,.xofr-resource-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;}"
      + ".xofr-resource-title{margin:0;font-size:20px;line-height:1.2;}"
      + ".xofr-resource-sub{margin:6px 0 0;color:#4b5563;font-size:13px;line-height:1.45;}"
      + ".xofr-chips{display:flex;gap:8px;flex-wrap:wrap;}"
      + ".xofr-chip{display:inline-flex;align-items:center;min-height:30px;padding:0 12px;border-radius:999px;background:#ecfeff;color:#155e75;font-size:12px;font-weight:700;}"
      + ".xofr-overview-graph-wrap{display:flex;justify-content:center;align-items:flex-start;margin-top:14px;max-height:380px;overflow:auto;border:1px solid #cbd5e1;border-radius:16px;background:#fff;padding:12px;}"
      + ".xofr-overview img{max-width:100%;height:auto;}"
      + ".xofr-source-toggle{margin-top:12px;}"
      + ".xofr-source-toggle summary{cursor:pointer;font-weight:700;color:#0f766e;}"
      + ".xofr-code{margin-top:8px;padding:12px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono',monospace;font-size:11px;line-height:1.45;white-space:pre-wrap;overflow:auto;}"
      + ".xofr-empty{color:#6b7280;font-style:italic;}"
      + ".xofr-resource-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-top:18px;}"
      + ".xofr-operation-card{border:1px solid #dbe4ea;border-radius:18px;background:linear-gradient(180deg,#fff,#f8fafc);padding:16px;box-shadow:0 10px 24px rgba(15,23,42,.05);scroll-margin-top:96px;}"
      + ".xofr-operation-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px;}"
      + ".xofr-operation-title{margin:0;font-size:16px;line-height:1.25;}"
      + ".xofr-operation-endpoint{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0 0;}"
      + ".xofr-method{display:inline-flex;align-items:center;justify-content:center;min-width:56px;min-height:28px;padding:0 10px;border-radius:999px;background:#0f766e;color:#fff;font-size:12px;font-weight:700;text-transform:uppercase;}"
      + ".xofr-path{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono',monospace;font-size:12px;color:#0f172a;word-break:break-word;}"
      + ".xofr-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;}"
      + ".xofr-button{border:1px solid #cbd5e1;background:#fff;color:#0f172a;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer;}"
      + ".xofr-button:hover{border-color:#0f766e;color:#0f766e;}"
      + ".xofr-button:focus-visible{outline:2px solid #0f766e;outline-offset:2px;}"
      + ".xofr-meta{display:grid;grid-template-columns:130px 1fr;gap:6px 10px;font-size:12px;margin-top:12px;}"
      + ".xofr-meta-label{color:#6b7280;}"
      + ".xofr-section-title{margin:14px 0 8px;font-size:12px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:.04em;}"
      + ".xofr-list{margin:0;padding-left:18px;}"
      + ".xofr-list li{margin:6px 0;line-height:1.5;}"
      + ".xofr-inline-actions{display:inline-flex;gap:6px;flex-wrap:wrap;margin-left:8px;vertical-align:middle;}"
      + ".xofr-inline-link{border:0;background:none;color:#0f766e;padding:0;font-size:11px;font-weight:700;text-decoration:underline;text-underline-offset:2px;cursor:pointer;}"
      + ".xofr-inline-link:hover{opacity:.9;text-decoration-thickness:2px;}"
      + ".xofr-mini-graph{padding:12px;border-radius:14px;background:#f8fafc;border:1px dashed #cbd5e1;}"
      + ".xofr-edge{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono',monospace;font-size:12px;line-height:1.45;white-space:pre-wrap;}"
      + "@keyframes xofr-target-pulse{0%{box-shadow:0 0 0 0 rgba(15,118,110,.35);}100%{box-shadow:0 0 0 12px rgba(15,118,110,0);}}"
      + ".xofr-jump-target{animation:xofr-target-pulse .95s ease-out 1;border-color:#0f766e !important;}"
      + ".xofr-jump-feedback{position:fixed;right:16px;bottom:16px;z-index:9999;max-width:380px;border:1px solid rgba(15,23,42,.22);border-radius:10px;background:rgba(15,23,42,.92);color:#fff;padding:9px 12px;font-size:12px;line-height:1.4;box-shadow:0 10px 24px rgba(0,0,0,.18);}" 
      + "@media (max-width: 720px){.xofr-overview,.xofr-resource{padding:16px;}.xofr-heading{font-size:26px;}.xofr-resource-grid{grid-template-columns:1fr;}.xofr-meta{grid-template-columns:1fr;}}";

    document.head.appendChild(style);
  }

  function renderInlineOperationButtons(operationIds, attributeName, className, labelPrefix) {
    if (!Array.isArray(operationIds) || operationIds.length === 0) return "";

    return "<span class=\"xofr-inline-actions\">" + operationIds.map(function (operationId) {
      return "<button class=\"" + className + "\" data-" + attributeName + "=\"" + escapeHtml(operationId) + "\" type=\"button\">" + escapeHtml(labelPrefix ? labelPrefix + operationId : operationId) + "</button>";
    }).join("") + "</span>";
  }

  function renderTransitionList(operation) {
    var transitions = Array.isArray(operation.nextOperations) ? operation.nextOperations : [];
    if (!transitions.length) {
      return "<div class=\"xofr-empty\">No transitions (terminal state)</div>";
    }

    return "<ul class=\"xofr-list\">" + transitions.map(function (nextOperation) {
      var prerequisiteOperationIds = getPrerequisiteOperationIds(nextOperation);
      var nextOperationId = nextOperation.nextOperationId ? [nextOperation.nextOperationId] : [];
      return "<li><strong>" + escapeHtml(nextOperation.triggerType || "-") + "</strong> -> <strong>" + escapeHtml(nextOperation.targetState || "-") + "</strong>"
        + (nextOperationId.length ? renderInlineOperationButtons(nextOperationId, "xofr-flow-jump", "xofr-inline-link", "next: ") : "")
        + (nextOperationId.length ? renderInlineOperationButtons(nextOperationId, "xofr-reference", "xofr-inline-link", "ref: ") : "")
        + (prerequisiteOperationIds.length ? renderInlineOperationButtons(prerequisiteOperationIds, "xofr-flow-jump", "xofr-inline-link", "requires: ") : "")
        + "</li>";
    }).join("") + "</ul>";
  }

  function renderMiniGraph(operation) {
    var transitions = Array.isArray(operation.nextOperations) ? operation.nextOperations : [];
    if (!transitions.length) {
      return "<div class=\"xofr-edge\">" + escapeHtml(operation.currentState) + " [terminal]</div>";
    }

    return transitions.map(function (nextOperation) {
      return "<div class=\"xofr-edge\">" + escapeHtml(operation.currentState)
        + " --> " + escapeHtml(nextOperation.targetState)
        + " [" + escapeHtml(nextOperation.triggerType || "-") + "]</div>";
    }).join("");
  }

  function renderOperationCard(operation) {
    var referenceLabel = text(operation.httpMethod).toUpperCase() + " " + text(operation.path);
    var prerequisiteOperationIds = Array.isArray(operation.prerequisites) ? operation.prerequisites : [];
    var nextOperationIds = (operation.nextOperations || []).map(function (nextOperation) {
      return nextOperation.nextOperationId;
    }).filter(Boolean);

    return ""
      + "<article class=\"xofr-operation-card\" id=\"" + operationElementId(operation.operationId) + "\" data-xofr-operation=\"" + escapeHtml(operation.operationId) + "\">"
      + "<div class=\"xofr-operation-top\">"
      + "<div>"
      + "<h3 class=\"xofr-operation-title\">" + escapeHtml(operation.operationId) + "</h3>"
      + "<div class=\"xofr-operation-endpoint\">"
      + "<span class=\"xofr-method\">" + escapeHtml(operation.httpMethod || "-") + "</span>"
      + "<span class=\"xofr-path\">" + escapeHtml(operation.path || "-") + "</span>"
      + "</div>"
      + "</div>"
      + "</div>"
      + "<div class=\"xofr-actions\">"
      + "<button class=\"xofr-button\" type=\"button\" data-xofr-reference=\"" + escapeHtml(operation.operationId) + "\">View in API Reference</button>"
      + (nextOperationIds.length ? "<button class=\"xofr-button\" type=\"button\" data-xofr-flow-jump=\"" + escapeHtml(nextOperationIds[0]) + "\">Jump to next operation</button>" : "")
      + "</div>"
      + "<div class=\"xofr-meta\">"
      + "<div class=\"xofr-meta-label\">kind</div><div>" + escapeHtml(operation.kind || "-") + "</div>"
      + "<div class=\"xofr-meta-label\">current_state</div><div>" + escapeHtml(operation.currentState || "-") + "</div>"
      + "<div class=\"xofr-meta-label\">prerequisites</div><div>" + escapeHtml(prerequisiteOperationIds) + "</div>"
      + "<div class=\"xofr-meta-label\">reference</div><div>" + escapeHtml(referenceLabel) + "</div>"
      + "</div>"
      + "<div class=\"xofr-section-title\">Transitions</div>"
      + renderTransitionList(operation)
      + "<div class=\"xofr-section-title\">Operation graph</div>"
      + "<div class=\"xofr-mini-graph\">" + renderMiniGraph(operation) + "</div>"
      + "</article>";
  }

  function renderResourceBlock(resource) {
    var operations = ((resource && resource.operations) || []).filter(function (operation) {
      return operation && operation.hasFlow;
    });

    return ""
      + "<section class=\"xofr-resource\">"
      + "<div class=\"xofr-resource-head\">"
      + "<div>"
      + "<h2 class=\"xofr-resource-title\">" + escapeHtml(resource.resourcePlural || resource.resource || "Resource") + " Lifecycle</h2>"
      + "<p class=\"xofr-resource-sub\">Detailed operation cards with transition helpers and API reference links.</p>"
      + "</div>"
      + "<div class=\"xofr-chips\">"
      + "<span class=\"xofr-chip\">operations: " + escapeHtml(operations.length) + "</span>"
      + "<span class=\"xofr-chip\">states: " + escapeHtml((resource.states || []).length) + "</span>"
      + "</div>"
      + "</div>"
      + "<div class=\"xofr-resource-grid\">" + operations.map(renderOperationCard).join("") + "</div>"
      + "</section>";
  }

  function renderOverviewShell(model) {
    var flowCount = model && model.flowCount ? model.flowCount : 0;
    var resourceCount = Array.isArray(model && model.resources) ? model.resources.length : 0;
    return ""
      + "<section class=\"xofr-overview\">"
      + "<div class=\"xofr-overview-head\">"
      + "<div>"
      + "<h2 class=\"xofr-resource-title\">Flow Overview</h2>"
      + "<p class=\"xofr-resource-sub\">Mermaid overview plus endpoint-level lifecycle cards, aligned with the Swagger UI experience.</p>"
      + "</div>"
      + "<div class=\"xofr-chips\">"
      + "<span class=\"xofr-chip\">resources: " + escapeHtml(resourceCount) + "</span>"
      + "<span class=\"xofr-chip\">flow definitions: " + escapeHtml(flowCount) + "</span>"
      + "</div>"
      + "</div>"
      + "<div id=\"xofr-overview-body\" class=\"xofr-overview-body\"></div>"
      + "</section>";
  }

  function normalizeViewName(viewName) {
    return viewName === VIEW_FLOW ? VIEW_FLOW : VIEW_REFERENCE;
  }

  function readHashView() {
    if (!window.location || typeof window.location.hash !== "string") {
      return null;
    }

    var hash = window.location.hash.replace(/^#/, "").trim();
    if (!hash) {
      return null;
    }

    return normalizeViewName(hash);
  }

  function updateNavItemState(navItem, isActive) {
    if (navItem.classList && typeof navItem.classList.toggle === "function") {
      navItem.classList.toggle("is-active", isActive);
    } else if (typeof navItem.className === "string") {
      var nextClassName = navItem.className.replace(/\bis-active\b/g, "").replace(/\s+/g, " ").trim();
      navItem.className = isActive ? (nextClassName + " is-active").trim() : nextClassName;
    }

    navItem.setAttribute("aria-current", isActive ? "page" : "false");
  }

  function setActiveView(viewName, views, navItems) {
    var activeViewName = normalizeViewName(viewName);

    views.forEach(function (view) {
      var isActive = view.getAttribute("data-x-openapi-flow-view") === activeViewName;
      view.hidden = !isActive;
      view.style.display = isActive ? "" : "none";
    });

    navItems.forEach(function (navItem) {
      var isActive = navItem.getAttribute("data-x-openapi-flow-target") === activeViewName;
      updateNavItemState(navItem, isActive);
    });
  }

  function setView(viewName, context) {
    var normalized = normalizeViewName(viewName);
    if (window.location) {
      window.location.hash = normalized;
    }
    setActiveView(normalized, context.views, context.navItems);
  }

  function highlightElement(element) {
    if (!element || !element.classList) return;

    element.classList.remove("xofr-jump-target");
    window.requestAnimationFrame(function () {
      element.classList.add("xofr-jump-target");
      window.setTimeout(function () {
        element.classList.remove("xofr-jump-target");
      }, 980);
    });
  }

  function scrollToElement(element) {
    if (!element || typeof element.scrollIntoView !== "function") return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    highlightElement(element);
  }

  function showJumpFeedback(message) {
    injectStyles();

    var feedback = document.getElementById("xofr-jump-feedback");
    if (!feedback) {
      feedback = document.createElement("div");
      feedback.id = "xofr-jump-feedback";
      feedback.className = "xofr-jump-feedback";
      document.body.appendChild(feedback);
    }

    feedback.textContent = message;

    if (jumpFeedbackTimeoutId) {
      window.clearTimeout(jumpFeedbackTimeoutId);
    }

    jumpFeedbackTimeoutId = window.setTimeout(function () {
      if (feedback && feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
      jumpFeedbackTimeoutId = null;
    }, 2400);
  }

  function ensureMermaid() {
    if (window.mermaid) {
      return Promise.resolve(window.mermaid);
    }

    if (mermaidLoaderPromise) {
      return mermaidLoaderPromise;
    }

    mermaidLoaderPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
      script.async = true;
      script.onload = function () {
        if (window.mermaid) {
          window.mermaid.initialize({
            startOnLoad: false,
            securityLevel: "loose",
            theme: "neutral",
            themeCSS: ""
              + ".edgeLabel {"
              + "background: rgba(255,255,255,0.96) !important;"
              + "padding: 2px 6px !important;"
              + "border-radius: 6px;"
              + "font-size: 12px !important;"
              + "line-height: 1.2;"
              + "}"
              + ".edgeLabel rect {"
              + "fill: rgba(255,255,255,0.96) !important;"
              + "rx: 6;"
              + "ry: 6;"
              + "}",
          });
          resolve(window.mermaid);
        } else {
          reject(new Error("Mermaid library not available after load"));
        }
      };
      script.onerror = function () {
        reject(new Error("Could not load Mermaid library"));
      };
      document.head.appendChild(script);
    });

    return mermaidLoaderPromise;
  }

  function svgToDataUri(svg) {
    return "data:image/svg+xml;base64," + window.btoa(unescape(encodeURIComponent(svg)));
  }

  function renderOverviewGraph(model) {
    var holder = document.getElementById("xofr-overview-body");
    if (!holder) return;

    if (!hasOverviewTransitions(model)) {
      holder.innerHTML = ""
        + "<div class=\"xofr-empty\">No transitions found yet. Add transitions in the sidecar and regenerate to render the Mermaid overview.</div>"
        + "<div class=\"xofr-code\">" + escapeHtml(buildOverviewMermaid(model)) + "</div>";
      return;
    }

    var mermaid = buildOverviewMermaid(model);
    holder.innerHTML = "<div class=\"xofr-empty\">Rendering Mermaid graph...</div>";

    ensureMermaid().then(function (mermaidLib) {
      return mermaidLib.render("xofr-overview-" + Date.now(), mermaid);
    }).then(function (renderResult) {
      var svg = renderResult && renderResult.svg ? renderResult.svg : renderResult;
      holder.innerHTML = ""
        + "<div class=\"xofr-overview-graph-wrap\"><img src=\"" + svgToDataUri(svg) + "\" alt=\"x-openapi-flow overview graph\" /></div>"
        + "<details class=\"xofr-source-toggle\"><summary>Mermaid source</summary><div class=\"xofr-code\">" + escapeHtml(mermaid) + "</div></details>";
    }).catch(function (error) {
      var details = error && error.message ? error.message : "Unknown Mermaid error";
      holder.innerHTML = ""
        + "<div class=\"xofr-empty\">" + escapeHtml(getMermaidFallbackMessage()) + "</div>"
        + "<div class=\"xofr-code\">Details: " + escapeHtml(details) + "\n\n" + escapeHtml(mermaid) + "</div>";
    });
  }

  function getReferenceRoot() {
    return document.getElementById("x-openapi-flow-view-reference")
      || document.querySelector("[data-x-openapi-flow-view=\"reference\"]")
      || document.body;
  }

  function findReferenceElement(referenceEntry) {
    if (!referenceEntry || !referenceEntry.operation) return null;

    var operation = referenceEntry.operation;
    var root = getReferenceRoot();
    var operationId = normalizeText(operation.operationId);
    var method = normalizeText(operation.httpMethod).toUpperCase();
    var path = normalizeText(operation.path);
    var selectors = ["[id]", "[data-section-id]", "section", "article", "div", "li", "h1", "h2", "h3", "h4", "h5", "button", "a", "span", "code"];
    var candidates = root.querySelectorAll(selectors.join(","));
    var bestElement = null;
    var bestScore = 0;

    Array.prototype.forEach.call(candidates, function (candidate) {
      var haystack = normalizeText(candidate.textContent || candidate.innerText || "");
      if (!haystack) return;

      var score = 0;
      if (operationId && haystack.indexOf(operationId) !== -1) score += 8;
      if (path && haystack.indexOf(path) !== -1) score += 6;
      if (method && haystack.indexOf(method.toLowerCase()) !== -1) score += 3;
      if (score <= bestScore || score < 9) return;

      bestScore = score;
      bestElement = candidate.closest("section,article,li,div") || candidate;
    });

    return bestElement;
  }

  function jumpToFlowOperation(operationId, context) {
    if (!context || !context.target) return false;
    setView(VIEW_FLOW, context);

    var element = context.target.querySelector("[data-xofr-operation=\"" + operationId.replace(/\"/g, "&quot;") + "\"]");
    if (!element) {
      showJumpFeedback("Could not locate operation '" + operationId + "' in the Flow / Lifecycle view.");
      return false;
    }

    scrollToElement(element);
    return true;
  }

  function jumpToReferenceOperation(operationId, context) {
    var referenceEntry = findOperationInModel(context.model, operationId);
    if (!referenceEntry) {
      showJumpFeedback("Could not resolve operation '" + operationId + "' from the lifecycle model.");
      return false;
    }

    setView(VIEW_REFERENCE, context);

    var attempts = 0;
    function tryJump() {
      attempts += 1;
      var match = findReferenceElement(referenceEntry);
      if (match) {
        scrollToElement(match);
        return;
      }

      if (attempts < 12) {
        window.setTimeout(tryJump, 320);
        return;
      }

      var operation = referenceEntry.operation;
      showJumpFeedback(
        "Could not locate operation '" + operationId + "' in the rendered ReDoc view. Reference: "
        + text(operation.httpMethod).toUpperCase() + " " + text(operation.path)
      );
    }

    window.setTimeout(tryJump, 180);
    return true;
  }

  function bindFlowInteractions(target, context) {
    target.addEventListener("click", function (event) {
      var rawTarget = event.target;
      if (!rawTarget || !rawTarget.closest) return;

      var flowJump = rawTarget.closest("[data-xofr-flow-jump]");
      if (flowJump) {
        event.preventDefault();
        jumpToFlowOperation(flowJump.getAttribute("data-xofr-flow-jump"), context);
        return;
      }

      var referenceJump = rawTarget.closest("[data-xofr-reference]");
      if (referenceJump) {
        event.preventDefault();
        jumpToReferenceOperation(referenceJump.getAttribute("data-xofr-reference"), context);
      }
    });
  }

  function mount(options) {
    injectStyles();

    var navItems = Array.prototype.slice.call(
      document.querySelectorAll((options && options.navigationSelector) || "[data-x-openapi-flow-target]")
    );
    var views = Array.prototype.slice.call(
      document.querySelectorAll((options && options.viewSelector) || "[data-x-openapi-flow-view]")
    );
    var defaultView = normalizeViewName(options && options.defaultView);
    var target = document.querySelector((options && options.targetSelector) || "#x-openapi-flow-panel");
    var model = options && options.model;
    var context = {
      model: model,
      navItems: navItems,
      views: views,
      target: target,
    };

    function syncView() {
      setActiveView(readHashView() || defaultView, views, navItems);
    }

    navItems.forEach(function (navItem) {
      navItem.addEventListener("click", function () {
        setView(navItem.getAttribute("data-x-openapi-flow-target"), context);
      });
    });

    if (window.addEventListener) {
      window.addEventListener("hashchange", syncView);
    }

    syncView();

    if (!model || !Array.isArray(model.resources) || model.resources.length === 0 || !target) {
      return;
    }

    target.innerHTML = ""
      + "<div class=\"xofr-stack\">"
      + renderOverviewShell(model)
      + model.resources.map(renderResourceBlock).join("")
      + "</div>";

    bindFlowInteractions(target, context);
    renderOverviewGraph(model);
  }

  window.XOpenApiFlowRedocPlugin = {
    mount: mount,
  };

  window.XOpenApiFlowRedocInternals = {
    buildOverviewMermaid: buildOverviewMermaid,
    findOperationInModel: findOperationInModel,
    hasOverviewTransitions: hasOverviewTransitions,
    getMermaidFallbackMessage: getMermaidFallbackMessage,
  };
})();
