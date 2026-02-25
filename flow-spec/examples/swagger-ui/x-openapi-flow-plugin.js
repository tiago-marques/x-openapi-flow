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
    injectStyles();
    const opblocks = document.querySelectorAll('.opblock');
    opblocks.forEach((opblock) => enhanceOperation(opblock));
  }

  const observer = new MutationObserver(() => {
    enhanceAll();
  });

  window.addEventListener('load', () => {
    enhanceAll();
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
