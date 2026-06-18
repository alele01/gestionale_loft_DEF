const Module = require("module");
const path = require("path");

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "server-only") {
    return path.join(__dirname, "server-only-empty.cjs");
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
