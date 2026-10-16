// Verifies a DEPLOYED runner. Local servers prove nothing about Vercel's edge, so this asserts, against
// real HTTP responses, that:
//   * the worker and bridge page carry EXACTLY the reviewed CSP (scripts/lib/headers.mjs);
//   * the served worker/bridge bytes hash to the content-hash in their filenames;
//   * every Pyodide runtime file served matches the committed SHA-256 manifest;
//   * caching/nosniff/referrer headers are as specified, no cookies are set, unhashed paths 404.
//
//   node scripts/verify-deployment.mjs https://<runner>.vercel.app
//
// Exit code 0 only if every check passes. Prints JSON evidence (raw header values) either way.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IMMUTABLE, REVALIDATE, WORKER_CSP, bridgeCsp } from "./lib/headers.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(join(root, "config/runner.config.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(root, "config/pyodide.sha256.json"), "utf8"));
const base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("usage: node scripts/verify-deployment.mjs https://<runner-origin>");
  process.exit(2);
}

const checks = [];
const evidence = {};
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), ...(ok ? {} : { detail }) });
}

async function get(path, { binary = false } = {}) {
  const res = await fetch(base + path, { redirect: "manual", headers: { "accept-encoding": "identity" } });
  const body = binary ? Buffer.from(await res.arrayBuffer()) : Buffer.from(await res.arrayBuffer());
  const h = (n) => res.headers.get(n);
  evidence[path] = {
    status: res.status,
    "content-type": h("content-type"),
    "content-security-policy": h("content-security-policy"),
    "cache-control": h("cache-control"),
    "x-content-type-options": h("x-content-type-options"),
    "referrer-policy": h("referrer-policy"),
    "permissions-policy": h("permissions-policy") ? "(present)" : null,
    "set-cookie": h("set-cookie"),
    "content-encoding": h("content-encoding"),
    bytes: body.length,
  };
  return { res, body, h };
}

function commonHeaders(path, r) {
  check(`${path}: 200`, r.res.status === 200, `status ${r.res.status}`);
  check(`${path}: X-Content-Type-Options: nosniff`, r.h("x-content-type-options") === "nosniff", r.h("x-content-type-options"));
  check(`${path}: Referrer-Policy: no-referrer`, r.h("referrer-policy") === "no-referrer", r.h("referrer-policy"));
  check(`${path}: no Set-Cookie`, !r.h("set-cookie"), r.h("set-cookie"));
}

const notices = await get("/THIRD-PARTY-NOTICES.txt");
commonHeaders("/THIRD-PARTY-NOTICES.txt", notices);
check("/THIRD-PARTY-NOTICES.txt: served with the MPL-2.0 notice", notices.res.status === 200 && notices.body.toString("utf8").includes("MPL-2.0"), `status ${notices.res.status}`);

const infoRes = await get("/build-info.json");
commonHeaders("/build-info.json", infoRes);
let info = {};
try { info = JSON.parse(infoRes.body.toString("utf8")); } catch { check("/build-info.json parses", false, "not JSON"); }
check("build-info: production build (test=false)", info.test === false, JSON.stringify(info.test));
check("build-info: approved parents == committed config", JSON.stringify(info.approvedParentOrigins) === JSON.stringify(config.approvedParentOrigins), JSON.stringify(info.approvedParentOrigins));
check("build-info: pyodide version == pinned", info.pyodideVersion === config.pyodideVersion, info.pyodideVersion);
check("/build-info.json: Cache-Control revalidates", infoRes.h("cache-control") === REVALIDATE, infoRes.h("cache-control"));

const page = await get("/");
commonHeaders("/", page);
check("/: bridge-page CSP is exactly the reviewed string (frame-ancestors = approved parents)", page.h("content-security-policy") === bridgeCsp(config.approvedParentOrigins), page.h("content-security-policy"));
check("/: Cache-Control revalidates", page.h("cache-control") === REVALIDATE, page.h("cache-control"));
check("/: Permissions-Policy present", Boolean(page.h("permissions-policy")), null);
check("/: references the bridge file named in build-info", page.body.toString("utf8").includes(`/${info.bridgeFile}`), info.bridgeFile);

for (const [label, file] of [["worker", info.workerFile], ["bridge", info.bridgeFile]]) {
  const path = `/${file}`;
  const r = await get(path);
  commonHeaders(path, r);
  check(`${path}: content-type is JavaScript`, /^text\/javascript|^application\/javascript/.test(r.h("content-type") ?? ""), r.h("content-type"));
  check(`${path}: immutable cache`, r.h("cache-control") === IMMUTABLE, r.h("cache-control"));
  const hashFromName = file.split(".")[1];
  check(`${path}: served bytes hash to the content hash in the filename`, sha(r.body).startsWith(hashFromName), `sha256=${sha(r.body).slice(0, 12)} name=${hashFromName}`);
  if (label === "worker") {
    check(`${path}: worker CSP is exactly the reviewed string`, r.h("content-security-policy") === WORKER_CSP, r.h("content-security-policy"));
    check(`${path}: hardening is ON and test hooks are OFF in the deployed worker`, /const HARDEN = true;/.test(r.body.toString("utf8")) && /const TEST = false;/.test(r.body.toString("utf8")), "worker was built with test/hardening flags");
  }
}

for (const [name, expected] of Object.entries(manifest.files)) {
  const path = `/pyodide/${manifest.version}/${name}`;
  const r = await get(path, { binary: true });
  commonHeaders(path, r);
  check(`${path}: immutable cache`, r.h("cache-control") === IMMUTABLE, r.h("cache-control"));
  check(`${path}: SHA-256 matches the committed manifest`, sha(r.body) === expected.sha256, `got ${sha(r.body)}`);
  if (name.endsWith(".wasm")) check(`${path}: content-type application/wasm`, r.h("content-type") === "application/wasm", r.h("content-type"));
}

const stale = await get("/worker.mjs");
check("/worker.mjs (unhashed) is not served", stale.res.status === 404, `status ${stale.res.status}`);
const missing = await get(`/pyodide/${manifest.version}/does-not-exist.wasm`);
check("missing runtime file is a real 404", missing.res.status === 404, `status ${missing.res.status}`);

const failed = checks.filter((c) => !c.ok);
console.log(JSON.stringify({ base, verifiedAt: new Date().toISOString(), passed: checks.length - failed.length, failed: failed.length, failures: failed, evidence }, null, 2));
process.exit(failed.length ? 1 : 0);
