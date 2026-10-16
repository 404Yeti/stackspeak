// Parent-side twin of runner/src/protocol.mjs. Both are checked against the SAME fixtures
// (runner/test/fixtures/protocol-messages.json), so they cannot drift apart silently.
// Every message from the runner is untrusted input: parse it, or drop it.

export const PROTOCOL_VERSION = 1 as const;
export const INIT_TYPE = "stackspeak-runner/init" as const;

export const RUN_STATUSES = [
  "ok", // the program finished — this says NOTHING about whether the code is correct
  "exception",
  "syntax-error",
  "timeout",
  "stopped",
  "output-limit",
  "crashed",
  "busy",
  "rejected",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const FATAL_REASONS = [
  "csp-not-enforced",
  "unsupported",
  "init-failed",
  "init-timeout",
  "restore-failed",
  "protocol-error",
  "disabled",
] as const;
export type FatalReason = (typeof FATAL_REASONS)[number];

export type RunMode = "build" | "restore" | "cold";
export type SnapshotState = "none" | "ready" | "unavailable" | "bad";

export type RunnerLimits = {
  runTimeoutMs: number;
  initTimeoutMs: number;
  outputLimitBytes: number;
  maxCodeChars: number;
};

export type BridgeMessage =
  | { t: "hello"; protocol: 1; nonce: string; limits: RunnerLimits; build: { pyodideVersion: string } }
  | { t: "hb" }
  | { t: "status"; id: number; phase: "starting" | "running"; mode: RunMode }
  | { t: "out"; id: number; stream: "stdout" | "stderr"; text: string }
  | {
      t: "result";
      id: number;
      status: RunStatus;
      durationMs: number;
      startupMs: number;
      mode: RunMode | "none";
      snapshot: SnapshotState;
      truncated: boolean;
      traceback?: string;
      exception?: string;
    }
  | { t: "fatal"; id?: number; reason: FatalReason; message: string };

export type ParentMessage =
  | { t: "run"; id: number; code: string }
  | { t: "stop"; id: number }
  | { t: "dispose" };

const MAX_ID = 2147483647;
const MAX_TEXT = 70000;
const MAX_TRACEBACK = 16384;
const MAX_MESSAGE = 500;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 1 && (v as number) <= MAX_ID;
const isStr = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const isNum = (v: unknown, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === "string" && (list as readonly string[]).includes(v);
const hasOnly = (obj: Obj, keys: string[]) => Object.keys(obj).every((k) => keys.includes(k));

const MODES = ["build", "restore", "cold"] as const;
const RESULT_MODES = ["build", "restore", "cold", "none"] as const;
const SNAPSHOT_STATES = ["none", "ready", "unavailable", "bad"] as const;

export function parseBridgeMessage(data: unknown): BridgeMessage | null {
  if (!isObj(data) || typeof data.t !== "string") return null;
  switch (data.t) {
    case "hello": {
      const l = data.limits;
      if (data.protocol !== PROTOCOL_VERSION || typeof data.nonce !== "string" || !isObj(l)) return null;
      if (!isNum(l.runTimeoutMs, 600000) || !isNum(l.initTimeoutMs, 600000)) return null;
      if (!isNum(l.outputLimitBytes, 1e7) || !isNum(l.maxCodeChars, 1e6)) return null;
      if (!isObj(data.build) || !isStr(data.build.pyodideVersion, 32)) return null;
      return {
        t: "hello",
        protocol: PROTOCOL_VERSION,
        nonce: data.nonce,
        limits: {
          runTimeoutMs: l.runTimeoutMs,
          initTimeoutMs: l.initTimeoutMs,
          outputLimitBytes: l.outputLimitBytes,
          maxCodeChars: l.maxCodeChars,
        },
        build: { pyodideVersion: data.build.pyodideVersion },
      };
    }
    case "hb":
      return hasOnly(data, ["t"]) ? { t: "hb" } : null;
    case "status":
      if (!isId(data.id) || !oneOf(["starting", "running"] as const, data.phase) || !oneOf(MODES, data.mode)) return null;
      return { t: "status", id: data.id, phase: data.phase, mode: data.mode };
    case "out":
      if (!isId(data.id) || !oneOf(["stdout", "stderr"] as const, data.stream) || !isStr(data.text, MAX_TEXT)) return null;
      return { t: "out", id: data.id, stream: data.stream, text: data.text };
    case "result": {
      if (!isId(data.id) || !oneOf(RUN_STATUSES, data.status)) return null;
      if (!isNum(data.durationMs, 3600000) || !isNum(data.startupMs, 3600000)) return null;
      if (!oneOf(RESULT_MODES, data.mode) || !oneOf(SNAPSHOT_STATES, data.snapshot)) return null;
      if (data.traceback !== undefined && !isStr(data.traceback, MAX_TRACEBACK)) return null;
      if (data.exception !== undefined && !isStr(data.exception, 100)) return null;
      if (typeof data.truncated !== "boolean") return null;
      return {
        t: "result",
        id: data.id,
        status: data.status,
        durationMs: data.durationMs,
        startupMs: data.startupMs,
        mode: data.mode,
        snapshot: data.snapshot,
        truncated: data.truncated,
        traceback: data.traceback,
        exception: data.exception,
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

/** Mirror of the bridge's parser for parent messages — used by tests to prove we only ever send valid ones. */
export function parseParentMessage(data: unknown, maxCodeChars: number): ParentMessage | null {
  if (!isObj(data) || typeof data.t !== "string") return null;
  if (data.t === "run") {
    if (!hasOnly(data, ["t", "id", "code"]) || !isId(data.id) || typeof data.code !== "string") return null;
    return data.code.length > maxCodeChars ? null : { t: "run", id: data.id, code: data.code };
  }
  if (data.t === "stop") return hasOnly(data, ["t", "id"]) && isId(data.id) ? { t: "stop", id: data.id } : null;
  if (data.t === "dispose") return hasOnly(data, ["t"]) ? { t: "dispose" } : null;
  return null;
}

export function isNonce(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{32}$/.test(value);
}
