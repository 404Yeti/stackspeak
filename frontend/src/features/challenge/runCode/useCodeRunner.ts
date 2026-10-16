"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  PythonRunnerClient,
  RunnerError,
  getPythonRunnerConfig,
  type PythonRunnerConfig,
  type RunHandlers,
  type RunResult,
  type RunnerLimits,
} from "@/lib/pythonRunner";
import type { RunMode } from "@/lib/pythonRunner/protocol";
import { describeFailure } from "./describeRun";

/** The slice of the runner client this feature uses — lets tests drive it with a scripted fake. */
export interface RunnerSessionLike {
  readonly ready: Promise<{ limits: RunnerLimits }>;
  run(code: string, handlers?: RunHandlers): Promise<RunResult>;
  stop(): void;
}
export interface RunnerClientLike {
  connect(): RunnerSessionLike;
  dispose(): void;
}
export type CreateRunnerClient = (runnerUrl: string) => RunnerClientLike;

const defaultCreateClient: CreateRunnerClient = (runnerUrl) => new PythonRunnerClient({ runnerUrl });

export type OutputChunk = { stream: "stdout" | "stderr"; text: string };
export type Failure = { text: string; retryable: boolean };

export type CodeRunnerState = {
  availability: "connecting" | "ready" | "unavailable";
  /** Why Run is unavailable (shown with a Retry button when `retryable`). */
  unavailable: Failure | null;
  phase: "idle" | "starting" | "running" | "finished" | "failed";
  mode: RunMode | null;
  chunks: OutputChunk[];
  result: RunResult | null;
  /** A run that produced no result (runner crashed, failed to start, …). */
  failure: Failure | null;
  limits: RunnerLimits | null;
  /** Increments per started run so the UI can key announcements. */
  runCount: number;
};

export type CodeRunnerAction =
  | { type: "connecting" }
  | { type: "connected"; limits: RunnerLimits }
  | { type: "unavailable"; failure: Failure }
  | { type: "runStarted" }
  | { type: "status"; phase: "starting" | "running"; mode: RunMode }
  | { type: "output"; chunk: OutputChunk }
  | { type: "runFinished"; result: RunResult }
  | { type: "runFailed"; failure: Failure; sessionLost: boolean }
  | { type: "clear" };

export const initialRunnerState: CodeRunnerState = {
  availability: "connecting",
  unavailable: null,
  phase: "idle",
  mode: null,
  chunks: [],
  result: null,
  failure: null,
  limits: null,
  runCount: 0,
};

export function codeRunnerReducer(state: CodeRunnerState, action: CodeRunnerAction): CodeRunnerState {
  switch (action.type) {
    case "connecting":
      return { ...initialRunnerState, runCount: state.runCount };
    case "connected":
      return { ...state, availability: "ready", unavailable: null, limits: action.limits };
    case "unavailable":
      return { ...state, availability: "unavailable", unavailable: action.failure, phase: "idle" };
    case "runStarted":
      return { ...state, phase: "starting", mode: null, chunks: [], result: null, failure: null, runCount: state.runCount + 1 };
    case "status":
      return state.phase === "starting" || state.phase === "running" ? { ...state, phase: action.phase, mode: action.mode } : state;
    case "output":
      return state.phase === "running" || state.phase === "starting" ? { ...state, chunks: [...state.chunks, action.chunk] } : state;
    case "runFinished":
      return { ...state, phase: "finished", result: action.result };
    case "runFailed":
      return {
        ...state,
        phase: "failed",
        failure: action.failure,
        ...(action.sessionLost ? { availability: "unavailable" as const, unavailable: action.failure } : {}),
      };
    case "clear":
      return state.phase === "starting" || state.phase === "running" ? state : { ...state, phase: "idle", mode: null, chunks: [], result: null, failure: null };
  }
}

export type CodeRunner = {
  /** False when the feature flag is off: render nothing and keep today's "nothing runs" copy. */
  enabled: boolean;
  state: CodeRunnerState;
  /** Starts a run. Ignored while one is in progress or the runner is unavailable. */
  run: (code: string) => void;
  stop: () => void;
  clear: () => void;
  /** Reconnects after Run became unavailable. */
  retry: () => void;
};


