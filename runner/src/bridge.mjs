// StackSpeak Python runner — bridge. Runs in the runner origin's top document (the iframe embedded
// by the app). It is the only code that talks to the parent, and the only owner of workers.
//
// Trust rules enforced here:
//  * the parent is trusted only if event.origin is in the build-time approved list AND event.source
//    is window.parent AND a MessagePort is transferred with a schema-valid init message (once);
//  * after that, everything flows over that private port (no origin on port messages, none needed);
//  * worker -> parent traffic is rebuilt field by field from validated worker messages — a worker's
//    own self.postMessage is ignored, so student code cannot spoof ready/result/fatal;
//  * the bridge enforces timeouts and output limits itself and terminates the worker after EVERY run.

/*__INCLUDE:protocol.mjs__*/

const CFG = __BRIDGE_CONFIG_JSON__;
const TEST = CFG.test === true; // test hooks exist only in test builds; production builds ignore them

let port = null;
let initDone = false;
let heartbeat = null;
let hooks = {};
let snapshot = null; // ArrayBuffer once a build-mode worker produced one
let snapshotState = "none"; // none | ready | unavailable | bad
let disabled = null; // { reason, message } — permanent for this page load (fail closed)
let current = null;

addEventListener("message", onWindowMessage);

function send(message) {
  if (port) port.postMessage(message);
}

function onWindowMessage(event) {
  if (initDone) return;
  if (event.source !== window.parent) return;
  if (CFG.approvedParentOrigins.indexOf(event.origin) === -1) return; // silently: reveal nothing
  const init = parseInit(event.data);
  if (!init || event.ports.length !== 1) return;
  initDone = true;
  removeEventListener("message", onWindowMessage);
  if (TEST) {
    hooks = init.hooks;
    if (hooks.forceCold) snapshotState = "unavailable";
  }
  port = event.ports[0];
  port.onmessage = onParentMessage;
  send({
    t: "hello",
    protocol: PROTOCOL_VERSION,
    nonce: init.nonce,
    limits: CFG.limits,
    build: { pyodideVersion: CFG.pyodideVersion },
  });
  heartbeat = setInterval(() => send({ t: "hb" }), 2000);
}

function onParentMessage(event) {
  const message = parseParentMessage(event.data, CFG.limits.maxCodeChars);
  if (!message) return send({ t: "fatal", reason: "protocol-error", message: "unrecognised message" });
  if (message.t === "run") return startRun(message);
  if (message.t === "stop") return current && current.id === message.id ? finish(current, "stopped") : undefined;
  if (message.t === "dispose") return dispose();
}

function startRun({ id, code, tooLarge }) {
  if (disabled) return send({ t: "fatal", id, reason: disabled.reason, message: disabled.message });
  if (tooLarge) return send(resultMessage(id, "rejected", { startupMs: 0, mode: "none", durationMs: 0 }));
  if (current) return send(resultMessage(id, "busy", { startupMs: 0, mode: "none", durationMs: 0 }));

  const mode = snapshotState === "ready" ? "restore" : snapshotState === "none" ? "build" : "cold";
  current = { id, code, mode, startedAt: performance.now(), readyAt: null, outBytes: 0, truncated: false, retried: false, worker: null, port: null, timers: {} };
  send({ t: "status", id, phase: "starting", mode });
  spawn(current);
}

function spawn(run) {
  let worker;
  try {
    worker = new Worker("/" + CFG.workerFile, { type: "module", name: "stackspeak-python" });
  } catch (err) {
    return failRun(run, "unsupported", "This browser cannot start module workers");
  }
  run.worker = worker;
  // The worker's own postMessage channel is deliberately unused (student code could write to it).
  worker.onmessage = null;
  worker.onerror = () => workerError(run);
  worker.onmessageerror = () => workerError(run);

  const channel = new MessageChannel();
  run.port = channel.port1;
  channel.port1.onmessage = (event) => onWorkerMessage(run, event);

  const start = { t: "start", mode: run.mode, port: channel.port2, failRestore: TEST && hooks.failRestore === true, skipCanary: TEST && hooks.skipCanary === true };
  const transfer = [channel.port2];
  if (run.mode === "restore") {
    start.snapshot = snapshot.slice(0); // fresh copy per worker; the original stays here
    transfer.push(start.snapshot);
  }
  worker.postMessage(start, transfer);
  // One init budget for the whole start-up, even when a build worker precedes the run's own worker.
  const remaining = CFG.limits.initTimeoutMs - (performance.now() - run.startedAt);
  run.timers.init = setTimeout(() => initTimeout(run), Math.max(500, remaining));
}

