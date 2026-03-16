"use strict";

// Barrel — re-exports all output adapters from their domain modules.
// Add new adapters to the relevant domain folder and re-export here.
const { exportDocFlows } = require("./docs/doc-adapter");
const { generatePostmanCollection } = require("./collections/postman-adapter");
const { generateInsomniaWorkspace } = require("./collections/insomnia-adapter");
const { generateRedocPackage } = require("./ui/redoc-adapter");

module.exports = {
  exportDocFlows,
  generatePostmanCollection,
  generateInsomniaWorkspace,
  generateRedocPackage,
};
