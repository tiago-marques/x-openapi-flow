# Integration Testing

## Overview

Integration tests live in `x-openapi-flow/tests/integration/` and validate end-to-end scenarios that span multiple features or commands. They complement the CLI unit tests in `tests/cli/` and the plugin UI tests in `tests/plugins/`.

## When to write an integration test

Use an integration test when:
- A scenario exercises more than one CLI command on the same spec (e.g., `generate-sdk` + `export-doc-flows`).
- You want to assert that two adapters produce **coherent** outputs (same resources, same states, same operationIds).
- A bug can only surface when the full pipeline runs end-to-end rather than one command in isolation.

Use a CLI test (`tests/cli/`) for single-command assertions and output format validation.

## Structure

```
x-openapi-flow/tests/integration/
└── sdk-and-adapters.test.js   ← generate-sdk + export-doc-flows + collections coherence
```

## Running integration tests

```bash
# Run only integration tests
npm run test:integration

# Run the full test suite (cli + plugins + integration + smoke)
npm test
```

## Writing a new integration test

```js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const FLOW_SPEC_ROOT = path.resolve(__dirname, "..", "..");
const CLI_PATH = path.resolve(FLOW_SPEC_ROOT, "bin", "x-openapi-flow.js");

function runCli(args) {
  const result = spawnSync("node", [CLI_PATH, ...args], {
    cwd: FLOW_SPEC_ROOT,
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}

test("my integration scenario", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-flow-integration-"));

  try {
    // 1. Write a temp OpenAPI spec
    const specPath = path.join(tempDir, "openapi.yaml");
    fs.writeFileSync(specPath, MY_SPEC_YAML, "utf8");

    // 2. Run commands
    const result1 = runCli(["generate-sdk", specPath, "--lang", "typescript", "--output", path.join(tempDir, "sdk")]);
    assert.equal(result1.status, 0);

    const result2 = runCli(["export-doc-flows", specPath, "--output", path.join(tempDir, "docs.md")]);
    assert.equal(result2.status, 0);

    // 3. Assert cross-output coherence
    const flowModel = JSON.parse(fs.readFileSync(path.join(tempDir, "sdk", "flow-model.json"), "utf8"));
    const docContent = fs.readFileSync(path.join(tempDir, "docs.md"), "utf8");

    for (const resource of flowModel.resources) {
      assert.ok(docContent.toLowerCase().includes(resource.resource.toLowerCase()));
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
```

## Conventions

- Always clean up temp files in a `finally` block.
- Use human-readable assertion messages: `assert.equal(result.status, 0, \`command failed:\n${result.stderr}\`)`.
- Prefer asserting **semantic equivalence** (same states, same resources) over brittle string snapshots.
- Each test file in `tests/integration/` should focus on one scenario or one adapter pair.

## Existing tests

| File | Scenario |
|---|---|
| `sdk-and-adapters.test.js` | Validates that `generate-sdk`, `export-doc-flows`, `generate-postman`, and `generate-insomnia` all produce coherent outputs (same operationIds, states, resources) when run against the same spec. |

## Related

- [Adapters Architecture](Adapters-Architecture.md) — how adapters are organized and how data flows between them.
- [CLI Reference](CLI-Reference.md) — all CLI commands and their flags.
