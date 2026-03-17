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
      :root {
        color-scheme: light;
        --x-openapi-flow-bg: #f3f4f6;
        --x-openapi-flow-surface: #ffffff;
        --x-openapi-flow-text: #111827;
        --x-openapi-flow-muted: #6b7280;
        --x-openapi-flow-border: #e5e7eb;
        --x-openapi-flow-accent: #0f766e;
        --x-openapi-flow-accent-soft: #ccfbf1;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        background: var(--x-openapi-flow-bg);
        color: var(--x-openapi-flow-text);
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      }

      .x-openapi-flow-shell-header {
        position: sticky;
        top: 0;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 20px;
        border-bottom: 1px solid var(--x-openapi-flow-border);
        background: rgba(255, 255, 255, 0.94);
        backdrop-filter: blur(10px);
      }

      .x-openapi-flow-shell-brand {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .x-openapi-flow-shell-brand strong {
        font-size: 14px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .x-openapi-flow-shell-brand span {
        color: var(--x-openapi-flow-muted);
        font-size: 13px;
      }

      .x-openapi-flow-shell-menu {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .x-openapi-flow-shell-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 38px;
        padding: 0 14px;
        border: 1px solid var(--x-openapi-flow-border);
        border-radius: 999px;
        color: var(--x-openapi-flow-text);
        background: var(--x-openapi-flow-surface);
        text-decoration: none;
        font-size: 14px;
        font-weight: 600;
      }

      .x-openapi-flow-shell-link.is-active {
        border-color: var(--x-openapi-flow-accent);
        background: var(--x-openapi-flow-accent-soft);
        color: #134e4a;
      }

      [data-x-openapi-flow-view][hidden] {
        display: none !important;
      }

      #x-openapi-flow-view-reference {
        min-height: calc(100vh - 67px);
        background: #ffffff;
      }

      #x-openapi-flow-view-flow {
        min-height: calc(100vh - 67px);
        padding: 28px 16px 48px;
      }

      #x-openapi-flow-panel {
        max-width: 1200px;
        margin: 0 auto;
      }

      @media (max-width: 720px) {
        .x-openapi-flow-shell-header {
          align-items: flex-start;
          flex-direction: column;
        }

        .x-openapi-flow-shell-menu {
          width: 100%;
        }

        .x-openapi-flow-shell-link {
          flex: 1 1 180px;
        }
      }
    </style>
  </head>
  <body>
    <header class="x-openapi-flow-shell-header">
      <div class="x-openapi-flow-shell-brand">
        <strong>x-openapi-flow</strong>
        <span>Static ReDoc package with dedicated flow navigation</span>
      </div>
      <nav id="x-openapi-flow-menu" class="x-openapi-flow-shell-menu" aria-label="Documentation sections">
        <a class="x-openapi-flow-shell-link" href="#reference" data-x-openapi-flow-target="reference">API Reference</a>
        <a class="x-openapi-flow-shell-link" href="#flow" data-x-openapi-flow-target="flow">Flow / Lifecycle</a>
      </nav>
    </header>
    <section id="x-openapi-flow-view-reference" data-x-openapi-flow-view="reference">
      <redoc spec-url="./${specFileName}"></redoc>
    </section>
    <section id="x-openapi-flow-view-flow" data-x-openapi-flow-view="flow" hidden>
      <div id="x-openapi-flow-panel"></div>
    </section>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
    <script src="./x-openapi-flow-redoc-plugin.js"></script>
    <script>
      window.XOpenApiFlowRedocPlugin.mount({
        model: ${modelPayload},
        targetSelector: "#x-openapi-flow-panel",
        navigationSelector: "[data-x-openapi-flow-target]",
        viewSelector: "[data-x-openapi-flow-view]",
        defaultView: "reference"
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
