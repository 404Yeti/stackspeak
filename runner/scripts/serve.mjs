// Local static server for the runner. Applies the SAME header rules the committed vercel.json carries
// (scripts/lib/headers.mjs). Test-only switches exist solely to prove the fail-closed behaviour.
import http from "node:http";
import https from "node:https";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { headerRules, headersForPath } from "./lib/headers.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".wasm": "application/wasm", ".zip": "application/zip" };
const COMPRESSIBLE = new Set([".html", ".mjs", ".js", ".json", ".wasm"]);

/**
 * @param {object} o
 * @param {string} o.dist            directory to serve
 * @param {string[]} o.parents       approved parent origins (drives frame-ancestors)
 * @param {number} [o.port]
 * @param {{key: string, cert: string}} [o.tls]   serve https (the e2e suite needs it: WebKit blocks http iframes in https pages)
 * @param {boolean} [o.stripWorkerCsp]   TEST ONLY: drop the worker CSP header (proves Run fails closed)
 * @param {(req, status) => void} [o.onRequest]
 */
export function startServer({ dist, parents, port = 0, host = "127.0.0.1", stripWorkerCsp = false, tls, onRequest }) {
  const base = resolve(dist);
  const rules = headerRules({ approvedParentOrigins: parents });
  const cache = new Map();
  const handler = (req, res) => {
    const url = new URL(req.url, "http://runner.local");
    let pathname = decodeURIComponent(url.pathname);
    const file = resolve(join(base, normalize(pathname === "/" ? "/index.html" : pathname)));
    const finish = (status) => onRequest?.(req, status);
    if (!file.startsWith(base + "/") || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { "content-type": "text/plain", "x-content-type-options": "nosniff" });
      res.end("not found");
      return finish(404);
    }
    const headers = { ...headersForPath(rules, pathname), "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" };
    if (stripWorkerCsp && /^\/worker\./.test(pathname)) delete headers["Content-Security-Policy"];
    const ext = extname(file);
    if (req.method !== "HEAD" && COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers["accept-encoding"] ?? "")) {
      if (!cache.has(file)) cache.set(file, gzipSync(readFileSync(file), { level: 6 }));
      const body = cache.get(file);
      res.writeHead(200, { ...headers, "Content-Encoding": "gzip", "Content-Length": body.length, Vary: "Accept-Encoding" });
      res.end(body);
    } else {
      res.writeHead(200, { ...headers, "Content-Length": statSync(file).size });
      if (req.method === "HEAD") res.end();
      else createReadStream(file).pipe(res);
    }
    finish(200);
  };
  const server = tls ? https.createServer(tls, handler) : http.createServer(handler);
  return new Promise((resolveListen) => {
    server.listen(port, host, () => resolveListen({ server, url: `${tls ? "https" : "http"}://${host}:${server.address().port}`, close: () => new Promise((r) => server.close(r)) }));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i === -1 ? fallback : process.argv[i + 1]; };
  const config = JSON.parse(readFileSync(join(root, "config/runner.config.json"), "utf8"));
  const dist = arg("dist", "dist");
  const parents = (arg("parents", dist === "dist" ? config.approvedParentOrigins.join(",") : "https://app.test")).split(",");
  startServer({ dist: join(root, dist), parents, port: Number(arg("port", 4010)), stripWorkerCsp: process.argv.includes("--strip-worker-csp") })
    .then(({ url }) => console.log(`runner (${dist}) listening on ${url} — parents: ${parents.join(", ")}`));
}
