window.XOpenApiFlowPlugin = function () {
  return {
    wrapComponents: {
      OperationSummary: (Original, system) => (props) => {
        const operation = props.operation;
        const flow = operation && operation.get && operation.get("x-openapi-flow");

        if (!flow) {
          return React.createElement(Original, props);
        }

        const flowObject = flow && flow.toJS ? flow.toJS() : flow;
        const currentState = flowObject.current_state || "-";
        const version = flowObject.version || "-";

        return React.createElement(
          "div",
          null,
          React.createElement(Original, props),
          React.createElement(
            "div",
            {
              style: {
                marginTop: "8px",
                padding: "8px 10px",
                border: "1px solid #d9d9d9",
                borderRadius: "6px",
                background: "#fafafa",
                fontSize: "12px",
              },
            },
            React.createElement("strong", null, "x-openapi-flow"),
            React.createElement(
              "div",
              { style: { marginTop: "4px" } },
              "version: ",
              version,
              " | current_state: ",
              currentState
            )
          )
        );
      },
    },
  };
};
