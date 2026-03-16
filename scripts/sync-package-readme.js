#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(repoRoot, "README.md");
const targetPath = path.join(repoRoot, "x-openapi-flow", "README.md");

const blobBase = "https://github.com/tiago-marques/x-openapi-flow/blob/main/";
const rawBase = "https://raw.githubusercontent.com/tiago-marques/x-openapi-flow/main/";

function isExternalLink(target) {
  return /^(https?:\/\/|mailto:|#)/i.test(target);
}

function toAbsoluteLink(target, isImage) {
  if (isExternalLink(target)) {
    return target;
  }

  const normalized = target.replace(/^\.\//, "");
  return `${isImage ? rawBase : blobBase}${normalized}`;
}

function rewriteMarkdownLinks(markdown) {
  const lines = markdown.split("\n");
  const rewritten = [];
  let inCodeFence = false;

  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      inCodeFence = !inCodeFence;
      rewritten.push(line);
      continue;
    }

    if (inCodeFence) {
      rewritten.push(line);
      continue;
    }

    const updated = line.replace(/(!?\[[^\]]*\])\(([^)]+)\)/g, (full, label, target) => {
      if (target.startsWith("<") && target.endsWith(">")) {
        const inner = target.slice(1, -1);
        return `${label}(<${toAbsoluteLink(inner, label.startsWith("!["))}>)`;
      }

      return `${label}(${toAbsoluteLink(target, label.startsWith("!["))})`;
    });

    rewritten.push(updated);
  }

  return rewritten.join("\n");
}

const source = fs.readFileSync(sourcePath, "utf8");
const banner = "<!-- Auto-generated from /README.md via scripts/sync-package-readme.js. Do not edit directly. -->\n\n";
const output = banner + rewriteMarkdownLinks(source);

fs.writeFileSync(targetPath, output, "utf8");
console.log(`Synced package README: ${path.relative(repoRoot, targetPath)}`);
