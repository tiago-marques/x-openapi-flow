"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const cwd = process.cwd();
const openapiFile = "openapi.json";

const candidateSidecars = [
  "openapi.x.yaml",
  "openapi.x.yml",
  "openapi.x.json",
  path.join("examples", "openapi.x.yaml"),
  path.join("examples", "openapi.x.yml"),
  path.join("examples", "openapi.x.json"),
];

const selectedSidecar = candidateSidecars.find((candidate) =>
  fs.existsSync(path.join(cwd, candidate))
);

const args = ["x-openapi-flow", "apply", openapiFile];
if (selectedSidecar) {
  args.push("--flows", selectedSidecar);
}

console.log(
  selectedSidecar
    ? `[apply] Using sidecar: ${selectedSidecar}`
    : "[apply] No explicit sidecar found. Using x-openapi-flow default discovery."
);

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(npxCommand, args, {
  stdio: "inherit",
  cwd,
});

if (result.error) {
  console.error(`[apply] Failed to execute apply command: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
