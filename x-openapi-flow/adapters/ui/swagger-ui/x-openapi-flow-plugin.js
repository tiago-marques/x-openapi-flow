window.XOpenApiFlowPlugin = function () {
  const h = React.createElement;

  function toPlain(value) {
    if (!value) return value;
    return value.toJS ? value.toJS() : value;
  }

  function text(value) {
    if (value === null || value === undefined || value === "") return "-";
    if (Array.isArray(value)) return value.length ? value.join(", ") : "-";
    return String(value);
  }

  function getPrerequisiteOperationIds(transition) {
    if (!transition || typeof transition !== 'object') return [];
    if (Array.isArray(transition.prerequisite_operation_ids)) {
      return transition.prerequisite_operation_ids.filter(Boolean);
    }
    if (Array.isArray(transition.pre_operation_ids)) {
      return transition.pre_operation_ids.filter(Boolean);
    }
    if (transition.pre_operation_id) {
      return [transition.pre_operation_id];
    }
    return [];
  }

  function transitionsList(currentState, transitions) {
    if (!Array.isArray(transitions) || transitions.length === 0) {
      return h("div", { style: { opacity: 0.85, fontStyle: "italic" } }, "No transitions (terminal state)");
    }

    return h(
      "ul",
      { style: { margin: "6px 0 0 18px", padding: 0 } },
      transitions.map((transition, index) =>
        h(
          "li",
          { key: `${currentState}-${index}`, style: { marginBottom: "4px", lineHeight: 1.45 } },
          h("strong", null, text(transition.trigger_type)),
          " → ",
          h("strong", null, text(transition.target_state)),
          transition.condition ? ` — ${text(transition.condition)}` : "",
          transition.next_operation_id ? ` (next: ${text(transition.next_operation_id)})` : ""
        )
      )
    );
  }

  function miniGraph(currentState, transitions) {
    if (!Array.isArray(transitions) || transitions.length === 0) {
      return [h("div", { key: "terminal", style: { fontFamily: "monospace" } }, `${text(currentState)} [terminal]`)];
    }

    return transitions.map((transition, index) =>
      h(
        "div",
        { key: `edge-${index}`, style: { fontFamily: "monospace", lineHeight: 1.45 } },
        `${text(currentState)} --> ${text(transition.target_state)} [${text(transition.trigger_type)}]`
      )
    );
  }

  return {
    wrapComponents: {
      OperationSummary: (Original) => (props) => {
        const operation = props.operation;
        const flow = operation && operation.get && operation.get("x-openapi-flow");

        if (!flow) {
          return h(Original, props);
        }

        const flowObject = toPlain(flow) || {};
        const currentState = flowObject.current_state;
        const transitions = Array.isArray(flowObject.transitions) ? flowObject.transitions : [];
        const graphImageUrl = flowObject.graph_image_url || window.XOpenApiFlowGraphImageUrl;

        const metadataGrid = h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "140px 1fr",
              gap: "4px 10px",
              fontSize: "12px",
              marginTop: "6px",
            },
          },
          h("div", { style: { opacity: 0.85 } }, "version"),
          h("div", null, text(flowObject.version)),
          h("div", { style: { opacity: 0.85 } }, "id"),
          h("div", null, text(flowObject.id)),
          h("div", { style: { opacity: 0.85 } }, "current_state"),
          h("div", null, text(currentState))
        );

        const graphImageNode = graphImageUrl
          ? h(
              "div",
              { style: { marginTop: "10px" } },
              h("div", { style: { fontWeight: 700, marginBottom: "6px" } }, "Flow graph image"),
              h("img", {
                src: graphImageUrl,
                alt: "x-openapi-flow graph",
                style: {
                  width: "100%",
                  maxWidth: "560px",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: "6px",
                },
              })
            )
          : null;

        return h(
          "div",
          null,
          h(Original, props),
          h(
            "div",
            {
              style: {
                marginTop: "8px",
                padding: "10px",
                border: "1px solid rgba(255,255,255,0.28)",
                borderRadius: "8px",
                background: "rgba(0,0,0,0.12)",
                fontSize: "12px",
              },
            },
            h("div", { style: { fontWeight: 700 } }, "x-openapi-flow"),
            metadataGrid,
            h("div", { style: { marginTop: "10px", fontWeight: 700 } }, "Transitions"),
            transitionsList(currentState, transitions),
            h("div", { style: { marginTop: "10px", fontWeight: 700 } }, "Flow graph (operation-level)"),
            h(
              "div",
              {
                style: {
                  marginTop: "6px",
                  border: "1px dashed rgba(255,255,255,0.32)",
                  borderRadius: "6px",
                  padding: "8px",
                },
              },
              ...miniGraph(currentState, transitions)
            ),
            graphImageNode
          )
        );
      },
    },
  };
};

