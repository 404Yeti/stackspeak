// StackSpeak Python runner — module Web Worker. One worker serves exactly ONE run and is then
// terminated by the bridge, so every run starts from a pristine interpreter.
//
// Built by scripts/build.mjs: placeholders below are substituted, protocol.mjs and output-sink.mjs
// are inlined, and the file is content-hashed (worker.<hash>.mjs). Served with its own strict CSP
// (see scripts/lib/headers.mjs). This code is NOT trusted to be a sandbox: the boundary is the
// browser (cross-site origin) plus that CSP, enforced by the browser, proven at runtime by the canary.

/*__INCLUDE:protocol.mjs__*/
/*__INCLUDE:output-sink.mjs__*/

const PYODIDE_VERSION = "__PYODIDE_VERSION__";
const HARDEN = __HARDEN__;
const TEST = __TEST__; // test builds only; in production this is the literal `false`
const LIMITS = __LIMITS_JSON__;
const HARNESS_PY = __HARNESS_PY_JSON__;
const RUNTIME_FILES = __RUNTIME_FILES_JSON__;

let started = false;
let port = null;
let py = null;
let sink = null;

// RULE: register the message handler synchronously, before the first `await`. A module worker
// delivers messages while top-level/async work is pending; a message with no handler is dropped
// silently and the run would hang forever (reproduced in the AUD-60 spike).
self.onmessage = (event) => {
  if (started) return;
  const start = parseStart(event.data);
  if (!start) return;
  started = true;
  port = start.port;
  port.onmessage = onPortMessage;
  boot(start).catch((err) => fatal("init-failed", err));
};

function describe(err) {
  // Emscripten/Pyodide sometimes throw non-Error objects ("[object Object]" otherwise).
  try {
    if (err && typeof err.message === "string" && err.message) return err.message.slice(0, 400);
    if (typeof err === "string") return err.slice(0, 400);
    return JSON.stringify(err).slice(0, 400);
  } catch {
    return "unknown error";
  }
}

function fatal(reason, err) {
  port.postMessage({ t: "fatal", reason, message: typeof err === "string" ? err : describe(err) });
}

// Prove the browser enforces THIS worker's CSP: provoke a request the policy must block and require
// the resulting `securitypolicyviolation` event. Without it, Run fails closed.
function cspCanary() {
  return new Promise((resolve) => {
    let seen = false;
    self.addEventListener("securitypolicyviolation", () => { seen = true; resolve(true); }, { once: true });
    try {
      fetch("https://csp-canary.invalid/probe", { mode: "no-cors" }).catch(() => {});
    } catch {
      /* a synchronous throw is not evidence of enforcement */
    }
    setTimeout(() => resolve(seen), 1500);
  });
}

// Pyodide swallows a failed runtime download and then hangs until the init timeout (a 404 for the wasm
// produced no error at all — measured). So download every runtime file ourselves first: a missing or
// failing file fails in milliseconds with its URL and status, and the HTTP cache (immutable) then serves
// Pyodide's own requests, so nothing is downloaded twice.
async function preflight(base) {
  await Promise.all(
    RUNTIME_FILES.map(async (name) => {
      const response = await fetch(base + name);
      if (!response.ok) throw new Error("runtime file " + name + " failed to load (HTTP " + response.status + ")");
      await response.arrayBuffer();
    }),
  );
}

