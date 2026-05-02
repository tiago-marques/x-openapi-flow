"use strict";

const vscode = require("vscode");
const cp = require("node:child_process");
const path = require("node:path");

function buildValidateArgs(filePath, config) {
  const args = [
    "--yes",
    `x-openapi-flow@${config.cliVersion}`,
    "validate",
    filePath,
    "--profile",
    config.profile,
    "--format",
    "json",
  ];

  if (config.strictQuality) {
    args.push("--strict-quality");
  }

  if (config.semantic) {
    args.push("--semantic");
  }

  return args;
}

function getConfig() {
  const cfg = vscode.workspace.getConfiguration("xOpenApiFlow");
  return {
    cliVersion: cfg.get("cliVersion", "latest"),
    profile: cfg.get("profile", "strict"),
    strictQuality: cfg.get("strictQuality", true),
    semantic: cfg.get("semantic", false),
  };
}

function parseOutput(output) {
  try {
    const parsed = JSON.parse(output);
    const issues = [];

    for (const issue of parsed.issues || []) {
      const pointer = issue.pointer || "";
      const message = issue.message || "Validation issue";
      issues.push({
        pointer,
        message,
        code: issue.code || "XFLOW",
        severity: issue.severity || "error",
      });
    }

    return { ok: !!parsed.ok, issues };
  } catch (_err) {
    return {
      ok: false,
      issues: [
        {
          pointer: "",
          message: "Failed to parse x-openapi-flow output as JSON.",
          code: "XFLOW_PARSE",
          severity: "error",
        },
      ],
    };
  }
}

function createRangeFromPointer(document, pointer) {
  if (!pointer) {
    return new vscode.Range(0, 0, 0, 1);
  }

  const token = pointer.split("/").filter(Boolean).pop();
  if (!token) {
    return new vscode.Range(0, 0, 0, 1);
  }

  const text = document.getText();
  const idx = text.indexOf(token);
  if (idx < 0) {
    return new vscode.Range(0, 0, 0, 1);
  }

  const pos = document.positionAt(idx);
  return new vscode.Range(pos.line, pos.character, pos.line, pos.character + token.length);
}

async function validateFile(fileUri, diagnostics) {
  const filePath = fileUri.fsPath;
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
  const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : path.dirname(filePath);
  const config = getConfig();
  const args = buildValidateArgs(filePath, config);

  return new Promise((resolve) => {
    cp.execFile("npx", args, { cwd, maxBuffer: 1024 * 1024 }, async (error, stdout, stderr) => {
      const output = stdout && stdout.trim() ? stdout : stderr;
      const parsed = parseOutput(output || "{}");
      const document = await vscode.workspace.openTextDocument(fileUri);

      const items = parsed.issues.map((issue) => {
        const severity = issue.severity === "warning"
          ? vscode.DiagnosticSeverity.Warning
          : vscode.DiagnosticSeverity.Error;
        const diagnostic = new vscode.Diagnostic(
          createRangeFromPointer(document, issue.pointer),
          `[${issue.code}] ${issue.message}`,
          severity
        );
        diagnostic.source = "x-openapi-flow";
        return diagnostic;
      });

      diagnostics.set(fileUri, items);

      if (!error && parsed.ok) {
        vscode.window.showInformationMessage("x-openapi-flow: validation passed.");
      } else {
        vscode.window.showWarningMessage(`x-openapi-flow: found ${items.length} issue(s).`);
      }

      resolve();
    });
  });
}

function activate(context) {
  const diagnostics = vscode.languages.createDiagnosticCollection("x-openapi-flow");
  context.subscriptions.push(diagnostics);

  const validateCurrentFile = vscode.commands.registerCommand("xOpenApiFlow.validateCurrentFile", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("x-openapi-flow: no active editor.");
      return;
    }

    await validateFile(editor.document.uri, diagnostics);
  });

  const validateWorkspace = vscode.commands.registerCommand("xOpenApiFlow.validateWorkspace", async () => {
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectMany: false,
      filters: {
        OpenAPI: ["yaml", "yml", "json"],
      },
    });

    if (!picked || picked.length === 0) {
      return;
    }

    await validateFile(picked[0], diagnostics);
  });

  context.subscriptions.push(validateCurrentFile, validateWorkspace);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