(function () {
  const styleId = 'x-openapi-flow-ui-style';
  const FLOW_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

  function injectStyles() {
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .xof-card { border: 1px solid rgba(127,127,127,0.38); border-radius: 10px; padding: 10px 12px; background: rgba(127,127,127,0.08); margin-top: 8px; }
      .xof-card > summary { list-style: none; }
      .xof-card > summary::-webkit-details-marker { display: none; }
      .xof-title-row { display: flex; align-items: center; justify-content: space-between; cursor: pointer; gap: 12px; margin: 0; }
      .xof-title { font-weight: 700; font-size: 13px; }
      .xof-toggle-hint { font-size: 11px; opacity: 0.75; }
      .xof-card-body { margin-top: 10px; }
      .xof-section-title { font-size: 12px; font-weight: 700; margin: 10px 0 6px; }
      .xof-meta { display: grid; grid-template-columns: 130px 1fr; gap: 6px 10px; font-size: 12px; margin-bottom: 8px; }
      .xof-meta-label { opacity: 0.85; }
      .xof-list { margin: 0; padding-left: 18px; }
      .xof-list li { margin: 6px 0; line-height: 1.45; }
      .xof-next-link { margin-left: 8px; border: 0; background: none; color: inherit; padding: 0; font-size: 11px; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
      .xof-pre-links { margin-left: 8px; }
      .xof-pre-link { margin-left: 4px; border: 0; background: none; color: inherit; padding: 0; font-size: 11px; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
      .xof-next-link:hover { opacity: 0.95; text-decoration-thickness: 2px; }
      .xof-pre-link:hover { opacity: 0.95; text-decoration-thickness: 2px; }
      .xof-next-link:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; border-radius: 3px; background: rgba(127,127,127,0.14); }
      .xof-pre-link:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; border-radius: 3px; background: rgba(127,127,127,0.14); }
      .xof-graph { margin-top: 10px; padding: 8px; border: 1px dashed rgba(127,127,127,0.42); border-radius: 8px; }
      .xof-graph-title { font-size: 12px; font-weight: 700; margin-bottom: 6px; }
      .xof-edge { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; font-size: 12px; line-height: 1.45; white-space: pre-wrap; }
      .xof-empty { opacity: 0.85; font-style: italic; }
      .xof-overview { margin: 12px 0 0; }
      .xof-overview-details > summary { list-style: none; }
      .xof-overview-details > summary::-webkit-details-marker { display: none; }
      .xof-overview-details .xof-overview-toggle::after { content: 'expand'; }
      .xof-overview-details[open] .xof-overview-toggle::after { content: 'collapse'; }
      .xof-overview-sub { font-size: 12px; opacity: 0.82; margin-bottom: 8px; }
      .xof-overview-graph-wrap {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        margin-top: 4px;
        max-height: 320px;
        overflow: auto;
        border: 1px solid rgba(127,127,127,0.3);
        border-radius: 8px;
        background: rgba(255,255,255,0.96);
        padding: 8px;
      }
      .xof-overview img { width: auto; max-width: 100%; height: auto; border-radius: 4px; background: transparent; }
      .xof-overview-code {
        margin-top: 8px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
        font-size: 10px;
        opacity: 0.9;
        white-space: pre-wrap;
        max-height: 180px;
        overflow: auto;
      }
      @keyframes xof-target-pulse {
        0% { box-shadow: 0 0 0 0 rgba(127,127,127,0.5); }
        100% { box-shadow: 0 0 0 10px rgba(127,127,127,0); }
      }
      .xof-jump-target {
        animation: xof-target-pulse 0.9s ease-out 1;
      }
      .xof-jump-feedback {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 9999;
        max-width: 360px;
        border: 1px solid rgba(127,127,127,0.5);
        border-radius: 8px;
        background: rgba(20,20,20,0.92);
        color: #fff;
        padding: 8px 10px;
        font-size: 12px;
        line-height: 1.35;
        box-shadow: 0 6px 18px rgba(0,0,0,0.25);
      }
    `;

    document.head.appendChild(style);
  }

  function text(value) {
    if (value === null || value === undefined || value === '') return '-';
    if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
    return String(value);
  }

  function getPrerequisiteOperationIds(transition) {
    if (!transition || typeof transition !== 'object') return [];
    if (Array.isArray(transition.prerequisite_operation_ids)) {
      return transition.prerequisite_operation_ids.filter(Boolean);
    }
    if (Array.isArray(transition.pre_operation_ids)) {
      return transition.pre_operation_ids.filter(Boolean);
    }
    if (transition.pre_operation_id) {
      return [transition.pre_operation_id];
    }
    return [];
  }

  function escapeHtml(value) {
    return text(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderTransitions(currentState, transitions) {
    if (!Array.isArray(transitions) || transitions.length === 0) {
      return '<div class="xof-empty">No transitions (terminal state)</div>';
    }

    return `<ul class="xof-list">${transitions
      .map((transition) => {
        const condition = transition.condition ? ` — ${escapeHtml(transition.condition)}` : '';
        const nextOperation = transition.next_operation_id
          ? ` <button class="xof-next-link" data-xof-jump="${escapeHtml(transition.next_operation_id)}" type="button" title="Go to operation ${escapeHtml(transition.next_operation_id)}" aria-label="Go to operation ${escapeHtml(transition.next_operation_id)}">next: ${escapeHtml(transition.next_operation_id)}</button>`
          : '';
        const preOperations = getPrerequisiteOperationIds(transition);
        const preOperationLinks = preOperations.length
          ? `<span class="xof-pre-links">requires:${preOperations
              .map(
                (operationId) =>
                  ` <button class="xof-pre-link" data-xof-jump="${escapeHtml(operationId)}" type="button" title="Go to operation ${escapeHtml(operationId)}" aria-label="Go to operation ${escapeHtml(operationId)}">${escapeHtml(operationId)}</button>`
              )
              .join('')}</span>`
          : '';
        return `<li><strong>${escapeHtml(transition.trigger_type)}</strong> → <strong>${escapeHtml(transition.target_state)}</strong>${condition}${nextOperation}${preOperationLinks}</li>`;
      })
      .join('')}</ul>`;
  }

  function renderGraph(currentState, transitions) {
    if (!Array.isArray(transitions) || transitions.length === 0) {
      return `<div class="xof-edge">${escapeHtml(currentState)} [terminal]</div>`;
    }

    return transitions
      .map((transition) => `<div class="xof-edge">${escapeHtml(currentState)} --> ${escapeHtml(transition.target_state)} [${escapeHtml(transition.trigger_type)}]</div>`)
      .join('');
  }

  function renderCard(flow) {
    const transitions = Array.isArray(flow.transitions) ? flow.transitions : [];
    return `
      <details class="xof-card" open>
        <summary class="xof-title-row">
          <span class="xof-title">x-openapi-flow</span>
          <span class="xof-toggle-hint">toggle</span>
        </summary>
        <div class="xof-card-body">
          <div class="xof-meta">
            <div class="xof-meta-label">version</div><div>${escapeHtml(flow.version)}</div>
            <div class="xof-meta-label">id</div><div>${escapeHtml(flow.id)}</div>
            <div class="xof-meta-label">current_state</div><div>${escapeHtml(flow.current_state)}</div>
          </div>
          <div class="xof-section-title">Transitions</div>
          ${renderTransitions(flow.current_state, transitions)}
          <div class="xof-graph">
            <div class="xof-graph-title">Flow graph (operation-level)</div>
            ${renderGraph(flow.current_state, transitions)}
          </div>
        </div>
      </details>
    `;
  }

  function getSpecFromUi() {
    try {
      if (!window.ui || !window.ui.specSelectors || !window.ui.specSelectors.specJson) {
        return null;
      }

      const spec = window.ui.specSelectors.specJson();
      return spec && spec.toJS ? spec.toJS() : spec;
    } catch (_error) {
      return null;
    }
  }

  function extractFlowsFromSpec(spec) {
    const result = [];
    const paths = (spec && spec.paths) || {};

    Object.entries(paths).forEach(([pathKey, pathItem]) => {
      if (!pathItem || typeof pathItem !== 'object') return;

      FLOW_METHODS.forEach((method) => {
        const operation = pathItem[method];
        if (!operation || typeof operation !== 'object') return;

        const flow = operation['x-openapi-flow'];
        if (!flow || typeof flow !== 'object' || !flow.current_state) return;

        result.push({
          operationId: operation.operationId || `${method}_${pathKey}`,
          method,
          pathKey,
          flow,
        });
      });
    });

    return result;
  }

  function hasFlowData(spec) {
    return extractFlowsFromSpec(spec).length > 0;
  }

  function createOverviewHash(flows) {
    const normalized = flows
      .map(({ operationId, flow }) => ({
        operationId: text(operationId),
        current: text(flow && flow.current_state),
        transitions: (Array.isArray(flow && flow.transitions) ? flow.transitions : [])
          .map((transition) => ({
            trigger: text(transition.trigger_type),
            target: text(transition.target_state),
            next: text(transition.next_operation_id),
            requires: text(getPrerequisiteOperationIds(transition)),
          }))
          .sort((first, second) => JSON.stringify(first).localeCompare(JSON.stringify(second))),
      }))
      .sort((first, second) => first.operationId.localeCompare(second.operationId));

    return JSON.stringify(normalized);
  }

  function buildOverviewMermaid(flows) {
    const lines = ['stateDiagram-v2', '  direction LR'];
    const statesByName = new Map();
    const seen = new Set();
    let stateCounter = 0;
    const edgeLines = [];

    function getStateId(stateName) {
      const normalized = text(stateName);
      if (statesByName.has(normalized)) {
        return statesByName.get(normalized);
      }

      const safeBase = normalized
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      stateCounter += 1;
      const candidate = safeBase ? `s_${safeBase}_${stateCounter}` : `s_state_${stateCounter}`;
      statesByName.set(normalized, candidate);
      return candidate;
    }

    function sanitizeLabel(label) {
      return text(label)
        .replace(/[|]/g, ' / ')
        .replace(/[\n\r]+/g, ' ')
        .replace(/"/g, "'")
        .trim();
    }

    flows.forEach(({ flow }) => {
      const current = text(flow.current_state);
      if (!current) return;

      const fromId = getStateId(current);
      const transitions = Array.isArray(flow.transitions) ? flow.transitions : [];
      transitions.forEach((transition) => {
        const target = text(transition.target_state);
        if (!target) return;
        const toId = getStateId(target);

        const labelParts = [];
        if (transition.next_operation_id) {
          labelParts.push(`next ${text(transition.next_operation_id)}`);
        }
        const preOperations = getPrerequisiteOperationIds(transition);
        if (preOperations.length) {
          labelParts.push(`requires ${preOperations.join(',')}`);
        }
        const label = sanitizeLabel(labelParts.join(' / '));
        const key = `${fromId}::${toId}::${label}`;
        if (seen.has(key)) return;
        seen.add(key);
        edgeLines.push(`  ${fromId} --> ${toId}${label ? `: ${label}` : ''}`);
      });
    });

    statesByName.forEach((stateId, stateName) => {
      lines.push(`  state "${sanitizeLabel(stateName)}" as ${stateId}`);
    });

    lines.push(...edgeLines);

    return lines.join('\n');
  }

  function hasOverviewTransitionData(flows) {
    return flows.some(({ flow }) => Array.isArray(flow && flow.transitions) && flow.transitions.length > 0);
  }

  function buildStatesSummary(flows) {
    const states = new Set();
    flows.forEach(({ flow }) => {
      if (flow && flow.current_state) {
        states.add(text(flow.current_state));
      }
    });
    return Array.from(states).sort().join(', ');
  }

  let mermaidLoaderPromise = null;
  function ensureMermaid() {
    if (window.mermaid) {
      return Promise.resolve(window.mermaid);
    }

    if (mermaidLoaderPromise) {
      return mermaidLoaderPromise;
    }

    mermaidLoaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
      script.async = true;
      script.onload = () => {
        if (window.mermaid) {
          window.mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'loose',
            theme: 'neutral',
            themeCSS: `
              .edgeLabel {
                background: rgba(255,255,255,0.96) !important;
                padding: 2px 6px !important;
                border-radius: 6px;
                font-size: 12px !important;
                line-height: 1.2;
              }
              .edgeLabel rect {
                fill: rgba(255,255,255,0.96) !important;
                rx: 6;
                ry: 6;
              }
            `,
          });
          resolve(window.mermaid);
        } else {
          reject(new Error('Mermaid library not available after load'));
        }
      };
      script.onerror = () => reject(new Error('Could not load Mermaid library'));
      document.head.appendChild(script);
    });

    return mermaidLoaderPromise;
  }

  function svgToDataUri(svg) {
    const encoded = window.btoa(unescape(encodeURIComponent(svg)));
    return `data:image/svg+xml;base64,${encoded}`;
  }

  function getMermaidFallbackMessage() {
    return 'Could not render Mermaid image. Check CDN/network access or load mermaid manually before Swagger UI.';
  }

  function getOverviewTitleFromSpec(spec) {
    const apiTitle = spec && spec.info && spec.info.title ? spec.info.title : 'API';
    return `${text(apiTitle)} — Flow Overview (x-openapi-flow)`;
  }

  let overviewRenderedHash = null;
  let overviewRenderInProgress = false;
  let overviewPendingHash = null;
  let overviewTimeoutId = null;

  function getOrCreateOverviewHolder() {
    const infoContainer = document.querySelector('.swagger-ui .information-container');
    if (!infoContainer) return null;

    let holder = document.getElementById('xof-overview-holder');
    if (!holder) {
      holder = document.createElement('div');
      holder.id = 'xof-overview-holder';
      holder.className = 'xof-overview';
      infoContainer.appendChild(holder);
    }

    return holder;
  }

  function clearOverviewHolder() {
    const holder = document.getElementById('xof-overview-holder');
    if (holder && holder.parentNode) {
      holder.parentNode.removeChild(holder);
    }
    overviewRenderedHash = null;
  }

  async function renderOverview() {
    const spec = getSpecFromUi();
    const flows = extractFlowsFromSpec(spec);
    if (!flows.length) {
      clearOverviewHolder();
      return;
    }

    const currentHash = createOverviewHash(flows);
    const overviewTitle = escapeHtml(getOverviewTitleFromSpec(spec));
    const hasTransitions = hasOverviewTransitionData(flows);
    if (!hasTransitions) {
      const noTransitionsHash = `no-transitions:${currentHash}`;
      if (overviewRenderedHash === noTransitionsHash) return;
      const holderNoTransitions = getOrCreateOverviewHolder();
      if (!holderNoTransitions) return;
      const statesSummary = escapeHtml(buildStatesSummary(flows) || '-');
      holderNoTransitions.innerHTML = `
        <details class="xof-card xof-overview-details">
          <summary class="xof-title-row">
            <span class="xof-title">${overviewTitle}</span>
            <span class="xof-toggle-hint xof-overview-toggle"></span>
          </summary>
          <div class="xof-card-body">
            <div class="xof-overview-sub">All operation transitions in one graph.</div>
            <div class="xof-empty">No transitions found yet. Add transitions in the sidecar and run apply to render the Mermaid overview.</div>
            <div class="xof-overview-code">Current states: ${statesSummary}</div>
          </div>
        </details>
      `;
      overviewRenderedHash = noTransitionsHash;
      return;
    }

    const mermaid = buildOverviewMermaid(flows);
    if (overviewRenderedHash === currentHash) return;
    if (overviewRenderInProgress && overviewPendingHash === currentHash) return;

    const holder = getOrCreateOverviewHolder();
    if (!holder) return;

    holder.innerHTML = `
      <details class="xof-card xof-overview-details">
        <summary class="xof-title-row">
          <span class="xof-title">${overviewTitle}</span>
          <span class="xof-toggle-hint xof-overview-toggle"></span>
        </summary>
        <div class="xof-card-body">
          <div class="xof-overview-sub">All operation transitions in one graph.</div>
          <div class="xof-empty">Rendering Mermaid graph...</div>
        </div>
      </details>
    `;
    overviewRenderInProgress = true;
    overviewPendingHash = currentHash;

    try {
      const mermaidLib = await ensureMermaid();
      const renderId = `xof-overview-${Date.now()}`;
      const renderResult = await mermaidLib.render(renderId, mermaid);
      const svg = renderResult && renderResult.svg ? renderResult.svg : renderResult;
      const dataUri = svgToDataUri(svg);

      holder.innerHTML = `
        <details class="xof-card xof-overview-details">
          <summary class="xof-title-row">
            <span class="xof-title">${overviewTitle}</span>
            <span class="xof-toggle-hint xof-overview-toggle"></span>
          </summary>
          <div class="xof-card-body">
            <div class="xof-overview-sub">All operation transitions in one graph.</div>
            <div class="xof-overview-graph-wrap">
              <img src="${dataUri}" alt="x-openapi-flow overview graph" />
            </div>
            <details style="margin-top:8px;">
              <summary style="cursor:pointer;">Mermaid source</summary>
              <div class="xof-overview-code">${mermaid.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            </details>
          </div>
        </details>
      `;
    } catch (error) {
      const details = error && error.message ? escapeHtml(error.message) : 'Unknown Mermaid error';
      holder.innerHTML = `
        <details class="xof-card xof-overview-details">
          <summary class="xof-title-row">
            <span class="xof-title">${overviewTitle}</span>
            <span class="xof-toggle-hint xof-overview-toggle"></span>
          </summary>
          <div class="xof-card-body">
            <div class="xof-empty">${getMermaidFallbackMessage()}</div>
            <div class="xof-overview-code">Details: ${details}</div>
            <div class="xof-overview-code">${mermaid.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          </div>
        </details>
      `;
    } finally {
      overviewRenderInProgress = false;
    }

    overviewRenderedHash = currentHash;
  }

  function scheduleOverviewRender() {
    if (overviewTimeoutId) {
      window.clearTimeout(overviewTimeoutId);
    }

    overviewTimeoutId = window.setTimeout(() => {
      overviewTimeoutId = null;
      renderOverview().catch(() => {
        // keep plugin resilient in environments where async rendering fails
      });
    }, 120);
  }

  function findOperationById(spec, operationId) {
    if (!spec || !spec.paths || !operationId) return null;

    for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      for (const method of FLOW_METHODS) {
        const operation = pathItem[method];
        if (!operation || typeof operation !== 'object') continue;
        if (operation.operationId === operationId) {
          return { method, pathKey };
        }
      }
    }

    return null;
  }

  function jumpToOperationById(operationId) {
    function highlightTarget(opblock) {
      if (!opblock) return;
      opblock.classList.remove('xof-jump-target');
      window.requestAnimationFrame(() => {
        opblock.classList.add('xof-jump-target');
        window.setTimeout(() => opblock.classList.remove('xof-jump-target'), 950);
      });
    }

    function getOperationSummaries() {
      return Array.from(document.querySelectorAll('.swagger-ui .opblock-summary')).map((summary) => {
        const opblock = summary.closest('.opblock');
        const pathNode = summary.querySelector('.opblock-summary-path');
        const path = pathNode ? pathNode.textContent.trim() : '';
        return { summary, opblock, path };
      });
    }

    function tryJump(match) {
      const summaries = getOperationSummaries();
      for (const { summary, opblock, path } of summaries) {
        if (!opblock || !opblock.classList.contains(`opblock-${match.method}`)) continue;
        if (path !== match.pathKey) continue;

        summary.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (!opblock.classList.contains('is-open')) {
          summary.click();
        }
        highlightTarget(opblock);
        return true;
      }
      return false;
    }

    const spec = getSpecFromUi();
    const match = findOperationById(spec, operationId);
    if (!match) return false;

    return tryJump(match);
  }

  function findXOpenApiFlowValueCell(opblock) {
    const rows = opblock.querySelectorAll('tr');
    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) continue;
      if (cells[0].innerText.trim() === 'x-openapi-flow') {
        return cells[1];
      }
    }
    return null;
  }

  function enhanceOperation(opblock) {
    const valueCell = findXOpenApiFlowValueCell(opblock);
    if (!valueCell || valueCell.dataset.xofEnhanced === '1') return;

    const raw = valueCell.innerText.trim();
    if (!raw) return;

    let flow;
    try {
      flow = JSON.parse(raw);
    } catch (_error) {
      return;
    }

    valueCell.innerHTML = renderCard(flow);
    valueCell.dataset.xofEnhanced = '1';
  }

  let jumpFeedbackTimeoutId = null;
  function showJumpFeedback(message) {
    injectStyles();

    let feedback = document.getElementById('xof-jump-feedback');
    if (!feedback) {
      feedback = document.createElement('div');
      feedback.id = 'xof-jump-feedback';
      feedback.className = 'xof-jump-feedback';
      document.body.appendChild(feedback);
    }

    feedback.textContent = message;

    if (jumpFeedbackTimeoutId) {
      window.clearTimeout(jumpFeedbackTimeoutId);
    }

    jumpFeedbackTimeoutId = window.setTimeout(() => {
      if (feedback && feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
      jumpFeedbackTimeoutId = null;
    }, 2200);
  }

  function enhanceAll() {
    const spec = getSpecFromUi();
    if (!hasFlowData(spec)) {
      clearOverviewHolder();
      return;
    }

    injectStyles();
    const opblocks = document.querySelectorAll('.opblock');
    opblocks.forEach((opblock) => enhanceOperation(opblock));
    scheduleOverviewRender();
  }

  let enhanceScheduled = false;
  function scheduleEnhance() {
    if (enhanceScheduled) return;
    enhanceScheduled = true;
    window.requestAnimationFrame(() => {
      enhanceScheduled = false;
      enhanceAll();
    });
  }

  const observer = new MutationObserver(() => {
    scheduleEnhance();
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!target || !target.closest) return;

    const jumpButton = target.closest('[data-xof-jump]');
    if (!jumpButton) return;

    event.preventDefault();
    const operationId = jumpButton.getAttribute('data-xof-jump');
    if (!operationId) return;
    const jumped = jumpToOperationById(operationId);
    if (!jumped) {
      showJumpFeedback(`Could not locate operation '${operationId}' in the rendered Swagger view.`);
    }
  });

  window.addEventListener('load', () => {
    scheduleEnhance();
    observer.observe(document.body, { childList: true, subtree: true });
  });

  window.XOpenApiFlowUiInternals = {
    extractFlowsFromSpec,
    hasFlowData,
    hasOverviewTransitionData,
    buildOverviewMermaid,
    createOverviewHash,
    getOverviewTitleFromSpec,
    getMermaidFallbackMessage,
  };
})();
