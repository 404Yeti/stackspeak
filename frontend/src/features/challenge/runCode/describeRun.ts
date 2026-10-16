import type { RunResult, RunnerError } from "@/lib/pythonRunner";

/** Plain-language status for a finished run. Never claims the code is correct — only what happened. */
export function describeResult(
  result: Pick<RunResult, "status" | "exception">,
  limits: { runTimeoutMs: number; outputLimitBytes: number } | null,
): { text: string; tone: "neutral" | "error" } {
  switch (result.status) {
    case "ok":
      return { text: "Your program finished running.", tone: "neutral" };
    case "exception":
      return { text: `Your program stopped with ${result.exception ?? "an error"}.`, tone: "error" };
    case "syntax-error":
      return { text: "Python couldn't read your code (syntax error).", tone: "error" };
    case "timeout": {
      const seconds = limits ? Math.round(limits.runTimeoutMs / 1000) : 5;
      return { text: `Stopped after ${seconds} seconds. Your program may be stuck in an endless loop.`, tone: "error" };
    }
    case "stopped":
      return { text: "You stopped the program.", tone: "neutral" };
    case "output-limit": {
      const kb = limits ? Math.round(limits.outputLimitBytes / 1024) : 64;
      return { text: `Stopped: your program printed more than ${kb} KB, so the output was cut off.`, tone: "error" };
    }
    case "crashed":
      return { text: "Python stopped responding. Your code is saved — try running it again.", tone: "error" };
    case "busy":
      return { text: "A run is already in progress.", tone: "neutral" };
    case "rejected":
      return { text: "Your code is too long to run.", tone: "error" };
  }
}

/** Plain-language message for a runner failure (the run never produced a result). */
export function describeFailure(error: Pick<RunnerError, "kind" | "reason" | "message">): { text: string; retryable: boolean; permanent: boolean } {
  if (error.kind === "fatal") {
    switch (error.reason) {
      case "csp-not-enforced":
        return { text: "Running code is turned off in this browser because it can't be made safe here. You can still edit your code.", retryable: false, permanent: true };
      case "unsupported":
        return { text: "This browser can't run Python here. You can still edit your code.", retryable: false, permanent: true };
      case "init-timeout":
        return { text: "Python took too long to start. Check your connection and try again.", retryable: true, permanent: false };
      case "init-failed":
      case "restore-failed":
        return { text: "Python couldn't start. Check your connection and try again.", retryable: true, permanent: false };
      default:
        return { text: "Running code is unavailable right now. You can still edit your code.", retryable: false, permanent: true };
    }
  }
  if (error.kind === "rejected") return { text: "Your code is too long to run.", retryable: false, permanent: false };
  if (error.kind === "busy") return { text: "A run is already in progress.", retryable: false, permanent: false };
  if (error.kind === "crashed") return { text: "Python stopped responding (it may have run out of memory). Your code is saved — try again.", retryable: true, permanent: false };
  if (error.kind === "disposed") return { text: "The runner was closed.", retryable: true, permanent: false };
  return { text: "The Python runner couldn't be reached. You can still edit your code.", retryable: true, permanent: false };
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
}
