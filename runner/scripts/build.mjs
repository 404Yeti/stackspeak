// Builds the static runner into dist/ (production) or dist-test/ (--test).
//
//  * verifies the installed pyodide package against the committed SHA-256 manifest (supply chain);
//  * copies the runtime to dist/pyodide/<version>/ (self-hosted: no CDN at runtime);
//  * inlines protocol/harness/limits into the worker and bridge and content-hashes both;
//  * writes build-info.json and index.html.
//
// --test builds a SEPARATE tree for the security tests only: parents come from RUNNER_TEST_PARENTS
// (default https://app.test), test hooks are enabled and in-worker hardening is OFF so the CSP can be
// tested on its own. A production build ignores every environment override: approved origins can only
// change through a reviewed edit to config/runner.config.json.
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateOrigins } from "./lib/headers.mjs";

export const RUNTIME_FILES = ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const strip = (source) => source.replace(/^export /gm, "");

export function runnerConfig() {
  return JSON.parse(readFileSync(join(root, "config/runner.config.json"), "utf8"));
}

/** Throws unless the installed pyodide package is exactly the pinned version with the recorded hashes. */
export function verifyPyodide({ update = false } = {}) {
  const config = runnerConfig();
  const pkgDir = join(root, "node_modules/pyodide");
  const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  if (pkg.version !== config.pyodideVersion) {
    throw new Error(`pyodide ${pkg.version} is installed but config pins ${config.pyodideVersion}`);
  }
  const files = {};
  for (const name of RUNTIME_FILES) {
    const buf = readFileSync(join(pkgDir, name));
    files[name] = { sha256: sha256(buf), bytes: buf.length };
  }
  const manifestPath = join(root, "config/pyodide.sha256.json");
  if (update) {
    writeFileSync(manifestPath, JSON.stringify({ version: pkg.version, files }, null, 2) + "\n");
    return files;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.version !== pkg.version) throw new Error(`manifest is for pyodide ${manifest.version}, installed ${pkg.version}`);
  for (const name of RUNTIME_FILES) {
    if (!manifest.files[name]) throw new Error(`manifest has no entry for ${name}`);
    if (manifest.files[name].sha256 !== files[name].sha256) {
      throw new Error(`INTEGRITY FAILURE: ${name} does not match the committed SHA-256 (${files[name].sha256} != ${manifest.files[name].sha256})`);
    }
  }
  return files;
}

export function build({ test = false, outDir } = {}) {
  const config = runnerConfig();
  const dist = join(root, outDir ?? (test ? "dist-test" : "dist"));
  const parents = test
    ? (process.env.RUNNER_TEST_PARENTS ?? "https://app.test").split(",").map((s) => s.trim()).filter(Boolean)
    : config.approvedParentOrigins;
  validateOrigins(parents, { allowInsecure: test });

  verifyPyodide();
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(join(dist, "pyodide", config.pyodideVersion), { recursive: true });
  for (const name of RUNTIME_FILES) {
    cpSync(join(root, "node_modules/pyodide", name), join(dist, "pyodide", config.pyodideVersion, name));
  }

  const read = (p) => readFileSync(join(root, "src", p), "utf8");
  const protocol = strip(read("protocol.mjs"));
  const sink = strip(read("output-sink.mjs"));
  const fill = (template, map) => {
    let out = template;
    for (const [token, value] of Object.entries(map)) out = out.split(token).join(value);
    const left = out.match(/__[A-Z0-9_]+__/g);
    if (left) throw new Error(`unreplaced placeholders: ${[...new Set(left)].join(", ")}`);
    return out;
  };

  const worker = fill(read("worker.mjs"), {
    "/*__INCLUDE:protocol.mjs__*/": protocol,
    "/*__INCLUDE:output-sink.mjs__*/": sink,
    __PYODIDE_VERSION__: config.pyodideVersion,
    __HARDEN__: test ? "false" : "true",
    __TEST__: test ? "true" : "false",
    __LIMITS_JSON__: JSON.stringify(config.limits),
    __HARNESS_PY_JSON__: JSON.stringify(read("harness.py")),
    __RUNTIME_FILES_JSON__: JSON.stringify(RUNTIME_FILES),
  });
  const workerFile = `worker.${sha256(worker).slice(0, 12)}.mjs`;
  writeFileSync(join(dist, workerFile), worker);

  const bridgeConfig = {
    test,
    protocolVersion: config.protocolVersion,
    pyodideVersion: config.pyodideVersion,
    approvedParentOrigins: parents,
    limits: config.limits,
    workerFile,
  };
  const bridge = fill(read("bridge.mjs"), {
    "/*__INCLUDE:protocol.mjs__*/": protocol,
    __BRIDGE_CONFIG_JSON__: JSON.stringify(bridgeConfig),
  });
  const bridgeFile = `bridge.${sha256(bridge).slice(0, 12)}.mjs`;
  writeFileSync(join(dist, bridgeFile), bridge);

  writeFileSync(join(dist, "index.html"), fill(read("index.html"), { __BRIDGE_FILE__: bridgeFile }));
  const info = {
    protocolVersion: config.protocolVersion,
    pyodideVersion: config.pyodideVersion,
    workerFile,
    bridgeFile,
    approvedParentOrigins: parents,
    test,
  };
  cpSync(join(root, "THIRD-PARTY-NOTICES.txt"), join(dist, "THIRD-PARTY-NOTICES.txt"));
  writeFileSync(join(dist, "build-info.json"), JSON.stringify(info, null, 2) + "\n");
  return { dist, info, parents };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes("--update-manifest")) {
      verifyPyodide({ update: true });
      console.log("config/pyodide.sha256.json updated — review and commit it deliberately");
    } else {
      const { dist, info } = build({ test: process.argv.includes("--test") });
      console.log(`built ${dist} (worker ${info.workerFile}, bridge ${info.bridgeFile}, test=${info.test})`);
    }
  } catch (err) {
    console.error(String(err.message ?? err));
    process.exit(1);
  }
}
