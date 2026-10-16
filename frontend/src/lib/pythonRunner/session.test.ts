import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PythonRunnerSession, RunnerError, type PortLike } from "./session";

const NONCE = "0123456789abcdef0123456789abcdef";
const LIMITS = { runTimeoutMs: 5000, initTimeoutMs: 30000, outputLimitBytes: 100, maxCodeChars: 50 };
const hello = (nonce = NONCE) => ({ t: "hello", protocol: 1, nonce, limits: LIMITS, build: { pyodideVersion: "314.0.7" } });
const result = (id: number, extra: Record<string, unknown> = {}) => ({
  t: "result", id, status: "ok", durationMs: 2, startupMs: 900, mode: "restore", snapshot: "ready", truncated: false, ...extra,
});

/** A scripted fake bridge on the other end of a fake port. */
class FakePort implements PortLike {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  sent: unknown[] = [];
  closed = false;
  postMessage(data: unknown) { this.sent.push(data); }
  close() { this.closed = true; this.onmessage = null; }
  /** bridge -> parent */
  deliver(data: unknown) { this.onmessage?.({ data }); }
}

function setup(options: Partial<ConstructorParameters<typeof PythonRunnerSession>[1]> = {}) {
  const port = new FakePort();
  const onClosed = vi.fn();
  const session = new PythonRunnerSession(port, { nonce: NONCE, onClosed, ...options });
  return { port, session, onClosed };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("handshake", () => {
  it("becomes ready only on a valid hello carrying our nonce", async () => {
    const { port, session } = setup();
    expect(session.state).toBe("connecting");
    port.deliver(hello());
    await expect(session.ready).resolves.toMatchObject({ pyodideVersion: "314.0.7", limits: LIMITS });
    expect(session.state).toBe("ready");
  });

  it("fails closed on a wrong nonce", async () => {
    const { port, session } = setup();
    port.deliver(hello("ffffffffffffffffffffffffffffffff"));
    await expect(session.ready).rejects.toMatchObject({ kind: "unavailable" });
    expect(session.state).toBe("failed");
    expect(port.closed).toBe(true);
  });

  it("fails with 'unavailable' when no hello arrives (blocked frame / unapproved origin)", async () => {
    const { session } = setup({ handshakeTimeoutMs: 1000 });
    const rejected = expect(session.ready).rejects.toMatchObject({ kind: "unavailable", retryable: true });
    await vi.advanceTimersByTimeAsync(1001);
    await rejected;
  });

  it("trusts nothing before hello: output/result messages are ignored", async () => {
    const { port, session } = setup();
    port.deliver(result(1));
    port.deliver({ t: "out", id: 1, stream: "stdout", text: "x" });
    expect(session.state).toBe("connecting");
    port.deliver(hello());
    await session.ready;
    expect(session.state).toBe("ready");
  });

  it("accepts hello exactly once", async () => {
    const { port, session } = setup();
    port.deliver(hello());
    await session.ready;
    port.deliver({ ...hello(), limits: { ...LIMITS, runTimeoutMs: 999999 } });
    const run = session.run("print(1)");
    expect(port.sent.at(-1)).toMatchObject({ t: "run", id: 1 });
    port.deliver(result(1));
    await run;
  });

  it("ignores malformed junk without failing", async () => {
    const { port, session } = setup();
    for (const junk of [null, 5, "hello", [], {}, { t: "hello" }, { t: "result" }]) port.deliver(junk);
    expect(session.state).toBe("connecting");
    port.deliver(hello());
    await session.ready;
  });
});

describe("runs", () => {
  async function ready() {
    const ctx = setup();
    ctx.port.deliver(hello());
    await ctx.session.ready;
    return ctx;
  }

  it("collects output in order and resolves with the real status — never a correctness claim", async () => {
    const { port, session } = await ready();
    const seen: string[] = [];
    const statuses: string[] = [];
    const run = session.run("print(1)", { onOutput: (s, t) => seen.push(`${s}:${t}`), onStatus: (p, m) => statuses.push(`${p}/${m}`) });
    const sent = port.sent.at(-1) as { id: number };
    port.deliver({ t: "status", id: sent.id, phase: "starting", mode: "restore" });
    port.deliver({ t: "status", id: sent.id, phase: "running", mode: "restore" });
    port.deliver({ t: "out", id: sent.id, stream: "stdout", text: "20.0\n" });
    port.deliver({ t: "out", id: sent.id, stream: "stderr", text: "warn\n" });
    port.deliver(result(sent.id, { status: "exception", exception: "ZeroDivisionError", traceback: "Traceback…" }));
    await expect(run).resolves.toMatchObject({ status: "exception", exception: "ZeroDivisionError", stdout: "20.0\n", stderr: "warn\n", startupMs: 900 });
    expect(seen).toEqual(["stdout:20.0\n", "stderr:warn\n"]);
    expect(statuses).toEqual(["starting/restore", "running/restore"]);
    expect(session.state).toBe("ready");
  });

  it("allows only one run at a time (single flight) and sends nothing for the rejected one", async () => {
    const { port, session } = await ready();
    const first = session.run("a = 1");
    await expect(session.run("b = 2")).rejects.toMatchObject({ kind: "busy" });
    expect(port.sent.filter((m) => (m as { t: string }).t === "run")).toHaveLength(1);
    port.deliver(result(1));
    await first;
    const second = session.run("c = 3");
    expect(port.sent.at(-1)).toMatchObject({ t: "run", id: 2 });
    port.deliver(result(2));
    await second;
  });

  it("rejects oversized code locally without contacting the runner", async () => {
    const { port, session } = await ready();
    await expect(session.run("x".repeat(51))).rejects.toMatchObject({ kind: "rejected" });
    expect(port.sent).toHaveLength(0);
  });

  it("ignores results and output for other (stale) run ids", async () => {
    const { port, session } = await ready();
    const run = session.run("print(1)");
    port.deliver(result(99, { status: "timeout" }));
    port.deliver({ t: "out", id: 99, stream: "stdout", text: "stale" });
    port.deliver(result(1));
    await expect(run).resolves.toMatchObject({ status: "ok", stdout: "" });
  });

  it("bounds the output it keeps in memory even if the runner misbehaves", async () => {
    const { port, session } = await ready();
    const run = session.run("print(1)");
    for (let i = 0; i < 200; i++) port.deliver({ t: "out", id: 1, stream: "stdout", text: "x".repeat(1000) });
    port.deliver(result(1));
    const r = await run;
    expect(r.stdout.length).toBeLessThanOrEqual(LIMITS.outputLimitBytes + 4096);
  });

  it("stop() sends a stop for the active run only", async () => {
    const { port, session } = await ready();
    session.stop();
    expect(port.sent).toHaveLength(0);
    const run = session.run("while True: pass");
    session.stop();
    expect(port.sent.at(-1)).toEqual({ t: "stop", id: 1 });
    port.deliver(result(1, { status: "stopped" }));
    await expect(run).resolves.toMatchObject({ status: "stopped" });
  });

  it("surfaces a per-run fatal (init failure) but stays usable for a retry", async () => {
    const { port, session } = await ready();
    const run = session.run("print(1)");
    port.deliver({ t: "fatal", id: 1, reason: "init-failed", message: "runtime request failed (404)" });
    await expect(run).rejects.toMatchObject({ kind: "fatal", reason: "init-failed", retryable: true });
    expect(session.state).toBe("ready");
    const again = session.run("print(2)");
    port.deliver(result(2));
    await again;
  });

  it("FAILS CLOSED permanently on csp-not-enforced: this and every later run reject, not retryable", async () => {
    const { port, session } = await ready();
    const run = session.run("print(1)");
    port.deliver({ t: "fatal", id: 1, reason: "csp-not-enforced", message: "no csp" });
    await expect(run).rejects.toMatchObject({ kind: "fatal", reason: "csp-not-enforced", retryable: false });
    expect(session.state).toBe("failed");
    await expect(session.run("print(2)")).rejects.toMatchObject({ reason: "csp-not-enforced" });
    expect(port.sent.filter((m) => (m as { t: string }).t === "run")).toHaveLength(1);
  });

  it.each(["unsupported", "protocol-error", "disabled"] as const)("treats a %s fatal as session-wide", async (reason) => {
    const { port, session } = await ready();
    const run = session.run("print(1)");
    port.deliver({ t: "fatal", id: 1, reason, message: "x" });
    await expect(run).rejects.toMatchObject({ kind: "fatal", reason });
    expect(session.state).toBe("failed");
  });
});

describe("liveness and cleanup", () => {
  async function ready(options = {}) {
    const ctx = setup(options);
    ctx.port.deliver(hello());
    await ctx.session.ready;
    return ctx;
  }

  it("declares the runner crashed when heartbeats stop during a run", async () => {
    const { port, session, onClosed } = await ready({ heartbeatTimeoutMs: 3000 });
    const run = session.run("big = bytearray(10**9)");
    const rejected = expect(run).rejects.toMatchObject({ kind: "crashed", retryable: true });
    await vi.advanceTimersByTimeAsync(5000);
    await rejected;
    expect(session.state).toBe("failed");
    expect(onClosed).toHaveBeenCalled();
    expect(port.closed).toBe(true);
  });

  it("heartbeats keep a slow-but-alive run from being declared dead", async () => {
    const { port, session } = await ready({ heartbeatTimeoutMs: 3000 });
    const run = session.run("print(1)");
    for (let i = 0; i < 6; i++) {
      await vi.advanceTimersByTimeAsync(1000);
      port.deliver({ t: "hb" });
    }
    expect(session.state).toBe("running");
    port.deliver(result(1));
    await run;
  });

  it("the watchdog fires if the bridge never answers a run (init + run timeouts + grace)", async () => {
    const { port, session } = await ready({ heartbeatTimeoutMs: 10_000_000, watchdogGraceMs: 1000 });
    const run = session.run("print(1)");
    const rejected = expect(run).rejects.toMatchObject({ kind: "crashed" });
    for (let i = 0; i < 40; i++) {
      await vi.advanceTimersByTimeAsync(1000);
      port.deliver({ t: "hb" });
    }
    await rejected;
  });

  it("dispose() tells the bridge, rejects a pending run, closes the port, and is idempotent", async () => {
    const { port, session, onClosed } = await ready();
    const run = session.run("print(1)");
    const rejected = expect(run).rejects.toMatchObject({ kind: "disposed" });
    session.dispose();
    await rejected;
    expect(port.sent.at(-1)).toEqual({ t: "dispose" });
    expect(port.closed).toBe(true);
    expect(session.state).toBe("disposed");
    expect(onClosed).toHaveBeenCalledTimes(1);
    session.dispose();
    expect(onClosed).toHaveBeenCalledTimes(1);
    await expect(session.run("x")).rejects.toMatchObject({ kind: "disposed" });
  });

  it("rejects a malformed nonce at construction", () => {
    expect(() => new PythonRunnerSession(new FakePort(), { nonce: "nope" })).toThrow(TypeError);
  });

  it("RunnerError.retryable is false for fail-closed conditions", () => {
    expect(new RunnerError("fatal", "x", "csp-not-enforced").retryable).toBe(false);
    expect(new RunnerError("fatal", "x", "unsupported").retryable).toBe(false);
    expect(new RunnerError("fatal", "x", "init-timeout").retryable).toBe(true);
    expect(new RunnerError("busy", "x").retryable).toBe(false);
  });
});
