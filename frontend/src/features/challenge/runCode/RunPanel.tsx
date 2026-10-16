"use client";

import { Button } from "@/components/ui/Button";
import { describeResult, formatDuration } from "./describeRun";
import type { CodeRunner } from "./useCodeRunner";

export const RUN_SHORTCUT_HINT = "Ctrl+Enter (⌘+Enter on Mac) runs your code";

type Props = {
  runner: CodeRunner;
  /** Code to run. The caller saves the student's draft before this is called. */
  onRun: () => void;
};

/**
 * Run button, status line and output terminal for the Fix stage. Shows what the program actually did —
 * never whether it is "correct" (running is not grading).
 */
export function RunPanel({ runner, onRun }: Props) {
  const { state } = runner;
  const busy = state.phase === "starting" || state.phase === "running";
  const ready = state.availability === "ready";
  const status = statusLine(runner);

  return (
    <section aria-labelledby="run-heading" className="flex flex-col gap-3">
      <h3 id="run-heading" className="sr-only">
        Run your code
      </h3>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onRun} disabled={!ready || busy} aria-describedby="run-hint">
          <span aria-hidden="true">▶</span>
          {busy ? "Running…" : "Run code"}
        </Button>
        {busy && (
          <Button type="button" variant="secondary" onClick={runner.stop}>
            Stop
          </Button>
        )}
        <p id="run-hint" className="text-xs text-text-muted">
          {RUN_SHORTCUT_HINT}. Running only shows what your code does — it does not check your fix.
        </p>
      </div>

      {/* One polite live region for state changes; the output itself is not announced line by line. */}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`min-h-5 text-sm ${status.tone === "error" ? "text-error" : "text-text-muted"}`}
        data-testid="run-status"
      >
        {status.text}
      </p>

      {state.availability === "unavailable" && state.unavailable?.retryable && (
        <div>
          <Button type="button" variant="secondary" onClick={runner.retry}>
            Try connecting again
          </Button>
        </div>
      )}

      <OutputTerminal runner={runner} />
    </section>
  );
}

function statusLine(runner: CodeRunner): { text: string; tone: "neutral" | "error" } {
  const { state } = runner;
  if (state.availability === "unavailable") return { text: state.unavailable?.text ?? "Running code is unavailable.", tone: "error" };
  if (state.availability === "connecting") return { text: "Connecting to the Python runner…", tone: "neutral" };
  switch (state.phase) {
    case "starting":
      return {
        text: state.mode === "restore" ? "Starting Python…" : "Starting Python… the first run can take several seconds.",
        tone: "neutral",
      };
    case "running":
      return { text: "Running your code…", tone: "neutral" };
    case "finished":
      return state.result ? describeResult(state.result, state.limits) : { text: "", tone: "neutral" };
    case "failed":
      return { text: state.failure?.text ?? "The run failed.", tone: "error" };
    default:
      return { text: "Python is ready.", tone: "neutral" };
  }
}

function OutputTerminal({ runner }: { runner: CodeRunner }) {
  const { state } = runner;
  const hasOutput = state.chunks.length > 0;
  const result = state.result;
  const badge =
    state.phase === "starting" || state.phase === "running"
      ? { label: "Running", className: "text-accent-soft" }
      : state.phase === "finished" && result
        ? result.status === "ok"
          ? { label: "Finished", className: "text-success" }
          : { label: "Stopped with an error", className: "text-error" }
        : state.phase === "failed"
          ? { label: "Run failed", className: "text-error" }
          : { label: "Idle", className: "text-text-muted" };

  return (
    <div className="w-full overflow-hidden rounded-lg border border-border-subtle bg-background">
      <div className="flex items-center justify-between bg-surface px-4 py-2 font-mono text-xs font-medium">
        <span id="run-output-label" className="text-text-primary">
          Output
        </span>
        <span className={badge.className}>{badge.label}</span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <pre
          role="region"
          aria-labelledby="run-output-label"
          tabIndex={0}
          data-testid="run-output"
          className="max-h-64 min-h-16 overflow-auto whitespace-pre-wrap break-words rounded-sm font-mono text-xs leading-5 text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {hasOutput ? (
            state.chunks.map((chunk, index) =>
              chunk.stream === "stderr" ? (
                <span key={index} className="text-error" data-stream="stderr">
                  <span className="sr-only">Error output: </span>
                  {chunk.text}
                </span>
              ) : (
                <span key={index} data-stream="stdout">
                  {chunk.text}
                </span>
              ),
            )
          ) : (
            <span className="text-text-muted">
              {state.phase === "finished" ? "(Your program printed nothing.)" : "Run your code to see its output here."}
            </span>
          )}
        </pre>
        {result?.traceback && (
          <div>
            <p className="mb-1 font-mono text-xs font-medium text-text-muted">Python error</p>
            <pre
              data-testid="run-traceback"
              className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-error"
            >
              {result.traceback}
            </pre>
          </div>
        )}
        {(result?.truncated || result?.status === "output-limit") && <p className="text-xs text-text-muted">Output was cut off at the size limit.</p>}
        {result && (
          <p className="font-mono text-xs text-text-muted" data-testid="run-timing">
            Ran in {formatDuration(result.durationMs)}
            {result.startupMs > 0 ? ` · Python started in ${formatDuration(result.startupMs)}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
