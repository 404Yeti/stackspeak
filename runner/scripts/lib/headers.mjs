// Single source of truth for the runner's response headers. Used by:
//   * scripts/generate-config.mjs -> the committed vercel.json (Vercel delivers these headers)
//   * scripts/serve.mjs           -> the local server the Playwright security tests run against
//   * scripts/verify-deployment.mjs -> asserts a DEPLOYED runner returns exactly these
// so the tests exercise the same rules production serves. (A local server still proves nothing about
// Vercel's edge — verify-deployment exists for that.)

export const WORKER_CSP =
  "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'none'; base-uri 'none'; form-action 'none'";

export function bridgeCsp(parentOrigins) {
  return (
    "default-src 'none'; script-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors " +
    parentOrigins.join(" ")
  );
}

export const IMMUTABLE = "public, max-age=31536000, immutable";
export const REVALIDATE = "public, max-age=0, must-revalidate";

const PERMISSIONS_POLICY = [
  "accelerometer", "autoplay", "camera", "clipboard-read", "display-capture", "geolocation", "gyroscope",
  "hid", "magnetometer", "microphone", "midi", "payment", "publickey-credentials-get", "serial", "usb",
  "xr-spatial-tracking",
].map((f) => `${f}=()`).join(", ");

/** Origins must be exact, explicit, and https (http only for loopback/test hosts when allowed). */
export function validateOrigins(origins, { allowInsecure = false } = {}) {
  if (!Array.isArray(origins) || origins.length === 0) throw new Error("approvedParentOrigins must be a non-empty array");
  const seen = new Set();
  for (const origin of origins) {
    if (typeof origin !== "string") throw new Error(`origin must be a string: ${origin}`);
    if (origin.includes("*")) throw new Error(`wildcards are not allowed: ${origin}`);
    let url;
    try { url = new URL(origin); } catch { throw new Error(`not a valid origin: ${origin}`); }
    if (url.origin !== origin) throw new Error(`must be a bare origin (scheme://host[:port], no path/trailing slash): ${origin}`);
    if (url.protocol !== "https:" && !(allowInsecure && url.protocol === "http:")) {
      throw new Error(`origin must be https: ${origin}`);
    }
    if (seen.has(origin)) throw new Error(`duplicate origin: ${origin}`);
    seen.add(origin);
  }
  return origins;
}

/**
 * Ordered header rules. `source` is Vercel path syntax (what vercel.json carries); `test` is the
 * equivalent RegExp the local server uses. scripts/test checks the two agree via @vercel/routing-utils.
 */
export function headerRules({ approvedParentOrigins }) {
  const csp = bridgeCsp(approvedParentOrigins);
  const page = { "Content-Security-Policy": csp, "Cache-Control": REVALIDATE };
  return [
    {
      id: "all",
      source: "/(.*)",
      test: /^\/.*$/,
      headers: {
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Permissions-Policy": PERMISSIONS_POLICY,
      },
    },
    { id: "bridge-page-root", source: "/", test: /^\/$/, headers: page },
    { id: "bridge-page-index", source: "/index.html", test: /^\/index\.html$/, headers: page },
    {
      id: "worker",
      source: "/(worker\\.[a-f0-9]{12}\\.mjs)",
      test: /^\/worker\.[a-f0-9]{12}\.mjs$/,
      headers: { "Content-Security-Policy": WORKER_CSP, "Cache-Control": IMMUTABLE },
    },
    {
      id: "bridge-script",
      source: "/(bridge\\.[a-f0-9]{12}\\.mjs)",
      test: /^\/bridge\.[a-f0-9]{12}\.mjs$/,
      headers: { "Cache-Control": IMMUTABLE },
    },
    { id: "pyodide", source: "/pyodide/(.*)", test: /^\/pyodide\/.*$/, headers: { "Cache-Control": IMMUTABLE } },
    { id: "build-info", source: "/build-info.json", test: /^\/build-info\.json$/, headers: { "Cache-Control": REVALIDATE } },
  ];
}

/** Headers the rules produce for a given path (later rules override earlier ones, like Vercel). */
export function headersForPath(rules, pathname) {
  const out = {};
  for (const rule of rules) {
    if (rule.test.test(pathname)) Object.assign(out, rule.headers);
  }
  return out;
}

export function toVercelJson(rules) {
  return {
    headers: rules.map((rule) => ({
      source: rule.source,
      headers: Object.entries(rule.headers).map(([key, value]) => ({ key, value })),
    })),
  };
}
