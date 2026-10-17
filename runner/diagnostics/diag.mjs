// DIAGNOSTIC ONLY (AUD-60, iOS). Collects browser facts, a document-level CSP-event control, a reachability
// control for the cross-origin target, and runs probe.mjs (a module worker under the production worker CSP).
const verdictEl = document.getElementById("verdict");
const reportEl = document.getElementById("report");
const copyBtn = document.getElementById("copy");

const params = new URLSearchParams(location.search);
let target;
try {
  const u = new URL(params.get("target") || "https://stackspeak-runner.vercel.app");
  if (u.protocol !== "https:") throw new Error("target must be https");
  target = u.origin + "/build-info.json";
} catch (e) {
  target = "https://stackspeak-runner.vercel.app/build-info.json";
}

const ua = navigator.userAgent;
const env = {
  userAgent: ua,
  iosVersion: (ua.match(/OS (\d+[_\d]*) like Mac OS X/) || [])[1]?.replace(/_/g, ".") ?? null,
  looksLikeInAppBrowser: /\b(FBAN|FBAV|Instagram|Line|GSA|CriOS|FxiOS|EdgiOS|Twitter|LinkedInApp)\b/.test(ua) || (/iPhone|iPad/.test(ua) && !/Safari\//.test(ua)),
  isSecureContext: window.isSecureContext,
  crossOriginIsolated: window.crossOriginIsolated,
  webAssembly: typeof WebAssembly,
  moduleWorker: typeof Worker,
  hardwareConcurrency: navigator.hardwareConcurrency ?? null,
  language: navigator.language,
  target,
};

async function documentControl() {
  // Does this browser deliver the event for a violation in the DOCUMENT? (the page CSP allows https: only)
  let seen = null;
  const onEvent = (e) => { seen = { violated: e.violatedDirective, blocked: String(e.blockedURI).slice(0, 60) }; };
  document.addEventListener("securitypolicyviolation", onEvent, { once: true });
  try { await fetch("http://csp-canary.invalid/", { mode: "no-cors" }); } catch { /* expected */ }
  await new Promise((r) => setTimeout(r, 1500));
  document.removeEventListener("securitypolicyviolation", onEvent);
  return { documentEventDelivered: seen !== null, event: seen };
}

async function targetReachableFromPage() {
  try { await fetch(target, { mode: "no-cors", cache: "no-store" }); return true; } catch { return false; }
}

function verdict(probes, pageReach) {
  const find = (prefix) => probes.find((p) => p.name.startsWith(prefix));
  const canary = find("canary-as-production");
  const reach = find("REACHABLE");
  const control = find("same-origin");
  if (!pageReach) return "INCONCLUSIVE: the cross-origin target is not reachable from this page (offline or blocked network). Re-run on a working connection.";
  if (!control || control.outcome !== "resolved") return "INCONCLUSIVE: the same-origin control request failed, so network results cannot be trusted.";
  if (reach.outcome === "resolved") return "UNSAFE: the worker reached a cross-origin host, so this browser did NOT enforce the worker CSP. Run Code must stay off here.";
  if (canary.eventCount === 0) return "CSP IS ENFORCED but this browser delivers no securitypolicyviolation event in the worker, so the production canary cannot succeed here (this is why Run Code reports it cannot be made safe).";
  return `CSP is enforced and the event WAS delivered (${canary.firstEventMs} ms). The production canary should pass here; look for a different cause (timing or load).`;
}

function finish(probes, extra, pageReach, doc) {
  const text = verdict(probes, pageReach);
  verdictEl.textContent = text;
  const report = { when: new Date().toISOString(), verdict: text, env, pageReachedTarget: pageReach, document: doc, worker: { ...extra, probes } };
  reportEl.textContent = JSON.stringify(report, null, 2);
  copyBtn.disabled = false;
  copyBtn.onclick = async () => {
    try { await navigator.clipboard.writeText(reportEl.textContent); copyBtn.textContent = "Copied"; } catch { copyBtn.textContent = "Select the text below and copy it"; }
  };
  window.__diagReport = report;
  window.__diagDone = true;
}

(async () => {
  const doc = await documentControl();
  const pageReach = await targetReachableFromPage();
  let worker;
  try {
    worker = new Worker("/diag/probe.mjs", { type: "module", name: "csp-diagnostic" });
  } catch (e) {
    verdictEl.textContent = "This browser cannot start module workers.";
    reportEl.textContent = JSON.stringify({ env, error: String(e) }, null, 2);
    window.__diagReport = { env, error: String(e) };
    window.__diagDone = true;
    return;
  }
  worker.onerror = (e) => finish([], { workerError: String(e.message || "worker error") }, pageReach, doc);
  worker.onmessage = (event) => {
    const m = event.data;
    if (m.type === "progress") verdictEl.textContent = `Running… ${m.done}/${m.total}`;
    if (m.type === "done") {
      finish(m.probes, { propertyHandlerCalls: m.propertyHandlerCalls, totalEvents: m.totalEvents }, pageReach, doc);
      worker.terminate();
    }
  };
  worker.postMessage({ target });
})();