/**
 * Owns one runner client for the lifetime of the component that uses it. The student's code goes ONLY to the
 * dedicated cross-site runner iframe over a private MessageChannel — never to the StackSpeak backend, never to a
 * server. Connecting loads only a tiny bridge page; the Python runtime itself downloads on the first Run.
 */
export function useCodeRunner(options: { config?: PythonRunnerConfig; createClient?: CreateRunnerClient } = {}): CodeRunner {
  const config = options.config ?? getPythonRunnerConfig();
  // The factory is fixed for the component's lifetime (tests inject a fake once).
  const [createClient] = useState<CreateRunnerClient>(() => options.createClient ?? defaultCreateClient);
  const runnerUrl = config.enabled ? config.runnerUrl : null;

  const [state, dispatch] = useReducer(codeRunnerReducer, initialRunnerState);
  const clientRef = useRef<RunnerClientLike | null>(null);
  const sessionRef = useRef<RunnerSessionLike | null>(null);
  const runningRef = useRef(false);
  const generationRef = useRef(0);

  const connect = useCallback((url: string) => {
    const generation = ++generationRef.current;
    const live = () => generation === generationRef.current;
    dispatch({ type: "connecting" });
    runningRef.current = false;
    sessionRef.current = null;
    try {
      clientRef.current?.dispose();
      const client = createClient(url);
      clientRef.current = client;
      const session = client.connect();
      sessionRef.current = session;
      session.ready.then(
        ({ limits }) => live() && dispatch({ type: "connected", limits }),
        (error: unknown) => live() && dispatch({ type: "unavailable", failure: toFailure(error) }),
      );
    } catch (error) {
      dispatch({ type: "unavailable", failure: toFailure(error) });
    }
  }, [createClient]);

  useEffect(() => {
    if (!runnerUrl) return;
    connect(runnerUrl);
    return () => {
      // Leaving the stage (or the page) removes the iframe, which terminates any worker still running.
      generationRef.current += 1;
      runningRef.current = false;
      sessionRef.current = null;
      clientRef.current?.dispose();
      clientRef.current = null;
    };
  }, [runnerUrl, connect]);

  const run = useCallback((code: string) => {
    const session = sessionRef.current;
    if (!session || runningRef.current) return; // one run at a time
    const generation = generationRef.current;
    const live = () => generation === generationRef.current;
    runningRef.current = true;
    dispatch({ type: "runStarted" });
    session
      .run(code, {
        onStatus: (phase, mode) => live() && dispatch({ type: "status", phase, mode }),
        onOutput: (stream, text) => live() && dispatch({ type: "output", chunk: { stream, text } }),
      })
      .then(
        (result) => {
          if (!live()) return;
          runningRef.current = false;
          dispatch({ type: "runFinished", result });
        },
        (error: unknown) => {
          if (!live()) return;
          runningRef.current = false;
          const failure = toFailure(error);
          // After a fatal/crashed error the session is dead: Run stays unavailable until the student retries.
          const sessionLost = !(error instanceof RunnerError && (error.kind === "rejected" || error.kind === "busy" || (error.kind === "fatal" && failure.retryable)));
          dispatch({ type: "runFailed", failure, sessionLost });
        },
      );
  }, []);

  const stop = useCallback(() => sessionRef.current?.stop(), []);
  const clear = useCallback(() => dispatch({ type: "clear" }), []);
  const retry = useCallback(() => {
    if (runnerUrl) connect(runnerUrl);
  }, [runnerUrl, connect]);

  return { enabled: config.enabled, state: runnerUrl ? state : { ...initialRunnerState, availability: "unavailable" }, run, stop, clear, retry };
}

function toFailure(error: unknown): Failure {
  if (error instanceof RunnerError) {
    const { text, retryable } = describeFailure(error);
    return { text, retryable };
  }
  return { text: "The Python runner couldn't be reached. You can still edit your code.", retryable: true };
}