function workerError(run) {
  if (run !== current) return;
  if (run.readyAt === null) return failRun(run, "init-failed", "The Python worker failed to start");
  finish(run, "crashed");
}

function onWorkerMessage(run, event) {
  if (run !== current) return; // stale
  const m = parseWorkerMessage(event.data);
  if (!m) return failRun(run, "protocol-error", "The worker sent an invalid message");

  switch (m.t) {
    case "snapshot":
      if (run.mode === "build") {
        snapshot = m.buffer;
        snapshotState = "ready";
      }
      return;
    case "snapshot-unavailable":
      snapshotState = "unavailable"; // supported fallback: cold start per run
      return;
    case "ready":
      clearTimeout(run.timers.init);
      if (run.mode === "build") return finishBuild(run);
      run.readyAt = performance.now();
      run.timers.run = setTimeout(() => finish(run, "timeout"), CFG.limits.runTimeoutMs);
      send({ t: "status", id: run.id, phase: "running", mode: run.mode });
      run.port.postMessage({ t: "run", code: run.code });
      return;
    case "out": {
      if (run.readyAt === null) return;
      const room = CFG.limits.outputLimitBytes - run.outBytes;
      if (room <= 0) return finish(run, "output-limit"); // belt and braces: the worker caps first
      const text = m.text.length > room ? m.text.slice(0, room) : m.text;
      run.outBytes += text.length;
      if (text.length < m.text.length) run.truncated = true;
      return send({ t: "out", id: run.id, stream: m.stream, text });
    }
    case "done":
      return finish(run, m.outputLimit ? "output-limit" : m.status, { traceback: m.traceback, exception: m.exception, durationMs: m.durationMs });
    case "fatal":
      return onWorkerFatal(run, m);
  }
}

// The build worker only produced the snapshot. Student code NEVER runs on it (its interpreter's JS
// interop is unreliable after makeMemorySnapshot()), so start a fresh worker for this same run:
// restored from the new snapshot, or cold if no snapshot could be made.
function finishBuild(run) {
  teardown(run);
  run.mode = snapshotState === "ready" ? "restore" : "cold";
  send({ t: "status", id: run.id, phase: "starting", mode: run.mode });
  spawn(run);
}

function onWorkerFatal(run, m) {
  if (m.reason === "restore-failed" && !run.retried) {
    // The snapshot did not restore: mark it bad and transparently retry this run as a cold start.
    snapshotState = "bad";
    run.retried = true;
    run.mode = "cold";
    teardown(run);
    send({ t: "status", id: run.id, phase: "starting", mode: "cold" });
    return spawn(run);
  }
  if (m.reason === "csp-not-enforced" || m.reason === "unsupported") {
    disabled = { reason: m.reason, message: m.message || "Running code is turned off in this browser for safety." };
  }
  failRun(run, m.reason, m.message);
}

function initTimeout(run) {
  if (run === current && run.readyAt === null) failRun(run, "init-timeout", "Python did not start in time");
}

function teardown(run) {
  clearTimeout(run.timers.init);
  clearTimeout(run.timers.run);
  run.timers = {};
  if (run.worker) { run.worker.terminate(); run.worker = null; }
  if (run.port) { run.port.onmessage = null; run.port.close(); run.port = null; }
}

function failRun(run, reason, message) {
  if (run !== current) return;
  teardown(run);
  current = null;
  send({ t: "fatal", id: run.id, reason, message: String(message || reason).slice(0, 400) });
}

function resultMessage(id, status, extra) {
  return {
    t: "result", id, status,
    durationMs: extra.durationMs || 0,
    startupMs: extra.startupMs || 0,
    mode: extra.mode,
    snapshot: snapshotState,
    truncated: extra.truncated === true,
    traceback: extra.traceback,
    exception: extra.exception,
  };
}

function finish(run, status, extra = {}) {
  if (run !== current) return;
  const startupMs = run.readyAt === null ? performance.now() - run.startedAt : run.readyAt - run.startedAt;
  teardown(run);
  current = null;
  send(resultMessage(run.id, status, {
    durationMs: extra.durationMs !== undefined ? extra.durationMs : run.readyAt === null ? 0 : performance.now() - run.readyAt,
    startupMs, mode: run.mode, truncated: run.truncated, traceback: extra.traceback, exception: extra.exception,
  }));
}

function dispose() {
  if (current) { teardown(current); current = null; }
  snapshot = null;
  clearInterval(heartbeat);
  if (port) { port.onmessage = null; port.close(); port = null; }
}