async function boot({ mode, snapshot, failRestore, skipCanary }) {
  const t0 = performance.now();
  if (typeof WebAssembly !== "object") return fatal("unsupported", "WebAssembly is not available");

  // skipCanary exists ONLY so the test suite can prove the CSP-less control actually leaks; it is dead code in production.
  const enforced = TEST && skipCanary ? true : await cspCanary();
  if (!enforced) return fatal("csp-not-enforced", "The browser did not enforce the worker's Content-Security-Policy");

  const base = new URL("/pyodide/" + PYODIDE_VERSION + "/", self.location.href).href;
  await preflight(base);
  const { loadPyodide } = await import(base + "pyodide.mjs");

  const options = { indexURL: base, fullStdLib: false };
  if (mode === "build") options._makeSnapshot = true;
  if (mode === "restore") {
    if (failRestore) return fatal("restore-failed", "restore failure injected by a test hook");
    options._loadSnapshot = snapshot;
  }
  try {
    py = await loadPyodide(options);
  } catch (err) {
    return fatal(mode === "restore" ? "restore-failed" : "init-failed", err);
  }

  if (mode !== "restore") py.runPython(HARNESS_PY); // a restored snapshot already contains the harness

  if (mode === "build") {
    // Taken BEFORE any student code runs. The snapshot API is private to Pyodide, so failure is an
    // expected, supported outcome: the bridge falls back to cold starts.
    try {
      const bytes = py.makeMemorySnapshot();
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      port.postMessage({ t: "snapshot", buffer }, [buffer]);
    } catch (err) {
      port.postMessage({ t: "snapshot-unavailable", message: describe(err) });
    }
  }

  if (mode === "build") {
    // The builder exists ONLY to produce the snapshot. Its interpreter is never used for student code:
    // after makeMemorySnapshot() its JS interop is not trustworthy (measured: js.navigator throws
    // "Illegal invocation"), and every run must behave identically. The bridge terminates it.
    return port.postMessage({ t: "ready", initMs: performance.now() - t0, mode });
  }

  py.runPython("_prepare()");
  sink = createOutputSink({
    limitBytes: LIMITS.outputLimitBytes,
    onChunk: (stream, text) => port.postMessage({ t: "out", stream, text }),
  });
  py.setStdout({ raw: sink.stdout });
  py.setStderr({ raw: sink.stderr });
  py.setStdin({ stdin: () => null }); // input() -> EOFError; there is no keyboard to read from

  if (HARDEN) harden();
  port.postMessage({ t: "ready", initMs: performance.now() - t0, mode });
}

// Defence in depth, NOT the boundary (the CSP is): remove network/storage/messaging globals before
// student code runs so `import js` has nothing to reach for. Shadowing (rather than `delete`) also
// covers accessors that live on WorkerGlobalScope.prototype.
function harden() {
  const globals = [
    "fetch", "XMLHttpRequest", "WebSocket", "WebTransport", "EventSource",
    "RTCPeerConnection", "webkitRTCPeerConnection", "BroadcastChannel", "SharedWorker", "Worker",
    "importScripts", "indexedDB", "caches", "MessageChannel",
  ];
  for (const name of globals) {
    try { Object.defineProperty(self, name, { value: undefined, writable: false, configurable: false }); } catch { /* best effort */ }
  }
  for (const name of ["sendBeacon", "serviceWorker", "storage", "locks", "mediaDevices", "bluetooth", "usb", "serial", "hid"]) {
    try { Object.defineProperty(self.navigator, name, { value: undefined, writable: false, configurable: false }); } catch { /* best effort */ }
  }
}

function onPortMessage(event) {
  const request = parseRunRequest(event.data, LIMITS.maxCodeChars);
  if (!request || !py || !sink) return;
  const t0 = performance.now();
  let result;
  try {
    result = JSON.parse(String(py.globals.get("_run")(request.code)));
  } catch (err) {
    // The only way here is the output cap tripping inside the harness itself, or an interpreter fault.
    result = { status: "exception", exception: "InternalError", traceback: describe(err) };
  }
  sink.flushAll();
  const done = {
    t: "done",
    status: result.status,
    durationMs: performance.now() - t0,
    outputLimit: sink.limitHit,
  };
  if (typeof result.traceback === "string") done.traceback = result.traceback.slice(0, 16384);
  if (typeof result.exception === "string") done.exception = result.exception.slice(0, 100);
  port.postMessage(done);
}
