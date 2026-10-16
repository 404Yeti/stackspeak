import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChallengeLoad } from "@/lib/api";
import { RunnerError, type RunHandlers, type RunResult } from "@/lib/pythonRunner";
import { FixStage } from "../FixStage";
import { initialState } from "../challengeReducer";
import type { RunnerClientLike } from "./useCodeRunner";

const CHALLENGE: ChallengeLoad = {
  id: "average-of-list",
  version: 2,
  title: "Average of a List",
  language: "python",
  difficulty: "beginner",
  topic: "Lists",
  learning_objectives: [],
  starter_code: "print('starter')",
  explain_prompts: [],
  fix_prompts: ["What is wrong?"],
};
const LIMITS = { runTimeoutMs: 5000, initTimeoutMs: 30000, outputLimitBytes: 65536, maxCodeChars: 50000 };
const CONFIG = { enabled: true as const, runnerUrl: "https://runner.example" };

const result = (over: Partial<RunResult> = {}): RunResult => ({
  status: "ok", stdout: "", stderr: "", durationMs: 12, startupMs: 1400, mode: "restore", snapshot: "ready", truncated: false, ...over,
});

/** A scripted stand-in for the runner client: the test decides when each step completes. */
function fakeRunner() {
  const runs: Array<{ code: string; handlers: RunHandlers; resolve: (r: RunResult) => void; reject: (e: unknown) => void }> = [];
  let resolveReady!: () => void;
  let rejectReady!: (e: unknown) => void;
  const session = {
    ready: new Promise<{ limits: typeof LIMITS }>((resolve, reject) => {
      resolveReady = () => resolve({ limits: LIMITS });
      rejectReady = reject;
    }),
    run: vi.fn((code: string, handlers: RunHandlers = {}) => new Promise<RunResult>((resolve, reject) => runs.push({ code, handlers, resolve, reject }))),
    stop: vi.fn(),
  };
  session.ready.catch(() => {});
  const client: RunnerClientLike = { connect: vi.fn(() => session), dispose: vi.fn() };
  const createClient = vi.fn(() => client);
  return { session, client, createClient, runs, resolveReady: () => act(async () => resolveReady()), rejectReady: (e: unknown) => act(async () => rejectReady(e)) };
}

function renderFix(fake: ReturnType<typeof fakeRunner>, over: { code?: string; flushDraft?: () => void; dispatch?: () => void; config?: { enabled: boolean; runnerUrl?: string } } = {}) {
  const state = { ...initialState(CHALLENGE.starter_code), code: over.code ?? CHALLENGE.starter_code };
  const props = {
    challenge: CHALLENGE, state, dispatch: over.dispatch ?? vi.fn(), focusHeading: false, blockedReason: null,
    flushDraft: over.flushDraft,
    runnerOptions: { config: (over.config ?? CONFIG) as never, createClient: fake.createClient },
  };
  const view = render(<FixStage {...props} />);
  return { ...view, props };
}

afterEach(cleanup);

const runButton = () => screen.getByRole("button", { name: /^(▶\s*)?(Run code|Running…)/ });
const status = () => screen.getByTestId("run-status");

describe("Fix stage: Run code is off by default", () => {
  it("renders no Run controls and keeps the 'nothing runs it' copy when the flag is off", () => {
    const fake = fakeRunner();
    renderFix(fake, { config: { enabled: false } });
    expect(screen.queryByRole("button", { name: /run code/i })).toBeNull();
    expect(screen.queryByTestId("run-output")).toBeNull();
    expect(screen.getByText(/nothing runs it/i)).toBeInTheDocument();
    expect(fake.createClient).not.toHaveBeenCalled(); // no runner traffic at all
  });
});

