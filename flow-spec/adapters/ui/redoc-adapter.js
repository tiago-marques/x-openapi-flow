"use strict";

const fs = require("fs");
const path = require("path");
const { loadApi } = require("../../lib/validator");
const { buildIntermediateModel } = require("../../lib/sdk-generator");

function buildRedocHtml(model, specFileName) {
  const modelPayload = JSON.stringify(model);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>x-openapi-flow Redoc</title>
    <style>
      body { margin: 0; background: #ffffff; color: #111827; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
      #x-openapi-flow-panel { max-width: 1200px; margin: 0 auto; padding: 16px; border-bottom: 1px solid #e5e7eb; }
    </style>
  </head>
  <body>
    <div id="x-openapi-flow-panel"></div>
    <redoc spec-url="./${specFileName}"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
    <script src="./x-openapi-flow-redoc-plugin.js"></script>
    <script>
      window.XOpenApiFlowRedocPlugin.mount({
        model: ${modelPayload},
        targetSelector: "#x-openapi-flow-panel"
      });
    </script>
  </body>
</html>
`;
}

function generateRedocPackage(options) {
  const apiPath = path.resolve(options.apiPath);
  const outputDir = path.resolve(options.outputDir || path.join(process.cwd(), "redoc-flow"));

  const api = loadApi(apiPath);
  const model = buildIntermediateModel(api);
  const specFileName = path.extname(apiPath).toLowerCase() === ".json" ? "openapi.json" : "openapi.yaml";

  fs.mkdirSync(outputDir, { recursive: true });

  const sourceSpec = fs.readFileSync(apiPath, "utf8");
  fs.writeFileSync(path.join(outputDir, specFileName), sourceSpec, "utf8");

  // Plugin lives at adapters/ui/redoc/ — __dirname is adapters/ui
  const pluginSourcePath = path.join(__dirname, "redoc", "x-openapi-flow-redoc-plugin.js");
  const pluginTargetPath = path.join(outputDir, "x-openapi-flow-redoc-plugin.js");
  fs.copyFileSync(pluginSourcePath, pluginTargetPath);

  fs.writeFileSync(
    path.join(outputDir, "flow-model.json"),
    `${JSON.stringify(model, null, 2)}\n`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(outputDir, "index.html"),
    buildRedocHtml(model, specFileName),
    "utf8"
  );

  return {
    outputDir,
    indexPath: path.join(outputDir, "index.html"),
    resources: model.resources.length,
    flowCount: model.flowCount,
  };
}

module.exports = { generateRedocPackage };
