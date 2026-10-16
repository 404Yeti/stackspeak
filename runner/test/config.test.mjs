import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { WORKER_CSP, bridgeCsp, headerRules, headersForPath, toVercelJson, validateOrigins } from "../scripts/lib/headers.mjs";

const require = createRequire(import.meta.url);
const { getTransformedRoutes } = require("@vercel/routing-utils");
const config = JSON.parse(readFileSync(new URL("../config/runner.config.json", import.meta.url), "utf8"));

test("worker CSP is exactly the reviewed string", () => {
  assert.equal(
    WORKER_CSP,
    "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'none'; base-uri 'none'; form-action 'none'",
  );
  assert.ok(!WORKER_CSP.includes("unsafe-eval'") || WORKER_CSP.includes("'wasm-unsafe-eval'"));
  assert.ok(!/\bunsafe-inline\b/.test(WORKER_CSP));
  assert.ok(!/data:|blob:|\*/.test(WORKER_CSP), "no data:/blob:/wildcard sources");
});

test("bridge CSP lists exactly the approved parents in frame-ancestors", () => {
  assert.equal(
    bridgeCsp(["https://stackspeak.vercel.app"]),
    "default-src 'none'; script-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors https://stackspeak.vercel.app",
  );
  assert.deepEqual(config.approvedParentOrigins, ["https://stackspeak.vercel.app"]);
});

test("origin validation rejects wildcards, paths, duplicates, http, and empties", () => {
  assert.throws(() => validateOrigins([]), /non-empty/);
  assert.throws(() => validateOrigins(["https://*.vercel.app"]), /wildcard/);
  assert.throws(() => validateOrigins(["https://stackspeak.vercel.app/"]), /bare origin/);
  assert.throws(() => validateOrigins(["https://stackspeak.vercel.app/x"]), /bare origin/);
  assert.throws(() => validateOrigins(["http://stackspeak.vercel.app"]), /https/);
  assert.throws(() => validateOrigins(["https://a.example", "https://a.example"]), /duplicate/);
  assert.throws(() => validateOrigins(["not a url"]), /valid origin/);
  assert.deepEqual(validateOrigins(["http://app.test"], { allowInsecure: true }), ["http://app.test"]);
  assert.throws(() => validateOrigins(["http://app.test"]), /https/);
});

test("committed vercel.json equals what the generator produces (no drift)", () => {
  const committed = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.deepEqual(committed, toVercelJson(headerRules(config)));
});

test("Vercel's own routing library accepts the config and agrees with the local matchers", () => {
  const rules = headerRules(config);
  const { error, routes } = getTransformedRoutes({ headers: toVercelJson(rules).headers });
  assert.equal(error, null, error && error.message);
  const samples = [
    ["/", "bridge-page-root"],
    ["/index.html", "bridge-page-index"],
    ["/worker.0123456789ab.mjs", "worker"],
    ["/bridge.0123456789ab.mjs", "bridge-script"],
    ["/pyodide/314.0.7/pyodide.asm.wasm", "pyodide"],
    ["/build-info.json", "build-info"],
    ["/worker.mjs", null], // unhashed names get no CSP rule (they do not exist in the build)
    ["/worker.0123456789ab.mjs.map", null],
    ["/worker.0123456789AB.mjs", null],
  ];
  for (const [path, id] of samples) {
    const local = rules.filter((r) => r.id !== "all" && r.test.test(path)).map((r) => r.id);
    assert.deepEqual(local, id ? [id] : [], `local match for ${path}`);
    const vercelMatches = routes.filter((r) => r.src && new RegExp(r.src).test(path) && !r.src.startsWith("^/(.*)"));
    const hasCsp = vercelMatches.some((r) => r.headers && r.headers["Content-Security-Policy"] === WORKER_CSP);
    assert.equal(hasCsp, id === "worker", `Vercel worker-CSP match for ${path}`);
  }
});

test("the worker CSP header reaches only the content-hashed worker file; the page gets frame-ancestors", () => {
  const rules = headerRules(config);
  assert.equal(headersForPath(rules, "/worker.0123456789ab.mjs")["Content-Security-Policy"], WORKER_CSP);
  assert.match(headersForPath(rules, "/")["Content-Security-Policy"], /frame-ancestors https:\/\/stackspeak\.vercel\.app$/);
  assert.equal(headersForPath(rules, "/bridge.0123456789ab.mjs")["Content-Security-Policy"], undefined);
  for (const p of ["/", "/worker.0123456789ab.mjs", "/pyodide/314.0.7/pyodide.mjs"]) {
    assert.equal(headersForPath(rules, p)["X-Content-Type-Options"], "nosniff");
    assert.equal(headersForPath(rules, p)["Referrer-Policy"], "no-referrer");
  }
  assert.equal(headersForPath(rules, "/pyodide/314.0.7/pyodide.asm.wasm")["Cache-Control"], "public, max-age=31536000, immutable");
  assert.equal(headersForPath(rules, "/")["Cache-Control"], "public, max-age=0, must-revalidate");
});