describe("Fix stage: running code", () => {
  it("connects on mount, enables Run when ready, and says Python is ready", async () => {
    const fake = fakeRunner();
    renderFix(fake);
    expect(fake.createClient).toHaveBeenCalledWith("https://runner.example");
    expect(runButton()).toBeDisabled();
    expect(status()).toHaveTextContent("Connecting to the Python runner");
    await fake.resolveReady();
    expect(runButton()).toBeEnabled();
    expect(status()).toHaveTextContent("Python is ready");
  });

  it("saves the draft first, runs the student's current code, and shows real stdout, stderr, traceback and timing", async () => {
    const fake = fakeRunner();
    const order: string[] = [];
    const flushDraft = vi.fn(() => order.push("flush"));
    fake.session.run.mockImplementationOnce((code: string, handlers: RunHandlers = {}) => {
      order.push("run");
      return new Promise<RunResult>((resolve, reject) => fake.runs.push({ code, handlers, resolve, reject }));
    });
    renderFix(fake, { code: "print('hi')\n1/0", flushDraft });
    await fake.resolveReady();

    fireEvent.click(runButton());
    expect(order).toEqual(["flush", "run"]);
    expect(fake.runs[0].code).toBe("print('hi')\n1/0");
    expect(status()).toHaveTextContent(/Starting Python/);

    act(() => {
      fake.runs[0].handlers.onStatus?.("running", "restore");
      fake.runs[0].handlers.onOutput?.("stdout", "hi\n");
      fake.runs[0].handlers.onOutput?.("stderr", "warning\n");
    });
    expect(status()).toHaveTextContent("Running your code");
    const output = screen.getByTestId("run-output");
    expect(output).toHaveTextContent("hi");
    expect(within(output).getByText(/warning/).closest("[data-stream]")).toHaveAttribute("data-stream", "stderr");
    expect(within(output).getByText("Error output:")).toBeInTheDocument(); // screen-reader label

    await act(async () =>
      fake.runs[0].resolve(result({ status: "exception", exception: "ZeroDivisionError", traceback: "Traceback…\nZeroDivisionError: division by zero", durationMs: 8 })),
    );
    expect(status()).toHaveTextContent("Your program stopped with ZeroDivisionError.");
    expect(screen.getByTestId("run-traceback")).toHaveTextContent("ZeroDivisionError: division by zero");
    expect(screen.getByTestId("run-timing")).toHaveTextContent("Ran in 8 ms");
    expect(runButton()).toBeEnabled();
  });

  it("never claims the code is correct: a clean run only says the program finished", async () => {
    const fake = fakeRunner();
    renderFix(fake);
    await fake.resolveReady();
    fireEvent.click(runButton());
    await act(async () => fake.runs[0].resolve(result()));
    expect(status()).toHaveTextContent("Your program finished running.");
    expect(document.body.textContent).not.toMatch(/tests? passed|is correct|well done|you did it/i);
    expect(screen.getByText(/does not check your fix/i)).toBeInTheDocument();
  });

  it("supports many sequential runs; each starts with a clean output panel", async () => {
    const fake = fakeRunner();
    renderFix(fake);
    await fake.resolveReady();

    fireEvent.click(runButton());
    act(() => fake.runs[0].handlers.onOutput?.("stdout", "first\n"));
    await act(async () => fake.runs[0].resolve(result()));
    expect(screen.getByTestId("run-output")).toHaveTextContent("first");

    fireEvent.click(runButton());
    expect(screen.getByTestId("run-output")).not.toHaveTextContent("first");
    act(() => fake.runs[1].handlers.onOutput?.("stdout", "second\n"));
    await act(async () => fake.runs[1].resolve(result()));
    expect(screen.getByTestId("run-output")).toHaveTextContent("second");
    expect(fake.session.run).toHaveBeenCalledTimes(2);
  });

  it("prevents concurrent runs: the button and the keyboard shortcut are inert while one is in progress", async () => {
    const fake = fakeRunner();
    renderFix(fake);
    await fake.resolveReady();
    fireEvent.click(runButton());
    expect(runButton()).toBeDisabled();
    expect(runButton()).toHaveTextContent("Running…");

    fireEvent.click(runButton());
    fireEvent.keyDown(screen.getByLabelText("main.py — your code"), { key: "Enter", ctrlKey: true });
    expect(fake.session.run).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(fake.session.stop).toHaveBeenCalledTimes(1);
    await act(async () => fake.runs[0].resolve(result({ status: "stopped" })));
    expect(status()).toHaveTextContent("You stopped the program.");
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
  });

  it.each([
    [{ status: "timeout" as const }, /Stopped after 5 seconds.*endless loop/],
    [{ status: "output-limit" as const, truncated: true }, /printed more than 64 KB/],
    [{ status: "syntax-error" as const, traceback: "SyntaxError: invalid syntax" }, /syntax error/],
  ])("explains %j in plain language", async (over, expected) => {
    const fake = fakeRunner();
    renderFix(fake);
    await fake.resolveReady();
    fireEvent.click(runButton());
    await act(async () => fake.runs[0].resolve(result(over)));
    expect(status()).toHaveTextContent(expected);
    expect(runButton()).toBeEnabled(); // the student can edit and try again
  });
});

