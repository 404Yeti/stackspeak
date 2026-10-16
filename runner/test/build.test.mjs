import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const run = (args, env = {}) => execFileSync("node", ["scripts/build.mjs", ...args], { cwd: root, env: { ...process.env, ...env }, encoding: "utf8", stdio: "pipe" });

test("production build: self-hosted runtime, hashed files, hardening ON, no test hooks", () => {
  run([]);
  const info = JSON.parse(readFileSync(join(root, "dist/build-info.json"), "utf8"));
  assert.equal(info.test, false);
  assert.deepEqual(info.approvedParentOrigins, ["https://stackspeak.vercel.app"]);
  const worker = readFileSync(join(root, "dist", info.workerFile), "utf8");
  const bridge = readFileSync(join(root, "dist", info.bridgeFile), "utf8");
  assert.match(worker, /const HARDEN = true;/);
  assert.match(worker, /const TEST = false;/);
  assert.match(bridge, /"test":false/);
  assert.ok(!/__[A-Z0-9_]+__/.test(worker + bridge), "no unreplaced placeholders");
  assert.ok(!/https?:\/\/(cdn|unpkg|esm)\./.test(worker + bridge), "no CDN at runtime");
  for (const f of ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) {
    assert.ok(existsSync(join(root, "dist/pyodide", info.pyodideVersion, f)), f);
  }
  assert.match(readFileSync(join(root, "dist/index.html"), "utf8"), new RegExp(`src="/${info.bridgeFile.replace(".", "\\.")}"`));
});

test("production build ignores RUNNER_TEST_PARENTS (approval only via the committed config)", () => {
  run([], { RUNNER_TEST_PARENTS: "https://evil.example" });
  const info = JSON.parse(readFileSync(join(root, "dist/build-info.json"), "utf8"));
  assert.deepEqual(info.approvedParentOrigins, ["https://stackspeak.vercel.app"]);
});

test("test build is a separate tree with hooks on and hardening off", () => {
  run(["--test"]);
  const info = JSON.parse(readFileSync(join(root, "dist-test/build-info.json"), "utf8"));
  assert.equal(info.test, true);
  const testWorker = readFileSync(join(root, "dist-test", info.workerFile), "utf8");
  assert.match(testWorker, /const HARDEN = false;/);
  assert.match(testWorker, /const TEST = true;/);
});

test("build FAILS when a runtime file does not match the committed SHA-256 manifest", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "runner-integrity-"));
  try {
    for (const d of ["scripts", "src", "config"]) cpSync(join(root, d), join(sandbox, d), { recursive: true });
    cpSync(join(root, "package.json"), join(sandbox, "package.json"));
    cpSync(join(root, "node_modules/pyodide"), join(sandbox, "node_modules/pyodide"), { recursive: true });
    writeFileSync(join(sandbox, "node_modules/pyodide/python_stdlib.zip"), "tampered");
    assert.throws(
      () => execFileSync("node", ["scripts/build.mjs"], { cwd: sandbox, encoding: "utf8", stdio: "pipe" }),
      (err) => /INTEGRITY FAILURE: python_stdlib\.zip/.test(String(err.stderr)),
    );
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("build FAILS when the installed pyodide version differs from the pin", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "runner-version-"));
  try {
    for (const d of ["scripts", "src", "config"]) cpSync(join(root, d), join(sandbox, d), { recursive: true });
    cpSync(join(root, "node_modules/pyodide"), join(sandbox, "node_modules/pyodide"), { recursive: true });
    const pkgPath = join(sandbox, "node_modules/pyodide/package.json");
    writeFileSync(pkgPath, readFileSync(pkgPath, "utf8").replace('"version": "314.0.7"', '"version": "314.0.8"'));
    assert.throws(
      () => execFileSync("node", ["scripts/build.mjs"], { cwd: sandbox, encoding: "utf8", stdio: "pipe" }),
      (err) => /pins 314\.0\.7|installed/.test(String(err.stderr)),
    );
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("build FAILS on unapproved origins in the committed config", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "runner-origin-"));
  try {
    for (const d of ["scripts", "src", "config"]) cpSync(join(root, d), join(sandbox, d), { recursive: true });
    cpSync(join(root, "node_modules/pyodide"), join(sandbox, "node_modules/pyodide"), { recursive: true });
    const cfgPath = join(sandbox, "config/runner.config.json");
    writeFileSync(cfgPath, readFileSync(cfgPath, "utf8").replace("https://stackspeak.vercel.app", "https://*.vercel.app"));
    assert.throws(
      () => execFileSync("node", ["scripts/build.mjs"], { cwd: sandbox, encoding: "utf8", stdio: "pipe" }),
      (err) => /wildcards are not allowed/.test(String(err.stderr)),
    );
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
