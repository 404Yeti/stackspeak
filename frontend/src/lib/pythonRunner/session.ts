import {
  isNonce,
  parseBridgeMessage,
  type FatalReason,
  type ParentMessage,
  type RunMode,
  type RunStatus,
  type RunnerLimits,
  type SnapshotState,
} from "./protocol";

/** The slice of MessagePort the session needs — lets tests drive it with a scripted fake bridge. */
export interface PortLike {
  postMessage(data: unknown): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  close(): void;
}

export type RunnerErrorKind =
  | "unavailable" // never got a valid hello (blocked, wrong origin, not approved, too slow)
  | "fatal" // the runner reported a fatal condition (see `reason`)
  | "crashed" // the runner went silent mid-run (heartbeat lost / watchdog)
  | "busy" // one run at a time
  | "rejected" // refused locally, e.g. code too large
  | "disposed";

export class RunnerError extends Error {
  readonly kind: RunnerErrorKind;
  readonly reason?: FatalReason;
  constructor(kind: RunnerErrorKind, message: string, reason?: FatalReason) {
    super(message);
    this.name = "RunnerError";
    this.kind = kind;
    this.reason = reason;
  }
  /** True when retrying makes sense; false for conditions that keep Run off (fail closed). */
  get retryable(): boolean {
    if (this.kind === "fatal") return this.reason === "init-failed" || this.reason === "init-timeout" || this.reason === "restore-failed";
    return this.kind === "unavailable" || this.kind === "crashed";
  }
}

export type RunResult = {
  /** "ok" means the program ran to the end. It is NOT a correctness verdict. */
  status: RunStatus;
  stdout: string;
  stderr: string;
  traceback?: string;
  exception?: string;
  durationMs: number;
  startupMs: number;
  mode: RunMode | "none";
  snapshot: SnapshotState;
  truncated: boolean;
};

export type RunHandlers = {
  onOutput?: (stream: "stdout" | "stderr", text: string) => void;
  onStatus?: (phase: "starting" | "running", mode: RunMode) => void;
};

export type SessionState = "connecting" | "ready" | "running" | "failed" | "disposed";

export type SessionOptions = {
  nonce: string;
  /** How long to wait for a valid hello before giving up (iframe blocked / origin not approved). */
  handshakeTimeoutMs?: number;
  /** Declare the runner dead if nothing (incl. heartbeats) arrives for this long. */
  heartbeatTimeoutMs?: number;
  /** Extra time beyond the runner's own timeouts before the parent stops waiting. */
  watchdogGraceMs?: number;
  onClosed?: () => void;
};

type Pending = {
  id: number;
  stdout: string;
  stderr: string;
  retained: number;
  handlers: RunHandlers;
  resolve: (result: RunResult) => void;
  reject: (error: RunnerError) => void;
  watchdog: ReturnType<typeof setTimeout>;
};

/** Protocol session over one private MessagePort: validation, single-flight, watchdogs, fail-closed. */
export class PythonRunnerSession {
  readonly ready: Promise<{ limits: RunnerLimits; pyodideVersion: string }>;
  private port: PortLike;
  private opts: Required<Omit<SessionOptions, "onClosed" | "nonce">> & Pick<SessionOptions, "onClosed" | "nonce">;
  private _state: SessionState = "connecting";
  private limits: RunnerLimits | null = null;
  private nextId = 1;
  private pending: Pending | null = null;
  private lastSeen = 0;
  private handshakeTimer: ReturnType<typeof setTimeout> | undefined;
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private failure: RunnerError | null = null;
  private resolveReady!: (v: { limits: RunnerLimits; pyodideVersion: string }) => void;
  private rejectReady!: (e: RunnerError) => void;

  constructor(port: PortLike, options: SessionOptions) {
    if (!isNonce(options.nonce)) throw new TypeError("nonce must be 32 lowercase hex characters");
    this.port = port;
    this.opts = {
      nonce: options.nonce,
      handshakeTimeoutMs: options.handshakeTimeoutMs ?? 15000,
      heartbeatTimeoutMs: options.heartbeatTimeoutMs ?? 7000,
      watchdogGraceMs: options.watchdogGraceMs ?? 3000,
      onClosed: options.onClosed,
    };
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.ready.catch(() => {}); // a rejected handshake is reported to callers of ready/run, never as an unhandled rejection
    port.onmessage = (event) => this.onMessage(event.data);
    this.handshakeTimer = setTimeout(
      () => this.fail(new RunnerError("unavailable", "The Python runner did not respond (blocked, not approved for this site, or offline).")),
      this.opts.handshakeTimeoutMs,
    );
  }

  get state(): SessionState {
    return this._state;
  }

  private currentState(): SessionState {
    return this._state;
  }

