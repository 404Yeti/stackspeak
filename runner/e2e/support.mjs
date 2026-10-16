import http from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { test as base, expect } from "@playwright/test";
import { startServer } from "../scripts/serve.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const runnerRoot = join(here, "..");
const clientSrc = join(runnerRoot, "..", "frontend", "src", "lib", "pythonRunner");

export const PROD_PARENT = "https://stackspeak.vercel.app"; // the production approved origin (faked via route)
// https so the faked app is a SECURE context: CacheStorage, IndexedDB and BroadcastChannel then exist on the
// app side, which is what makes the "student code did not touch app-origin state" assertions meaningful.
export const TEST_PARENT = "https://app.test";
export const DEPLOYED_URL = process.env.RUNNER_BASE_URL?.replace(/\/$/, "") || null;
export const deployed = DEPLOYED_URL !== null;

/** Transpile the real frontend client (TypeScript) to ES modules the browser can import. */
function clientModule(name) {
  const source = readFileSync(join(clientSrc, `${name}.ts`), "utf8");
  return ts
    .transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
    .outputText.replace(/from "\.\/(\w+)"/g, 'from "./$1.js"');
}

const HOST_HTML = `<!doctype html><meta charset="utf-8"><title>app (simulated)</title>
<script type="module">
  import { PythonRunnerClient } from "/__client/client.js";
  window.PythonRunnerClient = PythonRunnerClient;
  window.__bc = [];
  window.__channel = new BroadcastChannel("leak");
  window.__channel.onmessage = (e) => window.__bc.push(String(e.data));
  document.cookie = "visible_cookie=VISIBLE_COOKIE; path=/";
  localStorage.setItem("app_secret", "LOCALSTORAGE_SECRET");
  window.__ready = true;
</script>`;

/**
 * Makes `hostOrigin` look like the StackSpeak app: serves the host page, the transpiled client, and a
 * "secret" API with a cookie — all intercepted in the browser, so nothing real is touched.
 */
export async function installHost(context, hostOrigin, log) {
  await context.route(`${hostOrigin}/**`, async (route) => {
    const url = new URL(route.request().url());
    const headers = await route.request().allHeaders();
    log.hostRequests.push(`${route.request().method()} ${url.pathname} cookie=${headers.cookie ? "yes" : "no"}`);
    if (url.pathname === "/__runner-host") return route.fulfill({ status: 200, contentType: "text/html", body: HOST_HTML });
    const mod = url.pathname.match(/^\/__client\/(protocol|session|client)\.js$/);
    if (mod) return route.fulfill({ status: 200, contentType: "text/javascript", body: clientModule(mod[1]) });
    if (url.pathname === "/api/secret") {
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "set-cookie": "session=SECRET; Path=/; HttpOnly" }, body: '{"secret":"TOP-SECRET"}' });
    }
    return route.fulfill({ status: 404, body: "not found" });
  });
}

function startAttacker() {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    res.writeHead(200, { "access-control-allow-origin": "*", "content-type": "text/javascript" });
    res.end("/* attacker */");
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({
    seen, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)),
  })));
}

/**
 * A REAL server standing in for the app's API on another site (localhost vs the runner's 127.0.0.1), with
 * a cookie set and — like the real app — NO CORS headers. It must be real: Playwright's route.fulfill
 * silently adds permissive CORS headers to intercepted cross-origin responses, which would make
 * "student code cannot read the app's API" untestable.
 */
function startAppApi() {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(`${req.method} ${req.url} cookie=${req.headers.cookie ? "yes" : "no"}`);
    res.writeHead(200, { "content-type": "application/json", "set-cookie": "session=SECRET; Path=/; HttpOnly" });
    res.end('{"secret":"TOP-SECRET"}');
  });
  return new Promise((resolve) => server.listen(0, () => resolve({
    requests, url: `http://localhost:${server.address().port}`, close: () => new Promise((r) => server.close(r)),
  })));
}

export const test = base.extend({
  appApi: [async ({}, use) => {
    const api = await startAppApi();
    await use(api);
    await api.close();
  }, { scope: "worker" }],

  // Production build (hardening ON, approved parent = the real production origin), served locally.
  prodRunner: [async ({}, use) => {
    if (deployed) return use({ url: DEPLOYED_URL, parent: PROD_PARENT, deployed: true, close: async () => {} });
    const s = await startServer({ dist: join(runnerRoot, "dist"), parents: [PROD_PARENT] });
    await use({ url: s.url, parent: PROD_PARENT, deployed: false, close: s.close });
    await s.close();
  }, { scope: "worker" }],

  // Test build (hardening OFF so the CSP is tested on its own, test hooks ON). Never deployed.
  testRunner: [async ({}, use) => {
    const s = await startServer({ dist: join(runnerRoot, "dist-test"), parents: [TEST_PARENT] });
    const noCsp = await startServer({ dist: join(runnerRoot, "dist-test"), parents: [TEST_PARENT], stripWorkerCsp: true });
    await use({ url: s.url, parent: TEST_PARENT, noCspUrl: noCsp.url });
    await s.close();
    await noCsp.close();
  }, { scope: "worker" }],

  attacker: [async ({}, use) => {
    const a = await startAttacker();
    await use(a);
    await a.close();
  }, { scope: "worker" }],

  /** A page that looks like the app (at `parent`), with request logging across every frame/worker. */
  appPage: async ({ browser, appApi }, use) => {
    const made = [];
    await use(async (parentOrigin) => {
      const app = await openApp(browser, parentOrigin, appApi.url);
      made.push(app.context);
      return app;
    });
    for (const c of made) await c.close().catch(() => {});
  },
});

/** Open a context+page that look like the app at `parentOrigin`. Caller owns closing the context. */
export async function openApp(browser, parentOrigin, appApiUrl) {
  const context = await browser.newContext();
  const log = { hostRequests: [], requests: [] };
  context.on("request", (r) => log.requests.push({ method: r.method(), url: r.url(), post: r.postData() ?? "" }));
  await installHost(context, parentOrigin, log);
  // Modelled on what the real app MUST use for session cookies: explicit SameSite=Lax + HttpOnly. (Firefox does
  // not treat a missing SameSite attribute as Lax the way Chromium does, so the attribute has to be explicit.)
  if (appApiUrl) await context.addCookies([{ name: "session", value: "SECRET", url: appApiUrl, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  await page.goto(`${parentOrigin}/__runner-host`);
  await page.waitForFunction(() => window.__ready === true);
  return { context, page, log };
}

export { expect };

/** Create the client + connect in the page; helpers return plain, serialisable results. */
export async function connect(page, runnerUrl, options = {}) {
  await page.evaluate(({ runnerUrl, options }) => {
    window.__client = new window.PythonRunnerClient({ runnerUrl, ...options });
    window.__session = window.__client.connect();
  }, { runnerUrl, options });
}

export function runCode(page, code) {
  return page.evaluate(async (code) => {
    try {
      return { ok: await window.__session.run(code) };
    } catch (error) {
      return { error: { kind: error.kind, reason: error.reason, message: String(error.message), retryable: error.retryable } };
    }
  }, code);
}

export async function waitReady(page) {
  return page.evaluate(async () => {
    try { return { ok: await window.__session.ready }; } catch (e) { return { error: { kind: e.kind, message: String(e.message) } }; }
  });
}

export const workerCount = (page) => page.workers().length;
