"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const cwd = process.cwd();
const openapiFile = "swagger.json";

const candidateSidecars = [
  "swagger.x.yaml",
  "swagger.x.yml",
  "swagger.x.json",
  path.join("examples", "swagger.x.yaml"),
  path.join("examples", "swagger.x.yml"),
  path.join("examples", "swagger.x.json"),
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
