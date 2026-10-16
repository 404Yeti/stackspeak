export type HealthStatus = {
  status: "ok" | "unreachable";
  service?: string;
};

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Calls the backend health endpoint. Never throws — a down backend renders as "unreachable". */
export async function getBackendHealth(): Promise<HealthStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return { status: "unreachable" };
    }

    const data = (await response.json()) as { status: string; service: string };
    return { status: "ok", service: data.service };
  } catch {
    return { status: "unreachable" };
  }
}

// --- Challenge API (stage-aware; see docs/challenge-schema.md) -------------
//
// Each stage has its own endpoint so the initial load never carries the bug,
// the contract, the tests, or the solution. Stage separation is a UX choice,
// not a security boundary — every endpoint can be called directly.

export type ChallengeSummary = {
  id: string;
  version: number;
  title: string;
  language: string;
  difficulty: string;
  topic: string;
};

/** Read / Explain / Fix content. */
export type ChallengeLoad = ChallengeSummary & {
  learning_objectives: string[];
  starter_code: string;
  explain_prompts: string[];
  fix_prompts: string[];
};

export type PublicTestCase = {
  description: string;
  input: unknown;
  expected_output?: unknown;
  expected_exception?: string | null;
  is_edge_case: boolean;
};

export type ChallengeTrace = {
  id: string;
  version: number;
  expected_behavior: string;
  test_cases: PublicTestCase[];
  trace_prompts: string[];
};

export type ChallengeDefend = {
  id: string;
  version: number;
  defend_prompts: string[];
};

export type ChallengeReview = {
  id: string;
  version: number;
  bug_description: string;
  corrected_solution: string;
  technical_checklist: string[];
  communication_checklist: string[];
  alternatives_note: string;
};

export type ApiErrorKind = "network" | "timeout" | "not_found" | "server" | "invalid";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;

  constructor(kind: ApiErrorKind, message: string) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
  }
}

/** Long enough for a cold-starting backend, short enough that a dead one surfaces a retry. */
export const REQUEST_TIMEOUT_MS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSummary(value: unknown): value is ChallengeSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.version === "number" &&
    typeof value.title === "string" &&
    typeof value.language === "string" &&
    typeof value.difficulty === "string" &&
    typeof value.topic === "string"
  );
}

function isLoad(value: unknown): value is ChallengeLoad {
  return (
    isSummary(value) &&
    isStringArray((value as Record<string, unknown>).learning_objectives) &&
    typeof (value as Record<string, unknown>).starter_code === "string" &&
    isStringArray((value as Record<string, unknown>).explain_prompts) &&
    isStringArray((value as Record<string, unknown>).fix_prompts)
  );
}

function isTestCase(value: unknown): value is PublicTestCase {
  return isRecord(value) && typeof value.description === "string" && "input" in value;
}

function isTrace(value: unknown): value is ChallengeTrace {
  return (
    isRecord(value) &&
    typeof value.expected_behavior === "string" &&
    Array.isArray(value.test_cases) &&
    value.test_cases.every(isTestCase) &&
    isStringArray(value.trace_prompts)
  );
}

function isDefend(value: unknown): value is ChallengeDefend {
  return isRecord(value) && isStringArray(value.defend_prompts);
}

function isReview(value: unknown): value is ChallengeReview {
  return (
    isRecord(value) &&
    typeof value.bug_description === "string" &&
    typeof value.corrected_solution === "string" &&
    isStringArray(value.technical_checklist) &&
    isStringArray(value.communication_checklist) &&
    typeof value.alternatives_note === "string"
  );
}

async function getJson<T>(
  path: string,
  guard: (value: unknown) => value is T,
  signal?: AbortSignal,
): Promise<T> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal;

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", signal: combined });

    if (response.status === 404) throw new ApiError("not_found", "Challenge not found.");
    if (!response.ok) throw new ApiError("server", `The server responded with ${response.status}.`);

    const body: unknown = await response.json();
    if (!guard(body)) throw new ApiError("invalid", "The server sent an unexpected response.");
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // A caller-initiated abort (unmount/retry) is not an error to surface.
    if (signal?.aborted) throw error;
    if (timeout.signal.aborted) {
      throw new ApiError("timeout", "The server took too long to respond.");
    }
    throw new ApiError("network", "Could not reach the server.");
  } finally {
    clearTimeout(timer);
  }
}

const challengePath = (id: string, suffix = "") =>
  `/api/challenges/${encodeURIComponent(id)}${suffix}`;

export function getChallengeSummaries(signal?: AbortSignal): Promise<ChallengeSummary[]> {
  return getJson(
    "/api/challenges",
    (v): v is ChallengeSummary[] => Array.isArray(v) && v.every(isSummary),
    signal,
  );
}

export const getChallenge = (id: string, signal?: AbortSignal) =>
  getJson(challengePath(id), isLoad, signal);
export const getChallengeTrace = (id: string, signal?: AbortSignal) =>
  getJson(challengePath(id, "/trace"), isTrace, signal);
export const getChallengeDefend = (id: string, signal?: AbortSignal) =>
  getJson(challengePath(id, "/defend"), isDefend, signal);
export const getChallengeReview = (id: string, signal?: AbortSignal) =>
  getJson(challengePath(id, "/review"), isReview, signal);

/**
 * The "daily" challenge is the first challenge the API lists. Rotation by
 * date is deferred — there is only one challenge today.
 */
export async function getDailyChallenge(signal?: AbortSignal): Promise<ChallengeLoad> {
  const summaries = await getChallengeSummaries(signal);
  const first = summaries[0];
  if (!first) throw new ApiError("not_found", "No challenges are available yet.");
  return getChallenge(first.id, signal);
}