describe("Fix stage: Run is unavailable or fails", () => {
  it("shows a clear message when the runner can't be reached, keeps editing possible, and Retry reconnects", async () => {
    const fake = fakeRunner();
    renderFix(fake);
    await fake.rejectReady(new RunnerError("unavailable", "no hello"));
    expect(status()).toHaveTextContent(/couldn't be reached.*still edit your code/);
    expect(runButton()).toBeDisabled();
    expect(screen.getByLabelText("main.py — your code")).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Try connecting again" }));
    expect(fake.createClient).toHaveBeenCalledTimes(2);
    expect(fake.client.dispose).toHaveBeenCalledTimes(1); // the failed client was cleaned up
  });

  it("is permanently off, with no Retry, when the browser does not enforce the runner's CSP (fail closed)", async () => {
    const fake = fakeRunner();
    renderFix(fake);
    await fake.resolveReady();
    fireEvent.click(runButton());
    await act(async () => fake.runs[0].reject(new RunnerError("fatal", "csp", "csp-not-enforced")));
    expect(status()).toHaveTextContent(/turned off in this browser/);
    expect(runButton()).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Try connecting again" })).toBeNull();
  });

  it("a Python start-up failure is retryable on the same session", async () => {
    const fake = fakeRunner();
    renderFix(fake);
    await fake.resolveReady();
    fireEvent.click(runButton());
    await act(async () => fake.runs[0].reject(new RunnerError("fatal", "boom", "init-failed")));
    expect(status()).toHaveTextContent(/couldn't start/);
    expect(runButton()).toBeEnabled();
    fireEvent.click(runButton());
    expect(fake.session.run).toHaveBeenCalledTimes(2);
  });

  it("a crashed runner (e.g. out of memory) ends the session with a reconnect option; the draft was already saved", async () => {
    const fake = fakeRunner();
    const flushDraft = vi.fn();
    renderFix(fake, { flushDraft });
    await fake.resolveReady();
    fireEvent.click(runButton());
    expect(flushDraft).toHaveBeenCalledTimes(1);
    await act(async () => fake.runs[0].reject(new RunnerError("crashed", "silent")));
    expect(status()).toHaveTextContent(/out of memory/);
    expect(screen.getByRole("button", { name: "Try connecting again" })).toBeInTheDocument();
  });
});

describe("Fix stage: reset, cleanup and accessibility", () => {
  it("Reset code (after confirming) clears the output panel and restores the starter code", async () => {
    const fake = fakeRunner();
    const dispatch = vi.fn();
    renderFix(fake, { dispatch });
    await fake.resolveReady();
    fireEvent.click(runButton());
    act(() => fake.runs[0].handlers.onOutput?.("stdout", "old output\n"));
    await act(async () => fake.runs[0].resolve(result()));
    expect(screen.getByTestId("run-output")).toHaveTextContent("old output");

    fireEvent.click(screen.getByRole("button", { name: "Reset code" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, reset" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "resetCode", starterCode: CHALLENGE.starter_code });
    expect(screen.getByTestId("run-output")).not.toHaveTextContent("old output");
  });

  it("disposes the runner on unmount and ignores anything that arrives afterwards", async () => {
    const fake = fakeRunner();
    const { unmount } = renderFix(fake);
    await fake.resolveReady();
    fireEvent.click(runButton());
    unmount();
    expect(fake.client.dispose).toHaveBeenCalled();
    // A late result after navigation must not throw or update unmounted state.
    await act(async () => fake.runs[0].resolve(result()));
  });

  it("Ctrl+Enter and ⌘+Enter run the code from the editor; plain Enter and Tab never do", async () => {
    const fake = fakeRunner();
    renderFix(fake);
    await fake.resolveReady();
    const editor = screen.getByLabelText("main.py — your code");
    fireEvent.keyDown(editor, { key: "Enter" });
    fireEvent.keyDown(editor, { key: "Tab" });
    expect(fake.session.run).not.toHaveBeenCalled();
    fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });
    expect(fake.session.run).toHaveBeenCalledTimes(1);
    await act(async () => fake.runs[0].resolve(result()));
    fireEvent.keyDown(editor, { key: "Enter", metaKey: true });
    expect(fake.session.run).toHaveBeenCalledTimes(2);
  });

  it("exposes a live status region, a focusable labelled output region, and a described Run button", async () => {
    const fake = fakeRunner();
    renderFix(fake);
    await fake.resolveReady();
    expect(status()).toHaveAttribute("role", "status");
    expect(status()).toHaveAttribute("aria-live", "polite");
    const output = screen.getByRole("region", { name: "Output" });
    expect(output).toHaveAttribute("tabindex", "0");
    expect(runButton()).toHaveAccessibleDescription(/Ctrl\+Enter/);
  });
});
