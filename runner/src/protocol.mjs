// Message protocol shared by the bridge, the worker, and the tests. Every message crossing a trust
// boundary is validated here; anything that does not match exactly is dropped. This file is
// textually inlined into bridge.mjs and worker.mjs by scripts/build.mjs (the `export` keywords are
// stripped), so it must stay dependency-free and use only declarations.

export const PROTOCOL_VERSION = 1;
export const INIT_TYPE = "stackspeak-runner/init";

export const RUN_STATUSES = [
  "ok", // program finished (says NOTHING about correctness)
  "exception",
  "syntax-error",
  "timeout",
  "stopped",
  "output-limit",
  "crashed",
  "busy", // a run was already in progress; nothing was executed
  "rejected", // input refused (e.g. too large); nothing was executed
];

export const FATAL_REASONS = [
  "csp-not-enforced",
  "unsupported",
  "init-failed",
  "init-timeout",
  "restore-failed",
  "protocol-error",
  "disabled",
];

const MAX_ID = 2147483647;
const MAX_TEXT = 70000;
const MAX_TRACEBACK = 16384;
const MAX_MESSAGE = 500;
const MAX_SNAPSHOT_BYTES = 256 * 1024 * 1024;

function isObj(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isId(v) {
  return Number.isSafeInteger(v) && v >= 1 && v <= MAX_ID;
}
function isStr(v, max) {
  return typeof v === "string" && v.length <= max;
}
function isNum(v, max) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
}
function oneOf(list, v) {
  return typeof v === "string" && list.indexOf(v) !== -1;
}
function hasOnly(obj, keys) {
  for (const k of Object.keys(obj)) if (keys.indexOf(k) === -1) return false;
  return true;
}

/** parent window -> bridge window, delivered with a transferred MessagePort. */
export function parseInit(data) {
  if (!isObj(data) || data.type !== INIT_TYPE || data.protocol !== PROTOCOL_VERSION) return null;
  if (typeof data.nonce !== "string" || !/^[a-f0-9]{32}$/.test(data.nonce)) return null;
  const hooks = {};
  if (isObj(data.hooks)) {
    hooks.forceCold = data.hooks.forceCold === true;
    hooks.failRestore = data.hooks.failRestore === true;
    hooks.skipCanary = data.hooks.skipCanary === true;
  }
  return { nonce: data.nonce, hooks };
}

/** parent -> bridge, over the private port. */
export function parseParentMessage(data, maxCodeChars) {
  if (!isObj(data) || typeof data.t !== "string") return null;
  if (data.t === "run") {
    if (!hasOnly(data, ["t", "id", "code"]) || !isId(data.id) || typeof data.code !== "string") return null;
    return { t: "run", id: data.id, code: data.code, tooLarge: data.code.length > maxCodeChars };
  }
  if (data.t === "stop") {
    return hasOnly(data, ["t", "id"]) && isId(data.id) ? { t: "stop", id: data.id } : null;
  }
  if (data.t === "dispose") return hasOnly(data, ["t"]) ? { t: "dispose" } : null;
  return null;
}

