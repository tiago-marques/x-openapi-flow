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

  function injectStyles() {
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .xof-card { border: 1px solid rgba(255,255,255,0.28); border-radius: 8px; padding: 10px; background: rgba(0,0,0,0.12); }
      .xof-title { font-weight: 700; margin-bottom: 8px; }
      .xof-meta { display: grid; grid-template-columns: 140px 1fr; gap: 4px 10px; font-size: 12px; margin-bottom: 10px; }
      .xof-meta-label { opacity: 0.85; }
      .xof-list { margin: 0; padding-left: 18px; }
      .xof-list li { margin: 4px 0; }
      .xof-graph { margin-top: 10px; padding: 8px; border: 1px dashed rgba(255,255,255,0.32); border-radius: 6px; }
      .xof-graph-title { font-size: 12px; font-weight: 700; margin-bottom: 6px; }
      .xof-edge { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; font-size: 12px; line-height: 1.45; white-space: pre-wrap; }
      .xof-empty { opacity: 0.85; font-style: italic; }
      .xof-overview { margin: 10px 0 16px; }
      .xof-overview img { width: 100%; max-width: 760px; border: 1px solid rgba(255,255,255,0.3); border-radius: 6px; background: #fff; }
      .xof-overview-code { margin-top: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; font-size: 11px; opacity: 0.9; white-space: pre-wrap; }
    `;

    document.head.appendChild(style);
  }

  function text(value) {
    if (value === null || value === undefined || value === '') return '-';
    if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
    return String(value);
  }

  function renderTransitions(currentState, transitions) {
    if (!Array.isArray(transitions) || transitions.length === 0) {
      return '<div class="xof-empty">No transitions (terminal state)</div>';
    }

    return `<ul class="xof-list">${transitions
      .map((transition) => {
        const condition = transition.condition ? ` — ${text(transition.condition)}` : '';
        const nextOperation = transition.next_operation_id ? ` (next: ${text(transition.next_operation_id)})` : '';
        return `<li><strong>${text(transition.trigger_type)}</strong> → <strong>${text(transition.target_state)}</strong>${condition}${nextOperation}</li>`;
      })
      .join('')}</ul>`;
  }

  function renderGraph(currentState, transitions) {
    if (!Array.isArray(transitions) || transitions.length === 0) {
      return `<div class="xof-edge">${text(currentState)} [terminal]</div>`;
    }

    return transitions
      .map((transition) => `<div class="xof-edge">${text(currentState)} --> ${text(transition.target_state)} [${text(transition.trigger_type)}]</div>`)
      .join('');
  }

  function renderCard(flow) {
    const transitions = Array.isArray(flow.transitions) ? flow.transitions : [];
    return `
      <div class="xof-card">
        <div class="xof-title">x-openapi-flow</div>
        <div class="xof-meta">
          <div class="xof-meta-label">version</div><div>${text(flow.version)}</div>
          <div class="xof-meta-label">id</div><div>${text(flow.id)}</div>
          <div class="xof-meta-label">current_state</div><div>${text(flow.current_state)}</div>
        </div>
        <div><strong>Transitions</strong></div>
        ${renderTransitions(flow.current_state, transitions)}
        <div class="xof-graph">
          <div class="xof-graph-title">Flow graph (operation-level)</div>
          ${renderGraph(flow.current_state, transitions)}
        </div>
      </div>
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
    const methods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

    Object.entries(paths).forEach(([pathKey, pathItem]) => {
      if (!pathItem || typeof pathItem !== 'object') return;

      methods.forEach((method) => {
        const operation = pathItem[method];
        if (!operation || typeof operation !== 'object') return;

        const flow = operation['x-openapi-flow'];
        if (!flow || typeof flow !== 'object' || !flow.current_state) return;

        result.push({
          operationId: operation.operationId || `${method}_${pathKey}`,
          flow,
        });
      });
    });

    return result;
  }

  function hasFlowData(spec) {
    return extractFlowsFromSpec(spec).length > 0;
  }

  function buildOverviewMermaid(flows) {
    const lines = ['stateDiagram-v2'];
    const states = new Set();
    const seen = new Set();

    flows.forEach(({ flow }) => {
      const current = flow.current_state;
      if (!current) return;

      states.add(current);
      const transitions = Array.isArray(flow.transitions) ? flow.transitions : [];
      transitions.forEach((transition) => {
        const target = transition.target_state;
        if (!target) return;
        states.add(target);

        const labelParts = [];
        if (transition.next_operation_id) {
          labelParts.push(`next:${text(transition.next_operation_id)}`);
        }
        if (Array.isArray(transition.prerequisite_operation_ids) && transition.prerequisite_operation_ids.length) {
          labelParts.push(`requires:${transition.prerequisite_operation_ids.join(',')}`);
        }
        const label = labelParts.join(' | ');
        const key = `${current}::${target}::${label}`;
        if (seen.has(key)) return;
        seen.add(key);
        lines.push(`  ${current} --> ${target}${label ? `: ${label}` : ''}`);
      });
    });

    Array.from(states)
      .sort()
      .forEach((state) => {
        lines.splice(1, 0, `  state ${state}`);
      });

    return lines.join('\n');
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
          window.mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
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

  let overviewRenderedHash = null;
  let overviewRenderInProgress = false;
  let overviewPendingHash = null;
  async function renderOverview() {
    const spec = getSpecFromUi();
    const flows = extractFlowsFromSpec(spec);
    if (!flows.length) return;

    const mermaid = buildOverviewMermaid(flows);
    const currentHash = `${flows.length}:${mermaid}`;
    if (overviewRenderedHash === currentHash) return;
    if (overviewRenderInProgress && overviewPendingHash === currentHash) return;

    const infoContainer = document.querySelector('.swagger-ui .information-container');
    if (!infoContainer) return;

    let holder = document.getElementById('xof-overview-holder');
    if (!holder) {
      holder = document.createElement('div');
      holder.id = 'xof-overview-holder';
      holder.className = 'xof-overview xof-card';
      infoContainer.parentNode.insertBefore(holder, infoContainer.nextSibling);
    }

    holder.innerHTML = '<div class="xof-title">x-openapi-flow — Flow Overview</div><div class="xof-empty">Rendering Mermaid graph...</div>';
    overviewRenderInProgress = true;
    overviewPendingHash = currentHash;

    try {
      const mermaidLib = await ensureMermaid();
      const renderId = `xof-overview-${Date.now()}`;
      const renderResult = await mermaidLib.render(renderId, mermaid);
      const svg = renderResult && renderResult.svg ? renderResult.svg : renderResult;
      const dataUri = svgToDataUri(svg);

      holder.innerHTML = `
        <div class="xof-title">x-openapi-flow — Flow Overview</div>
        <img src="${dataUri}" alt="x-openapi-flow overview graph" />
        <details style="margin-top:8px;">
          <summary style="cursor:pointer;">Mermaid source</summary>
          <div class="xof-overview-code">${mermaid.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </details>
      `;
    } catch (_error) {
      holder.innerHTML = `
        <div class="xof-title">x-openapi-flow — Flow Overview</div>
        <div class="xof-empty">Could not render Mermaid image in this environment.</div>
        <div class="xof-overview-code">${mermaid.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      `;
    } finally {
      overviewRenderInProgress = false;
    }

    overviewRenderedHash = currentHash;
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

  function enhanceAll() {
    const spec = getSpecFromUi();
    if (!hasFlowData(spec)) {
      return;
    }

    injectStyles();
    const opblocks = document.querySelectorAll('.opblock');
    opblocks.forEach((opblock) => enhanceOperation(opblock));
    renderOverview().catch(() => {
      // keep plugin resilient in environments where async rendering fails
    });
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

  window.addEventListener('load', () => {
    scheduleEnhance();
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