  async run(code: string, handlers: RunHandlers = {}): Promise<RunResult> {
    if (this._state === "disposed") throw new RunnerError("disposed", "The runner has been disposed.");
    if (this._state === "failed" && this.failure) throw this.failure;
    // When already connected, proceed synchronously (the run message goes out immediately).
    if (this._state === "connecting") {
      await this.ready; // throws the handshake failure if there was one
      // State may have changed while awaiting; read it through a method so it is not narrowed away.
      const after = this.currentState();
      if (after === "failed" && this.failure) throw this.failure;
      if (after === "disposed") throw new RunnerError("disposed", "The runner has been disposed.");
    }
    if (this.pending) throw new RunnerError("busy", "A run is already in progress.");
    const limits = this.limits as RunnerLimits;
    if (code.length > limits.maxCodeChars) {
      throw new RunnerError("rejected", `Code is larger than the ${limits.maxCodeChars}-character limit.`);
    }

    const id = this.nextId++;
    return new Promise<RunResult>((resolve, reject) => {
      const watchdog = setTimeout(
        () => this.fail(new RunnerError("crashed", "The Python runner stopped responding.")),
        limits.initTimeoutMs + limits.runTimeoutMs + this.opts.watchdogGraceMs,
      );
      this.pending = { id, stdout: "", stderr: "", retained: 0, handlers, resolve, reject, watchdog };
      this._state = "running";
      this.send({ t: "run", id, code });
    });
  }

  stop(): void {
    if (this.pending) this.send({ t: "stop", id: this.pending.id });
  }

  dispose(): void {
    if (this._state === "disposed") return;
    try {
      this.port.postMessage({ t: "dispose" } satisfies ParentMessage);
    } catch {
      /* the port may already be closed */
    }
    this.settleAll(new RunnerError("disposed", "The runner has been disposed."));
    this._state = "disposed";
    this.close();
  }

  // ---- internals -------------------------------------------------------------------------

  private send(message: ParentMessage): void {
    this.port.postMessage(message);
  }

  private onMessage(data: unknown): void {
    const message = parseBridgeMessage(data);
    if (!message) return; // not ours / malformed: drop silently
    this.lastSeen = Date.now();

    if (message.t === "hello") {
      if (this._state !== "connecting") return; // hello is accepted exactly once
      if (message.nonce !== this.opts.nonce) {
        return this.fail(new RunnerError("unavailable", "The runner answered with the wrong handshake nonce."));
      }
      clearTimeout(this.handshakeTimer);
      this.limits = message.limits;
      this._state = "ready";
      this.heartbeatTimer = setInterval(() => this.checkHeartbeat(), 1000);
      this.resolveReady({ limits: message.limits, pyodideVersion: message.build.pyodideVersion });
      return;
    }
    if (this._state === "connecting") return; // nothing is trusted before a valid hello

    const pending = this.pending;
    switch (message.t) {
      case "hb":
        return;
      case "status":
        if (pending && message.id === pending.id) pending.handlers.onStatus?.(message.phase, message.mode);
        return;
      case "out":
        if (pending && message.id === pending.id) this.collect(pending, message.stream, message.text);
        return;
      case "result": {
        if (!pending || message.id !== pending.id) return; // stale
        clearTimeout(pending.watchdog);
        this.pending = null;
        this._state = "ready";
        pending.resolve({
          status: message.status,
          stdout: pending.stdout,
          stderr: pending.stderr,
          traceback: message.traceback,
          exception: message.exception,
          durationMs: message.durationMs,
          startupMs: message.startupMs,
          mode: message.mode,
          snapshot: message.snapshot,
          truncated: message.truncated,
        });
        return;
      }
      case "fatal": {
        const error = new RunnerError("fatal", message.message || message.reason, message.reason);
        const sessionWide = message.reason === "csp-not-enforced" || message.reason === "unsupported" || message.reason === "protocol-error" || message.reason === "disabled";
        if (sessionWide || message.id === undefined) return this.fail(error);
        if (pending && message.id === pending.id) {
          clearTimeout(pending.watchdog);
          this.pending = null;
          this._state = "ready";
          pending.reject(error);
        }
        return;
      }
    }
  }

  private collect(pending: Pending, stream: "stdout" | "stderr", text: string): void {
    // The runner already caps output; this is the parent's own bound on memory.
    const room = (this.limits as RunnerLimits).outputLimitBytes + 4096 - pending.retained;
    if (room <= 0) return;
    const kept = text.length > room ? text.slice(0, room) : text;
    pending.retained += kept.length;
    if (stream === "stdout") pending.stdout += kept;
    else pending.stderr += kept;
    pending.handlers.onOutput?.(stream, kept);
  }

  private checkHeartbeat(): void {
    if (this._state !== "ready" && this._state !== "running") return;
    if (Date.now() - this.lastSeen > this.opts.heartbeatTimeoutMs) {
      this.fail(new RunnerError("crashed", "The Python runner went silent (it may have run out of memory)."));
    }
  }

  /** Permanent failure of this session: every pending and future call rejects with `error`. */
  private fail(error: RunnerError): void {
    if (this._state === "failed" || this._state === "disposed") return;
    this.failure = error;
    this._state = "failed";
    this.rejectReady(error);
    this.settleAll(error);
    this.close();
  }

  private settleAll(error: RunnerError): void {
    clearTimeout(this.handshakeTimer);
    if (this.pending) {
      clearTimeout(this.pending.watchdog);
      this.pending.reject(error);
      this.pending = null;
    }
  }

  private close(): void {
    clearTimeout(this.handshakeTimer);
    clearInterval(this.heartbeatTimer);
    this.port.onmessage = null;
    try {
      this.port.close();
    } catch {
      /* already closed */
    }
    this.opts.onClosed?.();
  }
}