/** bridge -> parent. Used by the parent-side client (and its TypeScript twin) and by tests. */
export function parseBridgeMessage(data) {
  if (!isObj(data) || typeof data.t !== "string") return null;
  switch (data.t) {
    case "hello": {
      const l = data.limits;
      if (data.protocol !== PROTOCOL_VERSION || typeof data.nonce !== "string" || !isObj(l)) return null;
      if (!isNum(l.runTimeoutMs, 600000) || !isNum(l.initTimeoutMs, 600000) || !isNum(l.outputLimitBytes, 1e7) || !isNum(l.maxCodeChars, 1e6)) return null;
      if (!isObj(data.build) || !isStr(data.build.pyodideVersion, 32)) return null;
      return {
        t: "hello",
        protocol: data.protocol,
        nonce: data.nonce,
        limits: { runTimeoutMs: l.runTimeoutMs, initTimeoutMs: l.initTimeoutMs, outputLimitBytes: l.outputLimitBytes, maxCodeChars: l.maxCodeChars },
        build: { pyodideVersion: data.build.pyodideVersion },
      };
    }
    case "hb":
      return hasOnly(data, ["t"]) ? { t: "hb" } : null;
    case "status":
      if (!isId(data.id) || !oneOf(["starting", "running"], data.phase) || !oneOf(["build", "restore", "cold"], data.mode)) return null;
      return { t: "status", id: data.id, phase: data.phase, mode: data.mode };
    case "out":
      if (!isId(data.id) || !oneOf(["stdout", "stderr"], data.stream) || !isStr(data.text, MAX_TEXT)) return null;
      return { t: "out", id: data.id, stream: data.stream, text: data.text };
    case "result": {
      if (!isId(data.id) || !oneOf(RUN_STATUSES, data.status)) return null;
      if (!isNum(data.durationMs, 3600000) || !isNum(data.startupMs, 3600000)) return null;
      if (!oneOf(["build", "restore", "cold", "none"], data.mode)) return null;
      if (!oneOf(["none", "ready", "unavailable", "bad"], data.snapshot)) return null;
      if (data.traceback !== undefined && !isStr(data.traceback, MAX_TRACEBACK)) return null;
      if (data.exception !== undefined && !isStr(data.exception, 100)) return null;
      if (typeof data.truncated !== "boolean") return null;
      return {
        t: "result", id: data.id, status: data.status, durationMs: data.durationMs, startupMs: data.startupMs,
        mode: data.mode, snapshot: data.snapshot, truncated: data.truncated,
        traceback: data.traceback, exception: data.exception,
      };
    }
    case "fatal":
      if (!oneOf(FATAL_REASONS, data.reason) || !isStr(data.message, MAX_MESSAGE)) return null;
      if (data.id !== undefined && !isId(data.id)) return null;
      return { t: "fatal", id: data.id, reason: data.reason, message: data.message };
    default:
      return null;
  }
}

/** worker -> bridge, over the per-run private port. */
export function parseWorkerMessage(data) {
  if (!isObj(data) || typeof data.t !== "string") return null;
  switch (data.t) {
    case "ready":
      if (!isNum(data.initMs, 3600000) || !oneOf(["build", "restore", "cold"], data.mode)) return null;
      return { t: "ready", initMs: data.initMs, mode: data.mode };
    case "snapshot":
      if (!(data.buffer instanceof ArrayBuffer) || data.buffer.byteLength === 0 || data.buffer.byteLength > MAX_SNAPSHOT_BYTES) return null;
      return { t: "snapshot", buffer: data.buffer };
    case "snapshot-unavailable":
      return { t: "snapshot-unavailable", message: isStr(data.message, MAX_MESSAGE) ? data.message : "" };
    case "out":
      if (!oneOf(["stdout", "stderr"], data.stream) || !isStr(data.text, MAX_TEXT)) return null;
      return { t: "out", stream: data.stream, text: data.text };
    case "done":
      if (!oneOf(["ok", "exception", "syntax-error"], data.status) || !isNum(data.durationMs, 3600000)) return null;
      if (data.traceback !== undefined && !isStr(data.traceback, MAX_TRACEBACK)) return null;
      if (data.exception !== undefined && !isStr(data.exception, 100)) return null;
      return { t: "done", status: data.status, durationMs: data.durationMs, traceback: data.traceback, exception: data.exception, outputLimit: data.outputLimit === true };
    case "fatal":
      if (!oneOf(FATAL_REASONS, data.reason)) return null;
      return { t: "fatal", reason: data.reason, message: isStr(data.message, MAX_MESSAGE) ? data.message : "" };
    default:
      return null;
  }
}

/** bridge -> worker: the first message, carrying the private port. */
export function parseStart(data) {
  if (!isObj(data) || data.t !== "start" || !oneOf(["build", "restore", "cold"], data.mode)) return null;
  if (typeof MessagePort === "undefined" || !(data.port instanceof MessagePort)) return null;
  if (data.mode === "restore" && !(data.snapshot instanceof ArrayBuffer)) return null;
  return { mode: data.mode, port: data.port, snapshot: data.snapshot, failRestore: data.failRestore === true, skipCanary: data.skipCanary === true };
}

/** bridge -> worker, over the private port. */
export function parseRunRequest(data, maxCodeChars) {
  if (!isObj(data) || data.t !== "run" || typeof data.code !== "string" || data.code.length > maxCodeChars) return null;
  return { t: "run", code: data.code };
}
