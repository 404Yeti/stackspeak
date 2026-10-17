// DIAGNOSTIC ONLY (AUD-60, iOS). Served with EXACTLY the production worker CSP. It runs no student code and
// records how this browser reports Content-Security-Policy violations from inside a module worker, and — without
// relying on any event — whether the CSP really blocks a request to a reachable cross-origin host.
const WINDOW_MS = 2500;
const events = [];
let current = "none";
let propertyHandlerCalls = 0;

self.addEventListener("securitypolicyviolation", (e) => {
  events.push({
    at: performance.now(),
    probe: current,
    violated: e.violatedDirective,
    effective: e.effectiveDirective,
    blocked: String(e.blockedURI).slice(0, 60),
    disposition: e.disposition,
  });
});
self.onsecuritypolicyviolation = () => { propertyHandlerCalls++; };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errText = (e) => `${e && e.name}: ${String((e && e.message) || e).slice(0, 80)}`;

async function probe(name, start) {
  current = name;
  const t0 = performance.now();
  const result = { name, outcome: "pending", settleMs: null, detail: "", eventCount: 0, firstEventMs: null, events: [] };
  let started;
  try {
    started = start();
  } catch (e) {
    started = Promise.reject(e); // a synchronous throw is its own observation
    result.sync = true;
  }
  Promise.resolve(started).then(
    () => { result.outcome = "resolved"; result.settleMs = Math.round(performance.now() - t0); },
    (e) => { result.outcome = "rejected"; result.settleMs = Math.round(performance.now() - t0); result.detail = errText(e); },
  );
  await sleep(WINDOW_MS);
  const mine = events.filter((e) => e.probe === name);
  result.eventCount = mine.length;
  result.firstEventMs = mine.length ? Math.round(mine[0].at - t0) : null;
  result.events = mine.slice(0, 2).map((e) => ({ violated: e.violated, effective: e.effective, blocked: e.blocked, disposition: e.disposition }));
  return result;
}

self.onmessage = async (event) => {
  const { target } = event.data || {};
  const out = [];
  const xhr = () => new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("GET", "https://csp-canary.invalid/x");
    x.onload = () => resolve();
    x.onerror = () => reject(new Error("xhr error"));
    x.send();
  });
  const ws = () => new Promise((resolve, reject) => {
    const w = new WebSocket("wss://csp-canary.invalid/");
    w.onopen = () => resolve();
    w.onerror = () => reject(new Error("websocket error"));
    w.onclose = () => reject(new Error("websocket closed"));
  });
  const steps = [
    ["canary-as-production (fetch no-cors, .invalid)", () => fetch("https://csp-canary.invalid/probe", { mode: "no-cors" })],
    ["fetch cors, .invalid", () => fetch("https://csp-canary.invalid/probe")],
    ["xhr, .invalid", xhr],
    ["websocket, .invalid", ws],
    ["dynamic import, .invalid", () => import("https://csp-canary.invalid/x.mjs")],
    ["REACHABLE cross-origin fetch no-cors (resolved = CSP NOT enforced)", () => fetch(target, { mode: "no-cors" })],
    ["same-origin control (must resolve)", () => fetch("/build-info.json")],
  ];
  for (const [name, fn] of steps) {
    out.push(await probe(name, fn));
    self.postMessage({ type: "progress", done: out.length, total: steps.length });
  }
  self.postMessage({ type: "done", probes: out, propertyHandlerCalls, totalEvents: events.length });
};
